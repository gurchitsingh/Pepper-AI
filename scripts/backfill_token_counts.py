"""One-off backfill: recomputes chunks.token_count with the real tiktoken tokenizer
for chunks that still hold the old len//4 heuristic value. Safe to re-run.
"""
import sys

sys.path.insert(0, r"C:\Users\user\OneDrive\Desktop\Pepper AI\Weave AI")

from app.database import SessionLocal
from app.ingestion.chunking import estimate_tokens
from app.models.models import Chunk


def backfill():
    db = SessionLocal()
    try:
        chunks = db.query(Chunk).all()
        updated = 0
        for chunk in chunks:
            old = chunk.token_count
            new = estimate_tokens(chunk.text)
            if new != old:
                print(f"{chunk.id}  {old} -> {new}")
                chunk.token_count = new
                updated += 1

        db.commit()
        print(f"\nDone. Updated token_count for {updated}/{len(chunks)} chunk(s).")
    finally:
        db.close()


if __name__ == "__main__":
    backfill()
