import logging
import os
import uuid
from collections import defaultdict

import numpy as np
from dotenv import load_dotenv
from google import genai
from google.genai import types
from pydantic import BaseModel
from sklearn.cluster import AgglomerativeClustering
from sqlalchemy.orm import Session

from app.models.models import Folder, SavedItem, Transcript
from app.queue import ingestion_queue

load_dotenv()

logger = logging.getLogger(__name__)

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
GEMINI_MODEL = "gemini-flash-latest"

# Below this many embedded items, clustering isn't meaningful -- everything
# stays unfoldered.
MIN_ITEMS_TO_CLUSTER = 3
# Clusters smaller than this are dissolved back into "Unsorted" rather than
# becoming a folder of their own -- a folder with one item isn't useful.
MIN_CLUSTER_SIZE = 2
# Cosine distance threshold for average-linkage agglomerative clustering.
# Chosen empirically against voyage-4-large embeddings using a real test set
# (3 fitness / 3 startup / 2 geopolitics items): within-topic pairs landed at
# 0.37-0.58 cosine distance, cross-topic pairs at 0.61+, so 0.60 sits in the
# gap. Revisit if real usage shows folders splitting or merging topics that
# shouldn't.
DISTANCE_THRESHOLD = 0.60

MAX_SNIPPET_CHARS = 300
MAX_ITEMS_PER_CLUSTER_FOR_NAMING = 8

FOLDER_NAMING_PROMPT = (
    "Each numbered cluster below is a group of items a user saved (notes, articles, "
    "videos, voice memos) that turned out to share a topic. Give each cluster a short "
    "folder name: 1-3 words, title case, no punctuation, no quotes. Be specific rather "
    "than generic -- e.g. 'Marathon Training' instead of 'Fitness' if that's what the "
    "items are actually about, 'YC Advice' instead of 'Startups' if they're all about "
    "fundraising advice. Return one entry per cluster, in the same order they're given."
)


class ClusterName(BaseModel):
    index: int
    name: str


class ClusterNames(BaseModel):
    folders: list[ClusterName]


def enqueue_recompute_folders(user_id: uuid.UUID) -> None:
    """Fire-and-forget: schedules a folder recompute on the ingestion worker so
    a new save's request/response cycle doesn't wait on clustering + Gemini."""
    ingestion_queue.enqueue(recompute_folders_job, str(user_id))


def recompute_folders_job(user_id: str) -> None:
    from app.database import SessionLocal

    db = SessionLocal()
    try:
        recompute_folders(db, uuid.UUID(user_id))
    finally:
        db.close()


def recompute_folders(db: Session, user_id: uuid.UUID) -> list[Folder]:
    """Full rebuild of a user's auto-folders from their current saved items.

    This is a from-scratch recompute, not an incremental update: existing
    folders are deleted and new ones created every time. Folder identity (id,
    exact name) is therefore not stable across runs, even though membership
    tends to converge to similar groupings. Simpler than incremental
    merge/split logic, and cheap enough at personal-library scale (clustering
    is near-instant; naming is a single batched Gemini call).
    """
    items = (
        db.query(SavedItem)
        .filter(
            SavedItem.user_id == user_id,
            SavedItem.status == "ready",
            SavedItem.embedding.isnot(None),
        )
        .all()
    )

    db.query(SavedItem).filter(SavedItem.user_id == user_id).update({SavedItem.folder_id: None})
    db.query(Folder).filter(Folder.user_id == user_id).delete()

    if len(items) < MIN_ITEMS_TO_CLUSTER:
        db.commit()
        return []

    vectors = np.array([item.embedding for item in items])
    labels = _cluster_embeddings(vectors)

    clusters: dict[int, list[SavedItem]] = defaultdict(list)
    for item, label in zip(items, labels):
        clusters[label].append(item)

    real_clusters = {label: members for label, members in clusters.items() if len(members) >= MIN_CLUSTER_SIZE}
    if not real_clusters:
        db.commit()
        return []

    snippets = _snippet_for_items(db, [item for members in real_clusters.values() for item in members])
    names = _name_clusters(real_clusters, snippets)

    folders = []
    for label, members in real_clusters.items():
        folder = Folder(user_id=user_id, name=names.get(label, "Untitled"))
        db.add(folder)
        db.flush()
        for item in members:
            item.folder_id = folder.id
        folders.append(folder)

    db.commit()
    return folders


def _cluster_embeddings(vectors: np.ndarray) -> list[int]:
    model = AgglomerativeClustering(
        n_clusters=None,
        distance_threshold=DISTANCE_THRESHOLD,
        metric="cosine",
        linkage="average",
    )
    return model.fit_predict(vectors).tolist()


def _snippet_for_items(db: Session, items: list[SavedItem]) -> dict[uuid.UUID, str]:
    """Short representative text per item, used as clustering-naming context.
    Prefers the title; falls back to a transcript snippet for untitled items
    (e.g. notes)."""
    item_ids = [item.id for item in items]
    transcripts = db.query(Transcript.saved_item_id, Transcript.raw_text).filter(
        Transcript.saved_item_id.in_(item_ids)
    ).all()
    transcript_by_item = {t.saved_item_id: t.raw_text for t in transcripts}

    snippets = {}
    for item in items:
        if item.title:
            text = item.title
        else:
            raw = (transcript_by_item.get(item.id) or "").strip().replace("\n", " ")
            text = raw[:MAX_SNIPPET_CHARS]
        snippets[item.id] = text or f"untitled {item.source_type} item"
    return snippets


def _name_clusters(
    clusters: dict[int, list[SavedItem]], snippets: dict[uuid.UUID, str]
) -> dict[int, str]:
    labels = list(clusters.keys())

    if not GOOGLE_API_KEY:
        logger.warning("GOOGLE_API_KEY not set -- falling back to generic folder names")
        return {label: f"Folder {i + 1}" for i, label in enumerate(labels)}

    prompt_sections = []
    for i, label in enumerate(labels):
        members = clusters[label][:MAX_ITEMS_PER_CLUSTER_FOR_NAMING]
        lines = [f"- {snippets[item.id]}" for item in members]
        prompt_sections.append(f"Cluster {i}:\n" + "\n".join(lines))

    prompt = FOLDER_NAMING_PROMPT + "\n\n" + "\n\n".join(prompt_sections)

    try:
        client = genai.Client(api_key=GOOGLE_API_KEY)
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=ClusterNames,
            ),
        )
        parsed: ClusterNames = response.parsed
        result = {}
        for entry in parsed.folders:
            if 0 <= entry.index < len(labels) and entry.name.strip():
                result[labels[entry.index]] = entry.name.strip()
        for i, label in enumerate(labels):
            result.setdefault(label, f"Folder {i + 1}")
        return result
    except Exception as e:
        logger.warning("Folder naming via Gemini failed, falling back to generic names: %s", e)
        return {label: f"Folder {i + 1}" for i, label in enumerate(labels)}
