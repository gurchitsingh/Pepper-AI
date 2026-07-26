from dataclasses import dataclass

MAX_CHUNK_SECONDS = 45
MAX_CHUNK_WORDS = 300
MAX_CHUNK_CHARS = 1500


@dataclass
class Chunk:
    text: str
    start_time: float | None
    end_time: float | None


def chunk_segments(segments, max_seconds: int = MAX_CHUNK_SECONDS, max_words: int = MAX_CHUNK_WORDS) -> list[Chunk]:
    """Groups consecutive timed segments (each with .start/.end/.text) into chunks of
    roughly `max_seconds` of speech or `max_words`, whichever comes first. Never splits
    inside a segment, so chunk boundaries always fall on natural speech/caption breaks.
    """
    chunks: list[Chunk] = []
    current: list = []
    current_words = 0

    def flush():
        if current:
            chunks.append(
                Chunk(
                    text=" ".join(s.text for s in current),
                    start_time=current[0].start,
                    end_time=current[-1].end,
                )
            )

    for seg in segments:
        seg_words = len(seg.text.split())
        projected_duration = (seg.end - current[0].start) if current else 0
        if current and (projected_duration > max_seconds or current_words + seg_words > max_words):
            flush()
            current = []
            current_words = 0
        current.append(seg)
        current_words += seg_words

    flush()
    return chunks


def chunk_text(text: str, max_chars: int = MAX_CHUNK_CHARS) -> list[Chunk]:
    """Groups paragraphs (newline-separated) into chunks of up to ~max_chars, without
    splitting a paragraph across chunks. A single paragraph longer than max_chars is
    still kept whole rather than cut mid-sentence.
    """
    paragraphs = [p.strip() for p in text.split("\n") if p.strip()]
    if not paragraphs:
        return []

    chunks: list[Chunk] = []
    current: list[str] = []
    current_len = 0

    for p in paragraphs:
        if current and current_len + len(p) + 1 > max_chars:
            chunks.append(Chunk(text="\n".join(current), start_time=None, end_time=None))
            current = []
            current_len = 0
        current.append(p)
        current_len += len(p) + 1

    if current:
        chunks.append(Chunk(text="\n".join(current), start_time=None, end_time=None))

    return chunks
