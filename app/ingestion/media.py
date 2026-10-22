import logging
import os
import subprocess
import tempfile
import time

from dotenv import load_dotenv
from faster_whisper import WhisperModel
from groq import Groq

from app.ingestion.common import IngestResult, IngestionError, Segment
from app.ingestion.transliteration import transliterate_devanagari

load_dotenv()

logger = logging.getLogger(__name__)

WHISPER_MODEL_SIZE = os.getenv("WHISPER_MODEL_SIZE", "small")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
# Without this, a Groq-side stall leaves the worker blocked on this one job
# indefinitely -- no crash, no error, just silence -- since SimpleWorker
# processes jobs one at a time with no per-job watchdog of its own.
GROQ_TIMEOUT_S = 60
# Loading the local Whisper model (ctranslate2 + model weights) is the single
# most memory-hungry thing this app does. On a memory-constrained host (e.g.
# Render's free 512MB tier) that can OOM-kill the whole container with no
# error logged -- SIGKILL doesn't give the process time to flush a log line,
# which is indistinguishable from a silent hang from the outside. Set this to
# "true" in that environment's env vars so a Groq failure fails the job
# cleanly instead of risking a crash that orphans it.
DISABLE_LOCAL_WHISPER_FALLBACK = os.getenv("DISABLE_LOCAL_WHISPER_FALLBACK", "false").lower() == "true"

_model: WhisperModel | None = None


def _get_model() -> WhisperModel:
    global _model
    if _model is None:
        _model = WhisperModel(WHISPER_MODEL_SIZE, device="cpu", compute_type="int8")
    return _model


def _transcribe_with_groq(audio_path: str) -> IngestResult:
    client = Groq(api_key=GROQ_API_KEY, timeout=GROQ_TIMEOUT_S)
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
    """Extract a 16kHz mono WAV from any audio/video file ffmpeg can read.

    stdin is redirected to DEVNULL (and -nostdin is passed): ffmpeg reads from
    stdin by default, and in a container where the worker's stdin is a pipe that
    never closes (e.g. Render's runtime) that makes the subprocess hang forever
    -- which is exactly the 180s timeout we were seeing. Locally stdin is a
    console so ffmpeg exits instantly, hence "works locally, fails hosted".
    """
    fd, audio_path = tempfile.mkstemp(suffix=".wav")
    os.close(fd)
    logger.info("extract_audio: starting ffmpeg conversion for %s", source_path)
    started = time.time()
    try:
        result = subprocess.run(
            ["ffmpeg", "-y", "-nostdin", "-i", source_path, "-ar", "16000", "-ac", "1", "-vn", audio_path],
            stdin=subprocess.DEVNULL,
            capture_output=True,
            text=True,
            timeout=120,
        )
    except subprocess.TimeoutExpired:
        try:
            os.remove(audio_path)
        except OSError:
            pass
        raise IngestionError("ffmpeg timed out converting the audio (120s) -- likely a container/ffmpeg issue")
    logger.info("extract_audio: ffmpeg conversion finished in %.2fs for %s", time.time() - started, source_path)
    if result.returncode != 0:
        try:
            os.remove(audio_path)
        except OSError:
            pass
        raise IngestionError(f"ffmpeg could not extract audio from the file: {result.stderr[-500:]}")
    return audio_path


def transcribe_audio(audio_path: str) -> IngestResult:
    """Transcribes via Groq's hosted whisper-large-v3 when GROQ_API_KEY is set,
    falling back to the local faster-whisper model on any Groq failure (missing
    key, network error, rate limit, etc.) so ingestion never hard-depends on Groq
    -- unless DISABLE_LOCAL_WHISPER_FALLBACK opts out of that fallback because
    the local model is too memory-heavy for this host.
    """
    if GROQ_API_KEY:
        logger.info("transcribe_audio: starting Groq transcription for %s", audio_path)
        try:
            result = _transcribe_with_groq(audio_path)
            logger.info("transcribe_audio: Groq transcription succeeded for %s", audio_path)
            return result
        except IngestionError:
            raise
        except Exception:
            logger.warning("Groq transcription failed for %s", audio_path, exc_info=True)
            if DISABLE_LOCAL_WHISPER_FALLBACK:
                raise IngestionError("Groq transcription failed and local fallback is disabled on this host")

    logger.info("transcribe_audio: starting local faster-whisper transcription for %s", audio_path)
    result = _transcribe_with_faster_whisper(audio_path)
    logger.info("transcribe_audio: local transcription succeeded for %s", audio_path)
    return result


def process_uploaded_file(file_path: str) -> IngestResult:
    if not os.path.exists(file_path):
        raise IngestionError(f"Uploaded file not found on disk: {file_path}")

    audio_path = extract_audio(file_path)
    try:
        return transcribe_audio(audio_path)
    finally:
        os.remove(audio_path)


def process_reel_url(url: str) -> IngestResult:
    """Downloads a public Instagram/TikTok/Facebook reel via yt-dlp, extracts its audio,
    and transcribes it through the same Groq/faster-whisper path as any other audio source.
    """
    import yt_dlp

    with tempfile.TemporaryDirectory() as tmp_dir:
        out_template = os.path.join(tmp_dir, "audio.%(ext)s")
        # No "postprocessors" here deliberately, AND "fixup": "never": yt-dlp
        # invokes its own ffmpeg version-probe (hanging indefinitely in
        # production -- a 180s RQ job timeout fired waiting on it) from TWO
        # separate places, not just the postprocessors list -- removing that
        # list alone wasn't enough. yt-dlp's `fixup()` step runs automatically
        # after every download regardless of configured postprocessors, and
        # for some reel formats (seen: an "m4a_dash" container) decides it
        # needs to auto-correct the file via FFmpegFixupM4aPP, which triggers
        # the same hanging ffmpeg version-probe through pp.available. "fixup":
        # "never" skips that step entirely, before it ever touches ffmpeg --
        # harmless here since we run our own extract_audio() conversion next
        # regardless of the source container's quirks.
        ydl_opts = {
            "format": "bestaudio/best",
            "outtmpl": out_template,
            "quiet": True,
            "no_warnings": True,
            "fixup": "never",
            "socket_timeout": 20,
        }
        logger.info("process_reel_url: starting yt-dlp download for %s", url)
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)
                downloaded_path = ydl.prepare_filename(info)
        except yt_dlp.utils.DownloadError as e:
            raise IngestionError(f"Could not download this reel: {e}")
        logger.info("process_reel_url: yt-dlp download finished for %s -> %s", url, downloaded_path)

        if not os.path.exists(downloaded_path):
            raise IngestionError("Reel download: expected audio file was not produced")

        wav_path = extract_audio(downloaded_path)
        logger.info("process_reel_url: ffmpeg audio extraction finished for %s", url)
        try:
            result = transcribe_audio(wav_path)
        finally:
            os.remove(wav_path)
        result.title = result.title or (info or {}).get("title") or (info or {}).get("description")
        return result
