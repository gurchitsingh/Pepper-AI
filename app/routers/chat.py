import logging
import json
import os
import uuid
from datetime import datetime, timezone
from typing import Iterator

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from groq import APIError, Groq
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import SessionLocal, get_db
from app.embeddings import EmbeddingError, embed_texts
from app.retrieval import search_chunks
from app.schemas import ChatRequest, ChatSource, SuggestedQuestionsOut, WebSource
from app.models.models import ChatMessage, ChatSession, Chunk, SavedItem, User
from app.routers.chat_sessions import add_message, fetch_owned_session
from app.web_search import WebSearchError, web_search

load_dotenv()

logger = logging.getLogger(__name__)

router = APIRouter(tags=["chat"])

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
# Confirmed against this account's actual /v1/models list -- Groq gates some
# models per-account, so not every model in their general docs is available here.
GROQ_CHAT_MODEL = "openai/gpt-oss-120b"
TOP_K = 5
WEB_TOP_K = 5
# Without this, a model-side stall (seen in practice with Gemini during quota/demand
# pressure -- the request neither errors nor streams anything) leaves the request
# hanging indefinitely, which also means the frontend's `loading` flag never clears
# and silently blocks every later message for the rest of the session.
GROQ_TIMEOUT_S = 30

# Follow-up context: how many prior user/assistant pairs the model sees, and a hard
# character budget so one long answer can't swamp the prompt. The budget is spent
# newest-first (the most recent turn matters most for resolving "it"/"this"), and
# any single message is also capped so one huge turn can't use up the whole budget.
HISTORY_TURNS = 3
HISTORY_MAX_CHARS = 4000
HISTORY_MESSAGE_MAX_CHARS = 1500

# How many of the user's most-recently-ready items to consider as suggestion
# material, and how many candidate questions to ask the model for. We generate
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
    "do not guess or use outside knowledge. The earlier conversation may be included "
    "before the current question; use it only to work out what words like \"it\", "
    "\"this\", \"that reel\" or \"tell me more\" refer to. Facts in your answer must "
    "still come from the provided excerpts, not from your own earlier replies."
)

WEB_SYSTEM_PROMPT = (
    "You answer questions using ONLY the provided live web search results -- not your own "
    "training knowledge, which can be out of date. The results were fetched just now and "
    "take priority over anything you already believe, especially for questions about "
    "current events, standings, scores, or anything else that changes over time. When "
    "results include dates, use the most recent one rather than defaulting to a fact you "
    "recall from training. Answer clearly and concisely based on those results; do not "
    "add outside knowledge beyond what they contain. The earlier conversation may be "
    "included before the current question; use it only to work out what the question "
    "refers to (e.g. \"and last year?\"), not as a source of facts."
)


def _generate_stream(
    client: Groq,
    system_prompt: str,
    user_message: str,
    history: list[dict] | None = None,
) -> Iterator[str]:
    # `history` is prior {"role", "content"} turns, placed between the system prompt and
    # the current message. The excerpts / web results live only in `user_message`.
    stream = client.chat.completions.create(
        model=GROQ_CHAT_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            *(history or []),
            {"role": "user", "content": user_message},
        ],
        stream=True,
        # Grounded Q&A needs to reliably follow "use ONLY these excerpts" --
        # at default temperature this model occasionally decides on its own
        # that sufficient context is insufficient (confirmed: the same prompt
        # that answered correctly non-deterministically emitted the
        # INSUFFICIENT_CONTEXT sentinel on another run with no code change).
        temperature=0,
    )
    for chunk in stream:
        delta = chunk.choices[0].delta.content
        if delta:
            yield delta


def _sse(event_type: str, **data) -> str:
    return f"data: {json.dumps({'type': event_type, **data})}\n\n"


def _friendly_groq_error(e: APIError) -> str:
    """Maps a raw Groq APIError to a short, user-presentable message, logging
    the full error server-side rather than showing it verbatim in a chat reply."""
    status_code = getattr(e, "status_code", None)
    logger.warning("Groq request failed (status=%s): %s", status_code, e)
    if status_code == 429:
        return "Pepper's hit its AI usage limit. Please try again later."
    if status_code in (500, 502, 503):
        return "Pepper's AI service is temporarily overloaded. Please try again in a moment."
    return "Pepper couldn't reach its AI service right now. Please try again."


