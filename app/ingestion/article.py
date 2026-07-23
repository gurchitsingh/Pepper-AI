import trafilatura

from app.ingestion.common import IngestResult, IngestionError


def process(url: str) -> IngestResult:
    downloaded = trafilatura.fetch_url(url)
    if not downloaded:
        raise IngestionError(f"Could not fetch URL (unreachable or invalid): {url}")

    document = trafilatura.bare_extraction(downloaded, url=url, with_metadata=True, include_comments=False)
    if not document or not document.text:
        raise IngestionError("Could not extract readable article content from this URL")

    return IngestResult(raw_text=document.text, language=document.language, title=document.title)
