import logging
import os

from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

logger = logging.getLogger(__name__)

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
GEMINI_MODEL = "gemini-flash-latest"

MAX_CONTENT_CHARS_FOR_TITLE = 4000

TITLE_SYSTEM_PROMPT = (
    "You write short titles for items a user saved (notes, articles, videos, voice "
    "memos). Given the extracted content below, respond with ONLY the title -- no "
    "punctuation, no quotes, no markdown, at most 8 words. Be specific rather than "
    "generic -- e.g. 'Marathon Taper Week Plan' instead of 'Fitness Notes' -- based "
    "on what the content is actually about."
)


def generate_title(raw_text: str) -> str | None:
    """Generates a short title for an untitled item from its extracted content via
    Gemini. Returns None if no API key is configured, the content is empty, or
    generation fails -- callers should leave the item untitled in that case rather
    than write a placeholder that would look like it was derived from the content."""
    text = (raw_text or "").strip()
    if not text:
        return None

    if not GOOGLE_API_KEY:
        logger.warning("GOOGLE_API_KEY not set -- skipping auto title generation")
        return None

    try:
        client = genai.Client(api_key=GOOGLE_API_KEY)
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=text[:MAX_CONTENT_CHARS_FOR_TITLE],
            config=types.GenerateContentConfig(system_instruction=TITLE_SYSTEM_PROMPT),
        )
        title = (response.text or "").strip().strip('"').strip("'")
        return title or None
    except Exception as e:
        logger.warning("Title generation via Gemini failed: %s", e)
        return None
