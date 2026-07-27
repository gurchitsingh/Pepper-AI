from dataclasses import dataclass

import tiktoken

MAX_CHUNK_SECONDS = 45
MAX_CHUNK_WORDS = 300
MAX_CHUNK_CHARS = 1500
OVERLAP_SECONDS = 5
OVERLAP_CHARS = 150

_encoding = tiktoken.get_encoding("cl100k_base")


@dataclass
class Chunk:
    text: str
    start_time: float | None
    end_time: float | None
    token_count: int


def estimate_tokens(text: str) -> int:
    """Real token count via tiktoken's cl100k_base encoding (provider-agnostic general-
    text tokenizer, not tied to one LLM's exact vocabulary)."""
    return max(1, len(_encoding.encode(text)))


def chunk_segments(
    segments,
    max_seconds: int = MAX_CHUNK_SECONDS,
    max_words: int = MAX_CHUNK_WORDS,
    overlap_seconds: int = OVERLAP_SECONDS,
) -> list[Chunk]:
    """Groups consecutive timed segments (each with .start/.end/.text) into chunks of
    roughly `max_seconds` of speech or `max_words`, whichever comes first. Never splits
    inside a segment, so chunk boundaries always fall on natural speech/caption breaks.

    Trailing segments covering up to `overlap_seconds` are carried into the start of
    the next chunk, so a sentence spoken right at a boundary still has full context in
    whichever chunk retrieval picks up -- unlike text, spoken transcripts have no
    paragraph structure to naturally re-anchor on, so overlap has to be time-based.
    """
    chunks: list[Chunk] = []
    current: list = []
    current_words = 0

    def flush():
        chunks.append(
            Chunk(
                text=" ".join(s.text for s in current),
                start_time=current[0].start,
                end_time=current[-1].end,
                token_count=estimate_tokens(" ".join(s.text for s in current)),
            )
        )

    for seg in segments:
        seg_words = len(seg.text.split())
        projected_duration = (seg.end - current[0].start) if current else 0
        if current and (projected_duration > max_seconds or current_words + seg_words > max_words):
            flush()
            overlap = []
            overlap_span = 0.0
            for s in reversed(current):
                span = s.end - s.start
                if overlap_span + span > overlap_seconds:
                    break
                overlap.insert(0, s)
                overlap_span += span
            current = overlap
            current_words = sum(len(s.text.split()) for s in current)
        current.append(seg)
        current_words += seg_words

    if current:
        flush()
    return chunks


def chunk_text(text: str, max_chars: int = MAX_CHUNK_CHARS, overlap_chars: int = OVERLAP_CHARS) -> list[Chunk]:
    """Groups paragraphs (newline-separated) into chunks of up to ~max_chars, without
    splitting a paragraph across chunks. A single paragraph longer than max_chars is
    still kept whole rather than cut mid-sentence.

    Trailing paragraphs totaling up to `overlap_chars` are carried into the start of
    the next chunk. Articles/documents have real paragraph structure, so (unlike
    transcripts) overlap can re-anchor on whole paragraphs instead of a raw time
    window, cheaply preserving context across a chunk boundary.
    """
    paragraphs = [p.strip() for p in text.split("\n") if p.strip()]
    if not paragraphs:
        return []

    chunks: list[Chunk] = []
    current: list[str] = []
    current_len = 0

    def flush():
        joined = "\n".join(current)
        chunks.append(Chunk(text=joined, start_time=None, end_time=None, token_count=estimate_tokens(joined)))

    for p in paragraphs:
        if current and current_len + len(p) + 1 > max_chars:
            flush()
            overlap: list[str] = []
            overlap_len = 0
            for para in reversed(current):
                if overlap_len + len(para) > overlap_chars:
                    break
                overlap.insert(0, para)
                overlap_len += len(para) + 1
            current = overlap
            current_len = overlap_len

        current.append(p)
        current_len += len(p) + 1

    if current:
        flush()

    return chunks
