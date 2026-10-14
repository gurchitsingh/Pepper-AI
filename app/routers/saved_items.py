import mimetypes
import os
import shutil
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.billing import check_usage_allowed
from app.database import get_db
from app.embeddings import EmbeddingError, embed_texts
from app.folders import enqueue_recompute_folders
from app.ingestion.tasks import process_saved_item, store_chunks
from app.models.models import Chunk, Folder, SavedItem, Transcript, TranscriptSegment, User
from app.queue import ingestion_queue
from app.retrieval import search_chunks
from app.schemas import SavedItemCreate, SavedItemOut, SavedItemUpdate, SegmentOut
from app.titles import generate_title

router = APIRouter(prefix="/saved-items", tags=["saved-items"])

SEMANTIC_SEARCH_TOP_K = 20

# Resolved to an absolute path: uploaded_file_path is read back by the RQ worker, a
# separate process that isn't guaranteed to share this process's cwd -- a relative
# path here silently breaks ingestion ("file not found") whenever it doesn't.
UPLOAD_DIR = os.path.abspath(os.getenv("UPLOAD_DIR", "./uploads"))
UPLOAD_SOURCE_TYPES = {"instagram", "tiktok", "voice_note", "document"}

AUDIO_MIME_TYPES = {
    ".webm": "audio/webm",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".m4a": "audio/mp4",
    ".ogg": "audio/ogg",
}

os.makedirs(UPLOAD_DIR, exist_ok=True)


def _fetch_owned_item(db: Session, item_id: uuid.UUID, current_user: User) -> SavedItem:
    item = (
        db.query(SavedItem)
        .filter(SavedItem.id == item_id, SavedItem.user_id == current_user.id)
        .first()
    )
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Saved item not found")
    return item


def _to_out(item: SavedItem, transcript_text: str | None, folder_name: str | None = None) -> SavedItemOut:
    return SavedItemOut(
        id=item.id,
        source_type=item.source_type,
        source_url=item.source_url,
        title=item.title,
        status=item.status,
        failure_reason=item.failure_reason,
        transcript=transcript_text,
        duration_seconds=item.duration_seconds,
        folder_id=item.folder_id,
        folder_name=folder_name,
        created_at=item.created_at,
    )


@router.post("", response_model=SavedItemOut, status_code=status.HTTP_201_CREATED)
def create_saved_item(
    payload: SavedItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    check_usage_allowed(db, current_user)

    if payload.source_type == "note":
        if not payload.content or not payload.content.strip():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="content is required for note items")

        title = payload.title.strip() if payload.title and payload.title.strip() else None
        item = SavedItem(user_id=current_user.id, source_type="note", status="ready", title=title)
        db.add(item)
        db.flush()
        db.add(Transcript(saved_item_id=item.id, raw_text=payload.content))
        store_chunks(db, item, payload.content, segments=[], content_type="note")
        if item.title is None:
            item.title = generate_title(payload.content)
        db.commit()
        db.refresh(item)
        enqueue_recompute_folders(current_user.id)
        return _to_out(item, payload.content)

    item = SavedItem(
        user_id=current_user.id,
        source_type=payload.source_type,
        source_url=payload.source_url,
        status="pending",
    )
    db.add(item)
    db.commit()
    db.refresh(item)

    ingestion_queue.enqueue(process_saved_item, str(item.id))
    return _to_out(item, None)


@router.post("/upload", response_model=SavedItemOut, status_code=status.HTTP_201_CREATED)
def upload_saved_item(
    source_type: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    check_usage_allowed(db, current_user)

    if source_type not in UPLOAD_SOURCE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"source_type for uploads must be one of {sorted(UPLOAD_SOURCE_TYPES)}",
        )

    safe_name = os.path.basename(file.filename or "upload")
    dest_path = os.path.join(UPLOAD_DIR, f"{uuid.uuid4()}_{safe_name}")
    with open(dest_path, "wb") as out:
        shutil.copyfileobj(file.file, out)

    item = SavedItem(
        user_id=current_user.id,
        source_type=source_type,
        uploaded_file_path=dest_path,
        status="pending",
    )
    db.add(item)
    db.commit()
    db.refresh(item)

    ingestion_queue.enqueue(process_saved_item, str(item.id))
    return _to_out(item, None)


