import json
import os
from typing import Iterator

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from google import genai
from google.genai import types
from google.genai.errors import APIError
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.embeddings import EmbeddingError, embed_texts
from app.retrieval import search_chunks
from app.schemas import ChatRequest, ChatSource, WebSource
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


def _generate_stream(client: genai.Client, system_prompt: str, user_message: str) -> Iterator[str]:
    for chunk in client.models.generate_content_stream(
        model=GEMINI_MODEL,
        contents=user_message,
        config=types.GenerateContentConfig(system_instruction=system_prompt),
    ):
        if chunk.text:
            yield chunk.text


def _sse(event_type: str, **data) -> str:
    return f"data: {json.dumps({'type': event_type, **data})}\n\n"


def _stream_web_answer(client: genai.Client, question: str) -> Iterator[str]:
    try:
        results = web_search(question, max_results=WEB_TOP_K)
    except WebSearchError as e:
        yield _sse("error", detail=str(e))
        return

    if not results:
        yield _sse(
            "chunk", text="I couldn't find anything relevant in your saved content or a live web search for that."
        )
        yield _sse("done", sources=[], web_sources=[], answer_source="web_search")
        return

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

    for piece in _generate_stream(client, WEB_SYSTEM_PROMPT, user_message):
        yield _sse("chunk", text=piece)

    yield _sse(
        "done",
        sources=[],
        web_sources=[s.model_dump(mode="json") for s in web_sources],
        answer_source="web_search",
    )


def _stream_saved_content_answer(
    client: genai.Client, question: str, results, sources: list[ChatSource]
) -> Iterator[str]:
    context_blocks = []
    for chunk, item in results:
        label = item.title or f"{item.source_type} item"
        context_blocks.append(f"[{label}]\n{chunk.text}")

    context = "\n\n---\n\n".join(context_blocks)
    user_message = f"Context from the user's saved content:\n\n{context}\n\nQuestion: {question}"

    # The model may answer with exactly INSUFFICIENT_CONTEXT_TOKEN and nothing else, which
    # should trigger a silent fallback to web search rather than being shown to the user.
    # Buffer just past the sentinel's length before forwarding anything, so we can still
    # discard it and switch to the web-search stream without the sentinel ever reaching the client.
    piece_iter = _generate_stream(client, SYSTEM_PROMPT, user_message)
    buffer = ""
    for piece in piece_iter:
        buffer += piece
        if len(buffer) > len(INSUFFICIENT_CONTEXT_TOKEN):
            break

    if buffer.strip() == INSUFFICIENT_CONTEXT_TOKEN:
        for _ in piece_iter:  # drain in case the model kept generating past the sentinel
            pass
        yield from _stream_web_answer(client, question)
        return

    if buffer:
        yield _sse("chunk", text=buffer)
    for piece in piece_iter:
        yield _sse("chunk", text=piece)

    yield _sse(
        "done",
        sources=[s.model_dump(mode="json") for s in sources],
        web_sources=[],
        answer_source="saved_content",
    )


@router.post("/chat")
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

    sources = [
        ChatSource(
            saved_item_id=item.id,
            title=item.title,
            source_type=item.source_type,
            chunk_text=chunk.text,
            start_time=chunk.start_time,
            end_time=chunk.end_time,
        )
        for chunk, item in results
    ]

    def generate() -> Iterator[str]:
        try:
            if not results:
                yield from _stream_web_answer(client, payload.question)
            else:
                yield from _stream_saved_content_answer(client, payload.question, results, sources)
        except APIError as e:
            yield _sse("error", detail=f"Gemini request failed: {e}")

    return StreamingResponse(generate(), media_type="text/event-stream")
