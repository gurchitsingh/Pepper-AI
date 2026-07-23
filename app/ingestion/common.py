from dataclasses import dataclass, field


@dataclass
class Segment:
    start: float
    end: float
    text: str


@dataclass
class IngestResult:
    raw_text: str
    language: str | None = None
    title: str | None = None
    segments: list[Segment] = field(default_factory=list)


class IngestionError(Exception):
    """Raised when a source can't be turned into a transcript. Message is user-facing (stored as failure_reason)."""
