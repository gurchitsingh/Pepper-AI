"""Generates embeddings for every chunk that doesn't have one yet, via Voyage AI.
Requires VOYAGE_API_KEY to be set in .env. Safe to re-run -- only chunks with
embedding IS NULL are processed.

Batch size and pause are tuned for Voyage AI's free tier (3 requests/min,
10K tokens/min, no payment method on file): 15 chunks/batch keeps even a
worst-case batch (observed max ~478 tokens/chunk) under 10K tokens, and a
22s pause caps requests at fewer than 3/min.
"""
import sys
import time

import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.embeddings import embed_texts
from app.models.models import Chunk

BATCH_SIZE = 15
PAUSE_SECONDS = 22


def run():
    db = SessionLocal()
    try:
        pending = db.query(Chunk).filter(Chunk.embedding.is_(None)).all()
        print(f"{len(pending)} chunk(s) need embeddings.")

        batches = list(range(0, len(pending), BATCH_SIZE))
        for batch_num, i in enumerate(batches, start=1):
            batch = pending[i : i + BATCH_SIZE]
            print(
                f"Batch {batch_num}/{len(batches)}: embedding chunks "
                f"{i + 1}-{i + len(batch)} of {len(pending)}..."
            )
            vectors = embed_texts([c.text for c in batch], input_type="document")
            for chunk, vector in zip(batch, vectors):
                chunk.embedding = vector
            db.commit()
            print(f"  embedded {i + len(batch)}/{len(pending)}")

            if batch_num < len(batches):
                print(f"  pausing {PAUSE_SECONDS}s to stay under Voyage's free-tier rate limit...")
                time.sleep(PAUSE_SECONDS)

        print("Done.")
    finally:
        db.close()


if __name__ == "__main__":
    run()
