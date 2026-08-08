import logging
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
from app.schemas import ChatRequest, ChatResponse, ChatSource, SuggestedQuestionsOut, WebSource
from app.models.models import Chunk, SavedItem, User
from app.web_search import WebSearchError, web_search

load_dotenv()

logger = logging.getLogger(__name__)

router = APIRouter(tags=["chat"])

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
# "latest" alias (not a pinned version) so Google retiring a specific dated model
# doesn't silently 404 this endpoint again -- see chat_model_choice in CLAUDE.md.
GEMINI_MODEL = "gemini-flash-latest"
TOP_K = 5
WEB_TOP_K = 5

# How many of the user's most-recently-ready items to consider as suggestion
# material, and how many candidate questions to ask Gemini for. We generate
# more than the UI shows at once (see suggestedQuestionsFromContent on the
# frontend) so it can rotate/exclude already-asked ones without refetching.
MAX_SUGGESTION_ITEMS = 12
SUGGESTION_COUNT = 8
MAX_SNIPPET_CHARS = 600

SUGGESTIONS_PROMPT = (
    "Below are excerpts from things a user has saved (notes, articles, videos, voice "
    "memos, documents). Write {count} short questions the user might genuinely want to "
    "ask about this content. Each question must be specific -- reference an actual "
    "topic, fact, name, or detail that appears in one of the excerpts, not a generic "
    "question like 'What is this about?' or 'What did I save?'. Each question should be "
    "answerable using only the excerpt it's based on. Keep each question under 15 words. "
    "Return exactly {count} questions, covering a mix of the different excerpts rather "
    "than repeatedly asking about the same one."
)

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


def _content_snippets(db: Session, items: list[SavedItem]) -> dict:
    """Representative body text per item, built from actual chunk content (not
    just the title) so suggestion questions can reference real topics/facts.
    Concatenates chunks in order up to a char budget rather than just the
    first one, since an opening chunk (e.g. a video's first few seconds) is
    often less informative than the piece as a whole."""
    item_ids = [item.id for item in items]
    chunks = (
        db.query(Chunk)
        .filter(Chunk.saved_item_id.in_(item_ids))
        .order_by(Chunk.saved_item_id, Chunk.chunk_index)
        .all()
    )
    chunks_by_item: dict = {}
    for c in chunks:
        chunks_by_item.setdefault(c.saved_item_id, []).append(c)

    snippets = {}
    for item in items:
        parts = []
        total = 0
        for c in chunks_by_item.get(item.id, []):
            text = c.text.strip()
            if not text:
                continue
            parts.append(text)
            total += len(text)
            if total >= MAX_SNIPPET_CHARS:
                break
        snippet = " ".join(parts)[:MAX_SNIPPET_CHARS]
        snippets[item.id] = snippet or (item.title or f"{item.source_type} item")
    return snippets


@router.get("/chat/suggested-questions", response_model=SuggestedQuestionsOut)
def get_suggested_questions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Content-grounded chat suggestions: pulls real excerpts from the user's
    saved items and asks Gemini for specific questions those excerpts can
    answer, rather than the generic title-template questions the frontend
    falls back to. Returns an empty list (never an error) whenever this isn't
    possible -- no key, no ready items, or a Gemini failure -- so the caller
    can fall back to that title-based path."""
    items = (
        db.query(SavedItem)
        .filter(SavedItem.user_id == current_user.id, SavedItem.status == "ready")
        .order_by(SavedItem.created_at.desc())
        .limit(MAX_SUGGESTION_ITEMS)
        .all()
    )
    if not items or not GOOGLE_API_KEY:
        return SuggestedQuestionsOut(questions=[])

    snippets = _content_snippets(db, items)
    sections = []
    for item in items:
        label = item.title or f"{item.source_type} item"
        sections.append(f"[{label}]\n{snippets[item.id]}")
    prompt = SUGGESTIONS_PROMPT.format(count=SUGGESTION_COUNT) + "\n\n" + "\n\n".join(sections)

    try:
        client = genai.Client(api_key=GOOGLE_API_KEY)
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=SuggestedQuestionsOut,
            ),
        )
        parsed: SuggestedQuestionsOut = response.parsed
        questions = [q.strip() for q in parsed.questions if q.strip()][:SUGGESTION_COUNT]
        return SuggestedQuestionsOut(questions=questions)
    except Exception as e:
        logger.warning("Suggested-question generation via Gemini failed, falling back: %s", e)
        return SuggestedQuestionsOut(questions=[])