def _stream_web_answer(client: Groq, question: str, history: list[dict] | None = None) -> Iterator[str]:
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
    # Anchors "most recent" to an actual date -- without it the model has no way to
    # judge which of several differently-dated results is current, and tends to fall
    # back on whatever it already "knows" from training instead of reading dates in
    # the search results themselves.
    today = datetime.now(timezone.utc).strftime("%B %d, %Y")
    user_message = f"Today's date: {today}\n\nWeb search results:\n\n{context}\n\nQuestion: {question}"

    for piece in _generate_stream(client, WEB_SYSTEM_PROMPT, user_message, history):
        yield _sse("chunk", text=piece)

    yield _sse(
        "done",
        sources=[],
        web_sources=[s.model_dump(mode="json") for s in web_sources],
        answer_source="web_search",
    )


def _stream_saved_attempt(
    client: Groq, question: str, results, history: list[dict] | None
) -> Iterator[str]:
    """Asks the model to answer from `results`. Yields `chunk` events and returns True
    if it answered; returns False (having yielded nothing) if it replied with the
    INSUFFICIENT_CONTEXT sentinel, so the caller can try other excerpts or the web."""
    context_blocks = []
    for chunk, item in results:
        label = item.title or f"{item.source_type} item"
        context_blocks.append(f"[{label}]\n{chunk.text}")

    context = "\n\n---\n\n".join(context_blocks)
    user_message = f"Context from the user's saved content:\n\n{context}\n\nQuestion: {question}"

    # The model may answer with exactly INSUFFICIENT_CONTEXT_TOKEN and nothing else, which
    # should trigger a fallback rather than being shown to the user. Buffer just past the
    # sentinel's length before forwarding anything, so it can still be discarded without
    # ever reaching the client -- this holds on every attempt, including the carry-over retry.
    piece_iter = _generate_stream(client, SYSTEM_PROMPT, user_message, history)
    buffer = ""
    for piece in piece_iter:
        buffer += piece
        if len(buffer.lstrip()) > len(INSUFFICIENT_CONTEXT_TOKEN):
            break

    if buffer.lstrip().startswith(INSUFFICIENT_CONTEXT_TOKEN):
        for _ in piece_iter:  # drain in case the model kept generating past the sentinel
            pass
        return False

    if buffer:
        yield _sse("chunk", text=buffer)
    for piece in piece_iter:
        yield _sse("chunk", text=piece)
    return True


def _stream_answer(
    client: Groq,
    question: str,
    history: list[dict],
    results,
    sources: list[ChatSource],
    carry_results,
    carry_sources: list[ChatSource],
) -> Iterator[str]:
    """Saved-content answer with fallbacks, in order: the freshly retrieved excerpts,
    then the previous turn's excerpts (carry-over), then a live web search. The `done`
    event's sources are whichever excerpts the answer actually came from."""
    if results:
        if (yield from _stream_saved_attempt(client, question, results, history)):
            yield _sse(
                "done",
                sources=[s.model_dump(mode="json") for s in sources],
                web_sources=[],
                answer_source="saved_content",
            )
            return

    # Skip the retry if it would just repeat the same excerpts we already tried.
    if carry_results and {c.id for c, _ in carry_results} != {c.id for c, _ in results}:
        if (yield from _stream_saved_attempt(client, question, carry_results, history)):
            yield _sse(
                "done",
                sources=[s.model_dump(mode="json") for s in carry_sources],
                web_sources=[],
                answer_source="saved_content",
            )
            return

    yield from _stream_web_answer(client, question, history)


def _load_history(db: Session, session_id, user_id) -> list[ChatMessage]:
    """The last HISTORY_TURNS user/assistant pairs of a session, oldest first. Returns []
    for no/unknown/foreign sessions so /chat behaves exactly as before for a first
    message. Must run before the current user message is saved, or it would appear in
    its own history."""
    if session_id is None:
        return []
    owned = (
        db.query(ChatSession.id)
        .filter(ChatSession.id == session_id, ChatSession.user_id == user_id)
        .first()
    )
    if owned is None:
        return []
    rows = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.desc())
        .limit(HISTORY_TURNS * 2)
        .all()
    )
    return list(reversed(rows))


