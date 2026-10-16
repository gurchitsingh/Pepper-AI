import logging
import os

from dotenv import load_dotenv
from groq import Groq

load_dotenv()

logger = logging.getLogger(__name__)

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
# Confirmed against this account's actual /v1/models list -- Groq gates some
# models per-account, so not every model in their general docs is available here.
GROQ_CHAT_MODEL = "openai/gpt-oss-120b"

MAX_CONTENT_CHARS_FOR_TITLE = 4000
# Same rationale as GROQ_TIMEOUT_S in app/routers/chat.py: without it, a
# model-side stall would hang the ingestion worker on this one item indefinitely.
GROQ_TIMEOUT_S = 30

TITLE_SYSTEM_PROMPT = (
    "You write short titles for items a user saved (notes, articles, videos, voice "
    "memos). Given the extracted content below, respond with ONLY the title -- no "
    "punctuation, no quotes, no markdown, at most 8 words. Be specific rather than "
    "generic -- e.g. 'Marathon Taper Week Plan' instead of 'Fitness Notes' -- based "
    "on what the content is actually about."
)


def generate_title(raw_text: str) -> str | None:
    """Generates a short title for an untitled item from its extracted content via
    Groq. Returns None if no API key is configured, the content is empty, or
    generation fails -- callers should leave the item untitled in that case rather
    than write a placeholder that would look like it was derived from the content."""
    text = (raw_text or "").strip()
    if not text:
        return None

    if not GROQ_API_KEY:
        logger.warning("GROQ_API_KEY not set -- skipping auto title generation")
        return None

    try:
        client = Groq(api_key=GROQ_API_KEY, timeout=GROQ_TIMEOUT_S)
        response = client.chat.completions.create(
            model=GROQ_CHAT_MODEL,
            messages=[
                {"role": "system", "content": TITLE_SYSTEM_PROMPT},
                {"role": "user", "content": text[:MAX_CONTENT_CHARS_FOR_TITLE]},
            ],
        )
        title = (response.choices[0].message.content or "").strip().strip('"').strip("'")
        return title or None
    except Exception as e:
        logger.warning("Title generation via Groq failed: %s", e)
        return None


def fallback_title(raw_text: str, max_chars: int = 60) -> str | None:
    """Deterministic, non-AI title: the first line of the content, truncated.
    Used when generate_title() can't run (no API key, quota exhausted, Groq
    down) so items don't end up silently untitled."""
    text = (raw_text or "").strip()
    if not text:
        return None
    candidate = text.splitlines()[0].strip() or text
    if len(candidate) <= max_chars:
        return candidate
    return candidate[:max_chars].rstrip() + "…"
