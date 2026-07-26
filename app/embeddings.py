import os

import requests
from dotenv import load_dotenv

load_dotenv()

VOYAGE_API_KEY = os.getenv("VOYAGE_API_KEY")
VOYAGE_MODEL = "voyage-4-large"
VOYAGE_EMBED_URL = "https://api.voyageai.com/v1/embeddings"


class EmbeddingError(Exception):
    """Raised when the Voyage AI embeddings API can't be reached or returns an error."""


def embed_texts(texts: list[str], input_type: str = "document") -> list[list[float]]:
    """Embeds a batch of texts via Voyage AI. `input_type` should be "document" when
    embedding content to store, or "query" when embedding a user's search/chat question
    (Voyage AI applies different prompting internally for each, per their docs).
    Returns one embedding vector (list[float], length 1024) per input text, same order.
    """
    if not VOYAGE_API_KEY:
        raise EmbeddingError(
            "VOYAGE_API_KEY is not set in .env. Get one at https://dashboard.voyageai.com/ "
            "and add it to .env before embeddings can be generated."
        )

    response = requests.post(
        VOYAGE_EMBED_URL,
        headers={"Authorization": f"Bearer {VOYAGE_API_KEY}", "Content-Type": "application/json"},
        json={"model": VOYAGE_MODEL, "input": texts, "input_type": input_type},
        timeout=30,
    )
    if response.status_code != 200:
        raise EmbeddingError(f"Voyage AI API returned {response.status_code}: {response.text[:500]}")

    data = response.json()["data"]
    # Voyage returns results possibly out of order; `index` maps each embedding back
    # to its position in the input list.
    ordered = sorted(data, key=lambda d: d["index"])
    return [d["embedding"] for d in ordered]
