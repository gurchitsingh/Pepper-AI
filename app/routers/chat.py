import os

import anthropic
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.embeddings import EmbeddingError, embed_texts
from app.models.models import Chunk, SavedItem, User
from app.schemas import ChatRequest, ChatResponse, ChatSource

load_dotenv()

router = APIRouter(tags=["chat"])

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
CLAUDE_MODEL = "claude-sonnet-5"
TOP_K = 5

SYSTEM_PROMPT = (
    "You answer questions using ONLY the provided excerpts from the user's own saved "
    "content. If the excerpts don't contain enough information to answer, say so plainly "
    "rather than guessing or using outside knowledge."
)


@router.post("/chat", response_model=ChatResponse)
def chat(
    payload: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not payload.question or not payload.question.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="question is required")

    if not ANTHROPIC_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="ANTHROPIC_API_KEY is not set in .env. Get one at https://console.anthropic.com/settings/keys",
        )

    try:
        [query_vector] = embed_texts([payload.question], input_type="query")
    except EmbeddingError as e:
        raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail=str(e))

    results = (
        db.query(Chunk, SavedItem)
        .join(SavedItem, SavedItem.id == Chunk.saved_item_id)
        .filter(SavedItem.user_id == current_user.id, Chunk.embedding.isnot(None))
        .order_by(Chunk.embedding.cosine_distance(query_vector))
        .limit(TOP_K)
        .all()
    )

    if not results:
        return ChatResponse(
            answer="I don't have any saved content with embeddings yet to answer that from.",
            sources=[],
        )

    context_blocks = []
    sources = []
    for chunk, item in results:
        label = item.title or f"{item.source_type} item"
        context_blocks.append(f"[{label}]\n{chunk.text}")
        sources.append(
            ChatSource(
                saved_item_id=item.id,
                title=item.title,
                source_type=item.source_type,
                chunk_text=chunk.text,
                start_time=chunk.start_time,
                end_time=chunk.end_time,
            )
        )

    context = "\n\n---\n\n".join(context_blocks)
    user_message = f"Context from the user's saved content:\n\n{context}\n\nQuestion: {payload.question}"

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    message = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}],
    )
    answer = "".join(block.text for block in message.content if block.type == "text")

    return ChatResponse(answer=answer, sources=sources)
