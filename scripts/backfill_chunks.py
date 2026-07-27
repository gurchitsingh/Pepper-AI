"""One-off backfill: creates Chunk rows for saved_items that reached `ready` status
before chunking existed. Safe to re-run -- items that already have chunks are skipped.
"""
import sys

sys.path.insert(0, r"C:\Users\user\OneDrive\Desktop\Pepper AI\Weave AI")

from app.database import SessionLocal
from app.ingestion.common import Segment
from app.ingestion.tasks import store_chunks
from app.models.models import Chunk, SavedItem, Transcript, TranscriptSegment


def backfill():
    db = SessionLocal()
    try:
        items = db.query(SavedItem).filter(SavedItem.status == "ready").all()
        created = 0
        for item in items:
            already = db.query(Chunk).filter(Chunk.saved_item_id == item.id).count()
            if already:
                continue

            transcript = db.query(Transcript).filter(Transcript.saved_item_id == item.id).first()
            if transcript is None:
                continue

            ts_rows = (
                db.query(TranscriptSegment)
                .filter(TranscriptSegment.transcript_id == transcript.id)
                .order_by(TranscriptSegment.start_time)
                .all()
            )
            segments = [Segment(start=t.start_time, end=t.end_time, text=t.text) for t in ts_rows]

            n = store_chunks(db, item.id, transcript.raw_text, segments, content_type=item.source_type)
            print(f"{item.source_type:10s} {item.id}  ->  {n} chunk(s)")
            created += 1

        db.commit()
        print(f"\nDone. Backfilled chunks for {created} saved_item(s).")
    finally:
        db.close()


if __name__ == "__main__":
    backfill()
