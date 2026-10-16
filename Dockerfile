FROM python:3.13-slim

# Without this, Python buffers stdout/stderr in blocks -- a crash (e.g. an
# OOM kill, which gives the process no chance to flush) can wipe out log
# lines that were already written but still sitting in that buffer, making a
# real crash look like total silence with nothing to diagnose.
ENV PYTHONUNBUFFERED=1

# ffmpeg: required by yt-dlp (audio extraction from reels/shorts) and the local
# Whisper fallback. Render's native Python runtime doesn't guarantee this is
# present, so a Docker image is the only way to be certain it's there.
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

COPY start.sh .
RUN chmod +x start.sh

# Render sets $PORT at runtime; it's not known at build time.
CMD ["./start.sh"]
