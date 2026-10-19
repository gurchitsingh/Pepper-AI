from sqlalchemy.orm import Session

from app.models.models import Chunk, SavedItem

# pgvector cosine_distance ranges 0 (identical) to 2 (opposite). Without a cutoff,
# `.limit(top_k)` always returns the k nearest chunks even when none of them are
# actually related to the query -- a query about an unrelated topic would still
# surface someone's saved recipe simply because it's the "closest" thing on file.
# This is a first-pass default; tighten or loosen it once there's real query data
# to calibrate against.
DEFAULT_MAX_COSINE_DISTANCE = 0.8


def search_chunks(
    db: Session,
    query_embedding: list[float],
    user_id=None,
    content_type: str | None = None,
    top_k: int = 5,
    max_distance: float | None = DEFAULT_MAX_COSINE_DISTANCE,
) -> list[tuple[Chunk, SavedItem]]:
    """Cosine-distance nearest-neighbor search over chunk embeddings (pgvector).
    Returns (Chunk, SavedItem) pairs, closest first. `user_id` scopes results to one
    user's saved items (omit only for admin/debug use); `content_type` optionally
    filters to one source_type (e.g. "article", "youtube"); `max_distance` drops
    chunks beyond that cosine distance so unrelated content isn't returned just to
    fill out `top_k` (pass None to disable the cutoff)."""
    distance = Chunk.embedding.cosine_distance(query_embedding)
    query = (
        db.query(Chunk, SavedItem)
        .join(SavedItem, SavedItem.id == Chunk.saved_item_id)
        .filter(Chunk.embedding.isnot(None))
    )
    if user_id is not None:
        query = query.filter(SavedItem.user_id == user_id)
    if content_type is not None:
        query = query.filter(Chunk.content_type == content_type)
    if max_distance is not None:
        query = query.filter(distance < max_distance)

    return query.order_by(distance).limit(top_k).all()
