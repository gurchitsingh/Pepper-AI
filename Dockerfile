FROM python:3.13-slim

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
