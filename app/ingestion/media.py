import os
import subprocess
import tempfile

from faster_whisper import WhisperModel

from app.ingestion.common import IngestResult, IngestionError, Segment

WHISPER_MODEL_SIZE = os.getenv("WHISPER_MODEL_SIZE", "small")

_model: WhisperModel | None = None


def _get_model() -> WhisperModel:
    global _model
    if _model is None:
        _model = WhisperModel(WHISPER_MODEL_SIZE, device="cpu", compute_type="int8")
    return _model


def extract_audio(source_path: str) -> str:
    """Extract a 16kHz mono WAV from any audio/video file ffmpeg can read."""
    fd, audio_path = tempfile.mkstemp(suffix=".wav")
    os.close(fd)
    result = subprocess.run(
        ["ffmpeg", "-y", "-i", source_path, "-ar", "16000", "-ac", "1", "-vn", audio_path],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        os.remove(audio_path)
        raise IngestionError(f"ffmpeg could not extract audio from the file: {result.stderr[-500:]}")
    return audio_path


def transcribe_audio(audio_path: str) -> IngestResult:
    model = _get_model()
    whisper_segments, info = model.transcribe(audio_path)

    segments = []
    for seg in whisper_segments:
        seg_text = seg.text.strip()
        if seg_text:
            segments.append(Segment(start=seg.start, end=seg.end, text=seg_text))

    text = " ".join(s.text for s in segments).strip()
    if not text:
        raise IngestionError("Whisper produced no speech content from this audio")
    return IngestResult(raw_text=text, language=info.language, segments=segments)


def process_uploaded_file(file_path: str) -> IngestResult:
    if not os.path.exists(file_path):
        raise IngestionError(f"Uploaded file not found on disk: {file_path}")

    audio_path = extract_audio(file_path)
    try:
        return transcribe_audio(audio_path)
    finally:
        os.remove(audio_path)