@router.post("/{item_id}/retry", response_model=SavedItemOut)
def retry_saved_item(
    item_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = _fetch_owned_item(db, item_id, current_user)
    if item.status != "failed":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only failed items can be retried")

    item.status = "pending"
    item.failure_reason = None
    db.commit()
    db.refresh(item)

    ingestion_queue.enqueue(process_saved_item, str(item.id))
    return _to_out(item, None)


@router.get("", response_model=list[SavedItemOut])
def list_saved_items(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    items = (
        db.query(SavedItem)
        .filter(SavedItem.user_id == current_user.id)
        .order_by(SavedItem.created_at.desc())
        .all()
    )
    item_ids = [item.id for item in items]
    transcripts = db.query(Transcript).filter(Transcript.saved_item_id.in_(item_ids)).all()
    transcript_by_item = {t.saved_item_id: t.raw_text for t in transcripts}
    folders = db.query(Folder).filter(Folder.user_id == current_user.id).all()
    folder_name_by_id = {f.id: f.name for f in folders}

    return [
        _to_out(item, transcript_by_item.get(item.id), folder_name_by_id.get(item.folder_id))
        for item in items
    ]


@router.get("/search", response_model=list[SavedItemOut])
def search_saved_items(
    q: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = q.strip()
    if not query:
        return []

    # Rank by semantic similarity first (nearest chunk embeddings, deduped to
    # one entry per saved item), then append any keyword-only matches --
    # exact title/source-type hits that a wording-based query might not
    # embed close to -- that semantic search missed. Falls back to pure
    # keyword search if embeddings aren't configured/available.
    ranked_ids: list[uuid.UUID] = []
    seen: set[uuid.UUID] = set()

    try:
        [query_vector] = embed_texts([query], input_type="query")
    except EmbeddingError:
        query_vector = None

    if query_vector is not None:
        for _chunk, item in search_chunks(db, query_vector, user_id=current_user.id, top_k=SEMANTIC_SEARCH_TOP_K):
            if item.id not in seen:
                seen.add(item.id)
                ranked_ids.append(item.id)

    pattern = f"%{query}%"
    keyword_items = (
        db.query(SavedItem)
        .outerjoin(Transcript, Transcript.saved_item_id == SavedItem.id)
        .filter(
            SavedItem.user_id == current_user.id,
            or_(
                SavedItem.title.ilike(pattern),
                SavedItem.source_type.ilike(pattern),
                Transcript.raw_text.ilike(pattern),
            ),
        )
        .order_by(SavedItem.created_at.desc())
        .distinct()
        .all()
    )
    for item in keyword_items:
        if item.id not in seen:
            seen.add(item.id)
            ranked_ids.append(item.id)

    if not ranked_ids:
        return []

    items_by_id = {item.id: item for item in db.query(SavedItem).filter(SavedItem.id.in_(ranked_ids)).all()}
    transcripts = db.query(Transcript).filter(Transcript.saved_item_id.in_(ranked_ids)).all()
    transcript_by_item = {t.saved_item_id: t.raw_text for t in transcripts}

    return [
        _to_out(items_by_id[item_id], transcript_by_item.get(item_id))
        for item_id in ranked_ids
        if item_id in items_by_id
    ]


@router.get("/{item_id}", response_model=SavedItemOut)
def get_saved_item(
    item_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = _fetch_owned_item(db, item_id, current_user)
    transcript = db.query(Transcript).filter(Transcript.saved_item_id == item.id).first()
    folder_name = None
    if item.folder_id is not None:
        folder = db.get(Folder, item.folder_id)
        folder_name = folder.name if folder else None
    return _to_out(item, transcript.raw_text if transcript else None, folder_name)


@router.patch("/{item_id}", response_model=SavedItemOut)
def update_saved_item(
    item_id: uuid.UUID,
    payload: SavedItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = _fetch_owned_item(db, item_id, current_user)
    fields = payload.model_dump(exclude_unset=True)

    if "content" in fields and item.source_type != "note":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only notes support editing content",
        )

    if "title" in fields:
        title = fields["title"].strip() if fields["title"] and fields["title"].strip() else None
        item.title = title

    transcript = db.query(Transcript).filter(Transcript.saved_item_id == item.id).first()

    if "content" in fields:
        content = (fields["content"] or "").strip()
        if not content:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="content cannot be empty")

        if transcript is None:
            transcript = Transcript(saved_item_id=item.id, raw_text=content)
            db.add(transcript)
        else:
            transcript.raw_text = content

        db.query(Chunk).filter(Chunk.saved_item_id == item.id).delete(synchronize_session=False)
        db.flush()
        store_chunks(db, item, content, segments=[], content_type="note")

    db.commit()
    db.refresh(item)

    transcript = db.query(Transcript).filter(Transcript.saved_item_id == item.id).first()
    folder_name = None
    if item.folder_id is not None:
        folder = db.get(Folder, item.folder_id)
        folder_name = folder.name if folder else None

    if "content" in fields:
        enqueue_recompute_folders(current_user.id)

    return _to_out(item, transcript.raw_text if transcript else None, folder_name)


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_saved_item(
    item_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = (
        db.query(SavedItem)
        .filter(SavedItem.id == item_id, SavedItem.user_id == current_user.id)
        .first()
    )
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Saved item not found")

    transcript_ids = [
        t.id for t in db.query(Transcript.id).filter(Transcript.saved_item_id == item.id).all()
    ]
    if transcript_ids:
        db.query(TranscriptSegment).filter(TranscriptSegment.transcript_id.in_(transcript_ids)).delete(
            synchronize_session=False
        )
        db.query(Transcript).filter(Transcript.id.in_(transcript_ids)).delete(synchronize_session=False)

    db.query(Chunk).filter(Chunk.saved_item_id == item.id).delete(synchronize_session=False)

    if item.uploaded_file_path and os.path.exists(item.uploaded_file_path):
        os.remove(item.uploaded_file_path)

    db.delete(item)
    db.commit()


@router.get("/{item_id}/segments", response_model=list[SegmentOut])
def get_saved_item_segments(
    item_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = _fetch_owned_item(db, item_id, current_user)
    transcript = db.query(Transcript).filter(Transcript.saved_item_id == item.id).first()
    if transcript is None:
        return []

    return (
        db.query(TranscriptSegment)
        .filter(TranscriptSegment.transcript_id == transcript.id)
        .order_by(TranscriptSegment.start_time)
        .all()
    )


@router.get("/{item_id}/audio")
def get_saved_item_audio(
    item_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = _fetch_owned_item(db, item_id, current_user)

    if item.source_type != "voice_note" or not item.uploaded_file_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No audio available for this item")

    if not os.path.exists(item.uploaded_file_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Audio file not found on disk")

    ext = os.path.splitext(item.uploaded_file_path)[1].lower()
    media_type = AUDIO_MIME_TYPES.get(ext) or mimetypes.guess_type(item.uploaded_file_path)[0] or "application/octet-stream"
    return FileResponse(item.uploaded_file_path, media_type=media_type)
