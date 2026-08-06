import os

import requests
from dotenv import load_dotenv

load_dotenv()

TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")
TAVILY_SEARCH_URL = "https://api.tavily.com/search"


class WebSearchError(Exception):
    """Raised when the Tavily web search API can't be reached or returns an error."""


def web_search(query: str, max_results: int = 5) -> list[dict]:
    """Searches the live web via Tavily. Returns a list of result dicts (each with
    `title`, `url`, `content`), ranked most relevant first."""
    if not TAVILY_API_KEY:
        raise WebSearchError(
            "TAVILY_API_KEY is not set in .env. Get one at https://tavily.com before web "
            "fallback search can run."
        )

    response = requests.post(
        TAVILY_SEARCH_URL,
        headers={"Content-Type": "application/json"},
        json={
            "api_key": TAVILY_API_KEY,
            "query": query,
            "search_depth": "basic",
            "max_results": max_results,
        },
        timeout=30,
    )
    if response.status_code != 200:
        raise WebSearchError(f"Tavily API returned {response.status_code}: {response.text[:500]}")

    return response.json().get("results", [])
