import os

import google.generativeai as genai
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, status
from google.api_core.exceptions import GoogleAPIError
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.embeddings import EmbeddingError, embed_texts
from app.retrieval import search_chunks
from app.schemas import ChatRequest, ChatResponse, ChatSource
from app.models.models import User

load_dotenv()

router = APIRouter(tags=["chat"])

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
# "latest" alias (not a pinned version) so Google retiring a specific dated model
# doesn't silently 404 this endpoint again -- see chat_model_choice in CLAUDE.md.
GEMINI_MODEL = "gemini-flash-latest"
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

    if not GOOGLE_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="GOOGLE_API_KEY is not set in .env. Get one at https://aistudio.google.com/apikey",
        )

    try:
        [query_vector] = embed_texts([payload.question], input_type="query")
    except EmbeddingError as e:
        raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail=str(e))

    results = search_chunks(db, query_vector, user_id=current_user.id, top_k=TOP_K)

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

    genai.configure(api_key=GOOGLE_API_KEY)
    model = genai.GenerativeModel(GEMINI_MODEL, system_instruction=SYSTEM_PROMPT)
    try:
        response = model.generate_content(user_message)
    except GoogleAPIError as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Gemini request failed: {e}")
    answer = response.text

    return ChatResponse(answer=answer, sources=sources)
