#!/bin/sh
set -e

# Brings a fresh database (e.g. a new Neon project) up to the current schema.
# Safe to run on every boot -- a no-op once already up to date.
alembic upgrade head

# Render's free tier has no separate Background Worker option, so this one
# container runs both: the ingestion worker in the background, and uvicorn
# in the foreground as the main process. If the worker crashes it won't
# auto-restart -- acceptable for a free-tier MVP, worth revisiting if this
# becomes a real reliability problem.
python -m app.worker &

exec uvicorn app.main:app --host 0.0.0.0 --port "$PORT"
