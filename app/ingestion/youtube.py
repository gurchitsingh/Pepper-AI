import os
import re
import tempfile
from urllib.parse import urlparse, parse_qs

import requests
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import CouldNotRetrieveTranscript

from app.ingestion.common import IngestResult, IngestionError, Segment
from app.ingestion.media import transcribe_audio

VIDEO_ID_RE = re.compile(r"^[A-Za-z0-9_-]{11}$")


def extract_video_id(url: str) -> str:
    """Handles youtube.com/watch?v=, youtu.be/, and /shorts/ URL forms."""
    parsed = urlparse(url)
    host = parsed.hostname or ""

    if "youtu.be" in host:
        candidate = parsed.path.lstrip("/")
    elif "/shorts/" in parsed.path:
        candidate = parsed.path.split("/shorts/")[1].split("/")[0]
    else:
        candidate = parse_qs(parsed.query).get("v", [""])[0]

    if not VIDEO_ID_RE.match(candidate):
        raise IngestionError(f"Could not parse a YouTube video ID out of this URL: {url}")
    return candidate


def fetch_title(video_id: str) -> str | None:
    try:
        resp = requests.get(
            "https://www.youtube.com/oembed",
            params={"url": f"https://www.youtube.com/watch?v={video_id}", "format": "json"},
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json().get("title")
    except requests.RequestException:
        return None


def _fetch_captions(video_id: str) -> IngestResult | None:
    try:
        transcript = YouTubeTranscriptApi().fetch(video_id)
    except CouldNotRetrieveTranscript:
        return None

    # YouTube's own timing model: `start` is caption on-screen time, `duration` is how
    # long it stays on screen -- not the duration of speech -- so adjacent captions can
    # overlap. This is a coarser, differently-defined granularity than Whisper's speech
    # segments; end_time here is start + duration, not a detected end-of-speech boundary.
    segments = [
        Segment(start=snippet.start, end=snippet.start + snippet.duration, text=snippet.text.strip())
        for snippet in transcript
        if snippet.text.strip()
    ]

    text = " ".join(s.text for s in segments).strip()
    if not text:
        return None
    return IngestResult(raw_text=text, language=transcript.language_code, segments=segments)


def _fetch_via_whisper(url: str) -> IngestResult:
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
                ydl.download([url])
        except yt_dlp.utils.DownloadError as e:
            raise IngestionError(f"Could not download audio for Whisper fallback: {e}")

        wav_path = os.path.join(tmp_dir, "audio.wav")
        if not os.path.exists(wav_path):
            raise IngestionError("Whisper fallback: expected audio file was not produced")
        return transcribe_audio(wav_path)


def process(url: str) -> IngestResult:
    video_id = extract_video_id(url)
    title = fetch_title(video_id)

    result = _fetch_captions(video_id) or _fetch_via_whisper(url)
    result.title = result.title or title
    return result