def _history_for_prompt(messages: list[ChatMessage]) -> list[dict]:
    """Applies the character budget, newest turns first, and shapes for the chat API."""
    kept: list[dict] = []
    remaining = HISTORY_MAX_CHARS
    for m in reversed(messages):
        if remaining <= 0:
            break
        text = (m.content or "").strip()[: min(HISTORY_MESSAGE_MAX_CHARS, remaining)]
        if not text:
            continue
        kept.append({"role": m.role, "content": text})
        remaining -= len(text)
    kept.reverse()
    # Don't open with an orphaned assistant reply left over after truncation.
    while kept and kept[0]["role"] != "user":
        kept.pop(0)
    return kept


def _carry_over(db: Session, messages: list[ChatMessage], user_id):
    """Re-fetches the chunks the previous assistant turn cited, if it answered from saved
    content. Goes back to the DB (matching saved_item_id + chunk text, scoped to the user)
    rather than trusting the stored text, so deleted or no-longer-owned items drop out."""
    prev = next((m for m in reversed(messages) if m.role == "assistant"), None)
    if prev is None or prev.answer_source != "saved_content" or not prev.sources:
        return [], []

    results, sources, seen = [], [], set()
    for src in prev.sources:
        try:
            item_id = uuid.UUID(str(src["saved_item_id"]))
            text = src["chunk_text"]
        except (KeyError, ValueError, TypeError):
            continue
        row = (
            db.query(Chunk, SavedItem)
            .join(SavedItem, SavedItem.id == Chunk.saved_item_id)
            .filter(
                SavedItem.user_id == user_id,
                Chunk.saved_item_id == item_id,
                Chunk.text == text,
            )
            .first()
        )
        if row is None or row[0].id in seen:
            continue
        seen.add(row[0].id)
        chunk, item = row
        results.append(row)
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
    return results, sources


