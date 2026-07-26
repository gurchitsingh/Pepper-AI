"""Generates embeddings for every chunk that doesn't have one yet, via Voyage AI.
Requires VOYAGE_API_KEY to be set in .env. Safe to re-run -- only chunks with
embedding IS NULL are processed.
"""
import sys

sys.path.insert(0, r"C:\Users\user\OneDrive\Desktop\Pepper AI\Weave AI")

from app.database import SessionLocal
from app.embeddings import embed_texts
from app.models.models import Chunk

BATCH_SIZE = 100


def run():
    db = SessionLocal()
    try:
        pending = db.query(Chunk).filter(Chunk.embedding.is_(None)).all()
        print(f"{len(pending)} chunk(s) need embeddings.")

        for i in range(0, len(pending), BATCH_SIZE):
            batch = pending[i : i + BATCH_SIZE]
            vectors = embed_texts([c.text for c in batch], input_type="document")
            for chunk, vector in zip(batch, vectors):
                chunk.embedding = vector
            db.commit()
            print(f"  embedded {i + len(batch)}/{len(pending)}")

        print("Done.")
    finally:
        db.close()


if __name__ == "__main__":
    run()
