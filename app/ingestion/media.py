import logging
import os
import subprocess
import tempfile

from dotenv import load_dotenv
from faster_whisper import WhisperModel
from groq import Groq

from app.ingestion.common import IngestResult, IngestionError, Segment
from app.ingestion.transliteration import transliterate_devanagari

load_dotenv()

logger = logging.getLogger(__name__)

WHISPER_MODEL_SIZE = os.getenv("WHISPER_MODEL_SIZE", "small")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

_model: WhisperModel | None = None


def _get_model() -> WhisperModel:
    global _model
    if _model is None:
        _model = WhisperModel(WHISPER_MODEL_SIZE, device="cpu", compute_type="int8")
    return _model


def _transcribe_with_groq(audio_path: str) -> IngestResult:
    client = Groq(api_key=GROQ_API_KEY)
    with open(audio_path, "rb") as f:
        response = client.audio.transcriptions.create(
            file=(os.path.basename(audio_path), f.read()),
            model="whisper-large-v3",
            response_format="verbose_json",
        )

    segments = []
    for seg in response.segments or []:
        seg_text = transliterate_devanagari(seg["text"].strip())
        if seg_text:
            segments.append(Segment(start=seg["start"], end=seg["end"], text=seg_text))

    text = " ".join(s.text for s in segments).strip()
    if not text:
        raise IngestionError("Whisper produced no speech content from this audio")
    return IngestResult(raw_text=text, language=response.language, segments=segments)


def _transcribe_with_faster_whisper(audio_path: str) -> IngestResult:
    model = _get_model()
    whisper_segments, info = model.transcribe(audio_path)

    segments = []
    for seg in whisper_segments:
        seg_text = transliterate_devanagari(seg.text.strip())
        if seg_text:
            segments.append(Segment(start=seg.start, end=seg.end, text=seg_text))

    text = " ".join(s.text for s in segments).strip()
    if not text:
        raise IngestionError("Whisper produced no speech content from this audio")
    return IngestResult(raw_text=text, language=info.language, segments=segments)


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
    """Transcribes via Groq's hosted whisper-large-v3 when GROQ_API_KEY is set,
    falling back to the local faster-whisper model on any Groq failure (missing
    key, network error, rate limit, etc.) so ingestion never hard-depends on Groq.
    """
    if GROQ_API_KEY:
        try:
            return _transcribe_with_groq(audio_path)
        except IngestionError:
            raise
        except Exception:
            logger.warning("Groq transcription failed, falling back to local faster-whisper", exc_info=True)
    return _transcribe_with_faster_whisper(audio_path)


def process_uploaded_file(file_path: str) -> IngestResult:
    if not os.path.exists(file_path):
        raise IngestionError(f"Uploaded file not found on disk: {file_path}")

    audio_path = extract_audio(file_path)
    try:
        return transcribe_audio(audio_path)
    finally:
        os.remove(audio_path)


def process_reel_url(url: str) -> IngestResult:
    """Downloads a public Instagram/TikTok reel via yt-dlp, extracts its audio, and
    transcribes it through the same Groq/faster-whisper path as any other audio source.
    """
    import yt_dlp

    with tempfile.TemporaryDirectory() as tmp_dir:
        out_template = os.path.join(tmp_dir, "audio.%(ext)s")
        ydl_opts = {
            "format": "bestaudio/best",
            "outtmpl": out_template,
            "quiet": True,
            "no_warnings": True,
            "postprocessors": [{"key": "FFmpegExtractAudio", "preferredcodec": "wav"}],
        }
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)
        except yt_dlp.utils.DownloadError as e:
            raise IngestionError(f"Could not download this reel: {e}")

        wav_path = os.path.join(tmp_dir, "audio.wav")
        if not os.path.exists(wav_path):
            raise IngestionError("Reel download: expected audio file was not produced")

        result = transcribe_audio(wav_path)
        result.title = result.title or (info or {}).get("title") or (info or {}).get("description")
        return result