@router.post("/chat")
def chat(
    payload: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not payload.question or not payload.question.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="question is required")

    if not GROQ_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="GROQ_API_KEY is not set in .env. Get one at https://console.groq.com/keys",
        )

    # Read prior turns first: the current message is saved just below and must not
    # show up in its own history.
    prior = _load_history(db, payload.session_id, current_user.id)
    history = _history_for_prompt(prior)
    prev_user = next((m.content for m in reversed(prior) if m.role == "user"), None)
    # A follow-up like "what is this about?" has no content words of its own, so retrieve
    # on it together with the previous question. The question alone is kept as a second
    # attempt so a genuinely new topic isn't diluted out of range by the old one.
    retrieval_query = f"{prev_user}\n{payload.question}" if prev_user else payload.question

    # Persist the session + user message before streaming so the conversation
    # exists (and is titled) even if the stream later fails or is aborted.
    if payload.session_id is not None:
        chat_session = fetch_owned_session(db, payload.session_id, current_user)
    else:
        chat_session = ChatSession(user_id=current_user.id)
        db.add(chat_session)
        db.commit()
        db.refresh(chat_session)
    add_message(db, chat_session, "user", payload.question)
    session_id = chat_session.id

    query_texts = [retrieval_query] if retrieval_query == payload.question else [retrieval_query, payload.question]
    vectors = None
    try:
        vectors = embed_texts(query_texts, input_type="query")
    except EmbeddingError as e:
        logger.warning("Query embedding failed, falling back to keyword matching: %s", e)
        vectors = None

    if vectors is not None:
        results = []
        for vector in vectors:
            results = search_chunks(db, vector, user_id=current_user.id, top_k=TOP_K)
            if results:
                break
    else:
        # Graceful fallback: match keywords across the user's saved content
        keywords = [w.lower().strip("?,.!'\"") for w in retrieval_query.split() if len(w) > 2]
        user_chunks = (
            db.query(Chunk, SavedItem)
            .join(SavedItem, SavedItem.id == Chunk.saved_item_id)
            .filter(SavedItem.user_id == current_user.id)
            .all()
        )
        scored = []
        for chunk, item in user_chunks:
            chunk_lower = chunk.text.lower()
            score = sum(1 for kw in keywords if kw in chunk_lower)
            scored.append((score, chunk, item))
        scored.sort(key=lambda x: x[0], reverse=True)
        results = [(c, item) for score, c, item in scored[:TOP_K] if score > 0]
        if not results and user_chunks:
            results = [(c, item) for _, c, item in scored[:TOP_K]]
    client = Groq(api_key=GROQ_API_KEY, timeout=GROQ_TIMEOUT_S)
    # Fetched eagerly (not lazily inside generate()) because the route's db session may be
    # closed by the time the stream runs; see save_assistant_message below.
    carry_results, carry_sources = _carry_over(db, prior, current_user.id)

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

    def save_assistant_message(text: str, done: dict) -> None:
        # The route's `db` may already be closed by the time this generator runs
        # (yield-dependency teardown vs. StreamingResponse ordering), so use a
        # short-lived session of our own for the final write.
        write_db = SessionLocal()
        try:
            owned = write_db.get(ChatSession, session_id)
            if owned is not None:
                add_message(
                    write_db,
                    owned,
                    "assistant",
                    text,
                    sources=done.get("sources"),
                    web_sources=done.get("web_sources"),
                    answer_source=done.get("answer_source"),
                )
        finally:
            write_db.close()

    def generate() -> Iterator[str]:
        yield _sse("session", session_id=str(session_id))
        answer = ""
        try:
            stream = _stream_answer(
                client, payload.question, history, results, sources, carry_results, carry_sources
            )
            for raw in stream:
                event = json.loads(raw[len("data: "):])
                if event["type"] == "chunk":
                    answer += event["text"]
                elif event["type"] == "done":
                    # Only a successfully finished stream is saved; an error event or
                    # a client abort (GeneratorExit) never reaches this point.
                    save_assistant_message(answer, event)
                    raw = _sse("done", **{k: v for k, v in event.items() if k != "type"}, session_id=str(session_id))
                yield raw
        except APIError as e:
            yield _sse("error", detail=_friendly_groq_error(e))
        except Exception as e:
            # Catches what APIError doesn't -- most notably the client-side
            # timeout above firing (httpx raises its own exception type, not
            # an APIError) when Groq accepts the connection but never
            # streams anything back.
            logger.warning("Chat request failed outside Groq's own error type: %s", e)
            yield _sse("error", detail="Pepper couldn't reach its AI service right now. Please try again.")

    return StreamingResponse(generate(), media_type="text/event-stream")


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
    saved items and asks the model for specific questions those excerpts can
    answer, rather than the generic title-template questions the frontend
    falls back to. Returns an empty list (never an error) whenever this isn't
    possible -- no key, no ready items, or a model failure -- so the caller
    can fall back to that title-based path."""
    items = (
        db.query(SavedItem)
        .filter(SavedItem.user_id == current_user.id, SavedItem.status == "ready")
        .order_by(SavedItem.created_at.desc())
        .limit(MAX_SUGGESTION_ITEMS)
        .all()
    )
    if not items or not GROQ_API_KEY:
        return SuggestedQuestionsOut(questions=[])

    snippets = _content_snippets(db, items)
    sections = []
    for item in items:
        label = item.title or f"{item.source_type} item"
        sections.append(f"[{label}]\n{snippets[item.id]}")
    prompt = SUGGESTIONS_PROMPT.format(count=SUGGESTION_COUNT) + "\n\n" + "\n\n".join(sections)

    try:
        client = Groq(api_key=GROQ_API_KEY, timeout=GROQ_TIMEOUT_S)
        response = client.chat.completions.create(
            model=GROQ_CHAT_MODEL,
            messages=[
                {
                    "role": "system",
                    # Groq's JSON mode (unlike Gemini's response_schema) doesn't bind to a
                    # Pydantic model directly -- it just guarantees valid JSON, so the exact
                    # shape has to be spelled out and then validated against the schema below.
                    "content": 'Respond with ONLY a JSON object of the form {"questions": ["...", ...]}. No other text.',
                },
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
        )
        raw = response.choices[0].message.content or "{}"
        parsed = SuggestedQuestionsOut.model_validate_json(raw)
        questions = [q.strip() for q in parsed.questions if q.strip()][:SUGGESTION_COUNT]
        return SuggestedQuestionsOut(questions=questions)
    except Exception as e:
        logger.warning("Suggested-question generation via Groq failed, falling back: %s", e)
        return SuggestedQuestionsOut(questions=[])
