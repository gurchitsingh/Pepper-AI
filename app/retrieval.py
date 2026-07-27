from sqlalchemy.orm import Session

from app.models.models import Chunk, SavedItem


def search_chunks(
    db: Session,
    query_embedding: list[float],
    user_id=None,
    content_type: str | None = None,
    top_k: int = 5,
) -> list[tuple[Chunk, SavedItem]]:
    """Cosine-distance nearest-neighbor search over chunk embeddings (pgvector).
    Returns (Chunk, SavedItem) pairs, closest first. `user_id` scopes results to one
    user's saved items (omit only for admin/debug use); `content_type` optionally
    filters to one source_type (e.g. "article", "youtube")."""
    query = (
        db.query(Chunk, SavedItem)
        .join(SavedItem, SavedItem.id == Chunk.saved_item_id)
        .filter(Chunk.embedding.isnot(None))
    )
    if user_id is not None:
        query = query.filter(SavedItem.user_id == user_id)
    if content_type is not None:
        query = query.filter(Chunk.content_type == content_type)

    return query.order_by(Chunk.embedding.cosine_distance(query_embedding)).limit(top_k).all()
