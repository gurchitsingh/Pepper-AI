import logging
import uuid

from app.database import SessionLocal
from app.embeddings import EmbeddingError, embed_texts
from app.ingestion import article, document, media, youtube
from app.ingestion.chunking import chunk_segments, chunk_text
from app.ingestion.common import IngestionError
from app.models.models import Chunk, SavedItem, Transcript, TranscriptSegment

logger = logging.getLogger(__name__)

HANDLERS = {
    "article": lambda item: article.process(item.source_url),
    "youtube": lambda item: youtube.process(item.source_url),
    "instagram": lambda item: media.process_uploaded_file(item.uploaded_file_path),
    "tiktok": lambda item: media.process_uploaded_file(item.uploaded_file_path),
    "voice_note": lambda item: media.process_uploaded_file(item.uploaded_file_path),
    "document": lambda item: document.process_uploaded_document(item.uploaded_file_path),
}


def store_chunks(db, saved_item_id, raw_text: str, segments) -> int:
    """Chunks by timed segments when available (YouTube/Whisper), otherwise by
    paragraph/char count (articles, notes). Persists Chunk rows with chunk_index,
    embedding each chunk via Voyage AI if VOYAGE_API_KEY is configured.

    If embedding fails (most commonly: no key configured yet), chunks are still
    stored with embedding left NULL -- ingestion must not fail just because
    embeddings aren't available yet. `scripts/generate_embeddings.py` backfills
    any chunk with a NULL embedding once a key is available.
    Returns the number of chunks created.
    """
    chunks = chunk_segments(segments) if segments else chunk_text(raw_text)
    if not chunks:
        return 0

    vectors = [None] * len(chunks)
    try:
        vectors = embed_texts([c.text for c in chunks], input_type="document")
    except EmbeddingError as e:
        logger.warning("Embedding skipped for saved_item %s: %s", saved_item_id, e)

    for index, (c, vector) in enumerate(zip(chunks, vectors)):
        db.add(
            Chunk(
                saved_item_id=saved_item_id,
                text=c.text,
                start_time=c.start_time,
                end_time=c.end_time,
                chunk_index=index,
                embedding=vector,
            )
        )
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

        store_chunks(db, item.id, result.raw_text, result.segments)

        if result.title:
            item.title = result.title
        item.status = "ready"
        db.commit()
    finally:
        db.close()
