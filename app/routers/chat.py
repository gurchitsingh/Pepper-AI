import os

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, status
from google import genai
from google.genai import types
from google.genai.errors import APIError
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.embeddings import EmbeddingError, embed_texts
from app.retrieval import search_chunks
from app.schemas import ChatRequest, ChatResponse, ChatSource, WebSource
from app.models.models import User
from app.web_search import WebSearchError, web_search

load_dotenv()

router = APIRouter(tags=["chat"])

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
# "latest" alias (not a pinned version) so Google retiring a specific dated model
# doesn't silently 404 this endpoint again -- see chat_model_choice in CLAUDE.md.
GEMINI_MODEL = "gemini-flash-latest"
TOP_K = 5
WEB_TOP_K = 5

# Sentinel the model returns when saved-content excerpts can't answer the question,
# so the endpoint can fall back to a live web search instead of parsing prose.
INSUFFICIENT_CONTEXT_TOKEN = "INSUFFICIENT_CONTEXT"

SYSTEM_PROMPT = (
    "You answer questions using ONLY the provided excerpts from the user's own saved "
    "content. If the excerpts don't contain enough information to answer the question, "
    f"respond with exactly the token {INSUFFICIENT_CONTEXT_TOKEN} and nothing else -- "
    "do not guess or use outside knowledge."
)

WEB_SYSTEM_PROMPT = (
    "You answer questions using ONLY the provided live web search results. Answer "
    "clearly and concisely based on those results; do not use outside knowledge beyond "
    "what they contain."
)


def _generate(client: genai.Client, system_prompt: str, user_message: str) -> str:
    try:
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=user_message,
            config=types.GenerateContentConfig(system_instruction=system_prompt),
        )
    except APIError as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Gemini request failed: {e}")
    return response.text


def _answer_from_web(client: genai.Client, question: str) -> ChatResponse:
    try:
        results = web_search(question, max_results=WEB_TOP_K)
    except WebSearchError as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))

    if not results:
        return ChatResponse(
            answer="I couldn't find anything relevant in your saved content or a live web search for that.",
            answer_source="web_search",
        )

    context_blocks = []
    web_sources = []
    for result in results:
        title = result.get("title")
        url = result.get("url")
        content = result.get("content")
        context_blocks.append(f"[{title or url}]\n{content}")
        web_sources.append(WebSource(title=title, url=url, content=content))

    context = "\n\n---\n\n".join(context_blocks)
    user_message = f"Web search results:\n\n{context}\n\nQuestion: {question}"
    answer = _generate(client, WEB_SYSTEM_PROMPT, user_message)

    return ChatResponse(answer=answer, web_sources=web_sources, answer_source="web_search")


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

    client = genai.Client(api_key=GOOGLE_API_KEY)

    if not results:
        return _answer_from_web(client, payload.question)

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

    answer = _generate(client, SYSTEM_PROMPT, user_message)

    if answer.strip() == INSUFFICIENT_CONTEXT_TOKEN:
        return _answer_from_web(client, payload.question)

    return ChatResponse(answer=answer, sources=sources, answer_source="saved_content")
