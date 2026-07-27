"""Self-check for app/ingestion/chunking.py: paragraph/segment overlap and token
estimation. Run directly: python scripts/test_chunking.py
"""
import sys

sys.path.insert(0, r"C:\Users\user\OneDrive\Desktop\Pepper AI\Weave AI")

from app.ingestion.chunking import chunk_segments, chunk_text, estimate_tokens
from app.ingestion.common import Segment


def test_chunk_text_overlaps_and_never_splits_paragraphs():
    text = "\n".join(f"Para{i} short line here." for i in range(6))
    chunks = chunk_text(text, max_chars=70, overlap_chars=30)
    assert len(chunks) >= 2

    for c in chunks:
        assert c.token_count == estimate_tokens(c.text)

    # every paragraph appears whole (never cut mid-sentence) in at least one chunk
    for i in range(6):
        assert any(f"Para{i} short line here." in c.text for c in chunks)

    # consecutive chunks share at least one carried-over paragraph
    for a, b in zip(chunks, chunks[1:]):
        a_paras = set(a.text.split("\n"))
        b_paras = set(b.text.split("\n"))
        assert a_paras & b_paras, "expected overlap between consecutive chunks"


def test_chunk_segments_overlaps_and_respects_time_window():
    segs = [Segment(start=i * 5.0, end=i * 5.0 + 5.0, text=f"seg{i}") for i in range(10)]
    chunks = chunk_segments(segs, max_seconds=20, overlap_seconds=6)
    assert len(chunks) >= 2

    for c in chunks:
        assert c.end_time - c.start_time <= 20 + 5  # one segment's worth of slack

    for a, b in zip(chunks, chunks[1:]):
        a_segs = set(a.text.split(" "))
        b_segs = set(b.text.split(" "))
        assert a_segs & b_segs, "expected overlap between consecutive segment chunks"


def test_no_overlap_when_single_paragraph_exceeds_window():
    text = "One giant paragraph. " * 20
    chunks = chunk_text(text, max_chars=1500, overlap_chars=50)
    assert len(chunks) == 1  # single paragraph, kept whole, no split possible


if __name__ == "__main__":
    test_chunk_text_overlaps_and_never_splits_paragraphs()
    test_chunk_segments_overlaps_and_respects_time_window()
    test_no_overlap_when_single_paragraph_exceeds_window()
    print("All chunking self-checks passed.")
