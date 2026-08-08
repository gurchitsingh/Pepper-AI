import logging
import uuid

import numpy as np

from app.database import SessionLocal
from app.embeddings import EmbeddingError, embed_texts
from app.folders import enqueue_recompute_folders
from app.ingestion import article, document, media, youtube
from app.ingestion.chunking import chunk_segments, chunk_text
from app.ingestion.common import IngestionError
from app.models.models import Chunk, SavedItem, Transcript, TranscriptSegment
from app.titles import generate_title

logger = logging.getLogger(__name__)

def _process_reel(item):
    """Instagram/TikTok items arrive two ways: pasted as a link (source_url set,
    downloaded via yt-dlp) or captured on-device via the upload endpoint
    (uploaded_file_path set, already on disk).
    """
    if item.source_url:
        return media.process_reel_url(item.source_url)
    return media.process_uploaded_file(item.uploaded_file_path)


HANDLERS = {
    "article": lambda item: article.process(item.source_url),
    "youtube": lambda item: youtube.process(item.source_url),
    "instagram": _process_reel,
    "tiktok": _process_reel,
    "voice_note": lambda item: media.process_uploaded_file(item.uploaded_file_path),
    "document": lambda item: document.process_uploaded_document(item.uploaded_file_path),
}


def store_chunks(db, item: SavedItem, raw_text: str, segments, content_type: str) -> int:
    """Chunks by timed segments when available (YouTube/Whisper), otherwise by
    paragraph/char count (articles, notes, documents). Persists Chunk rows with
    chunk_index/content_type/token_count, embedding each chunk via Voyage AI if
    VOYAGE_API_KEY is configured.

    If embedding fails (most commonly: no key configured yet), chunks are still
    stored with embedding left NULL -- ingestion must not fail just because
    embeddings aren't available yet. `scripts/generate_embeddings.py` backfills
    any chunk with a NULL embedding once a key is available.

    Also sets `item.embedding` to the mean of the chunk vectors that did embed --
    this item-level embedding is what folder clustering groups on. Left NULL if
    none of the chunks embedded.
    Returns the number of chunks created.
    """
    chunks = chunk_segments(segments) if segments else chunk_text(raw_text)
    if not chunks:
        return 0

    vectors = [None] * len(chunks)
    try:
        vectors = embed_texts([c.text for c in chunks], input_type="document")
    except EmbeddingError as e:
        logger.warning("Embedding skipped for saved_item %s: %s", item.id, e)

    for index, (c, vector) in enumerate(zip(chunks, vectors)):
        db.add(
            Chunk(
                saved_item_id=item.id,
                text=c.text,
                start_time=c.start_time,
                end_time=c.end_time,
                chunk_index=index,
                content_type=content_type,
                token_count=c.token_count,
                embedding=vector,
            )
        )

    valid_vectors = [v for v in vectors if v is not None]
    if valid_vectors:
        item.embedding = np.mean(np.array(valid_vectors), axis=0).tolist()

    return len(chunks)


def process_saved_item(saved_item_id: str) -> None:
    """RQ job: extracts content for a saved_item and updates its status.
    pending -> processing -> ready (transcript stored) or failed (failure_reason set).
    """
    db = SessionLocal()
    try:
        item = db.get(SavedItem, uuid.UUID(saved_item_id))
        if item is None:
            logger.warning("process_saved_item: saved_item %s no longer exists", saved_item_id)
            return

        item.status = "processing"
        db.commit()

        handler = HANDLERS.get(item.source_type)
        if handler is None:
            item.status = "failed"
            item.failure_reason = f"Unsupported source_type: {item.source_type}"
            db.commit()
            return

        try:
            result = handler(item)
        except IngestionError as e:
            item.status = "failed"
            item.failure_reason = str(e)[:1000]
            db.commit()
            return
        except Exception as e:
            logger.exception("Unexpected error processing saved_item %s", saved_item_id)
            item.status = "failed"
            item.failure_reason = f"Unexpected error: {e}"[:1000]
            db.commit()
            return

        transcript_id = uuid.uuid4()
        db.add(Transcript(id=transcript_id, saved_item_id=item.id, raw_text=result.raw_text, language=result.language))
        for seg in result.segments:
            db.add(TranscriptSegment(transcript_id=transcript_id, start_time=seg.start, end_time=seg.end, text=seg.text))

        store_chunks(db, item, result.raw_text, result.segments, content_type=item.source_type)

        if result.title:
            item.title = result.title
        else:
            item.title = generate_title(result.raw_text)
        if result.segments:
            # last segment's end time as a duration proxy -- avoids a second ffprobe
            # call since Whisper/YouTube segments are already computed above.
            item.duration_seconds = max(seg.end for seg in result.segments)
        item.status = "ready"
        db.commit()

        enqueue_recompute_folders(item.user_id)
    finally:
        db.close()
