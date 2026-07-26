"""One-off backfill: converts Devanagari script in existing transcripts/segments to
Roman script (ITRANS), retroactively applying the same normalization the ingestion
pipeline now does going forward. Safe to re-run -- rows with no Devanagari are skipped.
"""
import sys

sys.path.insert(0, r"C:\Users\user\OneDrive\Desktop\Pepper AI\Weave AI")

from app.database import SessionLocal
from app.ingestion.transliteration import DEVANAGARI_RE, transliterate_devanagari
from app.models.models import Transcript, TranscriptSegment


def backfill():
    db = SessionLocal()
    changed = 0
    try:
        transcripts = db.query(Transcript).filter(Transcript.raw_text.op("~")("[ऀ-ॿ]")).all()
        for t in transcripts:
            before = t.raw_text
            after = transliterate_devanagari(before)
            if after != before:
                print(f"\n--- transcript {t.id} ---")
                print(f"BEFORE: {before}")
                print(f"AFTER:  {after}")
                t.raw_text = after
                changed += 1

        segments = db.query(TranscriptSegment).filter(TranscriptSegment.text.op("~")("[ऀ-ॿ]")).all()
        for s in segments:
            before = s.text
            after = transliterate_devanagari(before)
            if after != before:
                print(f"\n--- segment {s.id} (transcript {s.transcript_id}) ---")
                print(f"BEFORE: {before}")
                print(f"AFTER:  {after}")
                s.text = after
                changed += 1

        db.commit()
        print(f"\nDone. {changed} row(s) updated.")

        remaining = (
            db.query(Transcript).filter(Transcript.raw_text.op("~")("[ऀ-ॿ]")).count()
            + db.query(TranscriptSegment).filter(TranscriptSegment.text.op("~")("[ऀ-ॿ]")).count()
        )
        print(f"Rows still containing Devanagari after backfill: {remaining}")
    finally:
        db.close()


if __name__ == "__main__":
    backfill()
