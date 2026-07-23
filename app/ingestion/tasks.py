import logging
import uuid

from app.database import SessionLocal
from app.ingestion import article, media, youtube
from app.ingestion.common import IngestionError
from app.models.models import SavedItem, Transcript, TranscriptSegment

logger = logging.getLogger(__name__)

HANDLERS = {
    "article": lambda item: article.process(item.source_url),
    "youtube": lambda item: youtube.process(item.source_url),
    "instagram": lambda item: media.process_uploaded_file(item.uploaded_file_path),
    "tiktok": lambda item: media.process_uploaded_file(item.uploaded_file_path),
    "voice_note": lambda item: media.process_uploaded_file(item.uploaded_file_path),
}


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

        if result.title:
            item.title = result.title
        item.status = "ready"
        db.commit()
    finally:
        db.close()
