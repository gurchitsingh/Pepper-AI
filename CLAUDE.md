# Weave AI — Project Instructions for Claude Code

## Project Overview
Weave AI is a personal knowledge management app (RAG-based). Users save
reels, videos, podcasts, articles, and notes; the app extracts transcripts/
content, auto-categorizes it, and lets users chat with an AI that has
context over everything they've saved.

## Tech Stack
- Backend: Python + FastAPI
- Database: PostgreSQL (running via Docker Compose, container
  "weave_ai_postgres")
- ORM: SQLAlchemy
- Migrations: Alembic
- Auth: JWT (email/password via bcrypt, plus Google/Apple OAuth)
- Job queue: Redis + RQ (container "weave_ai_redis"), worker runs as a
  separate process (`python -m app.worker`) using RQ's `SimpleWorker`
  (in-process job execution — RQ's default `Worker` forks via `os.fork()`,
  which doesn't exist on Windows)
- Ingestion: trafilatura (articles), youtube-transcript-api (YouTube
  captions), faster-whisper + ffmpeg (audio transcription fallback and
  uploaded video/audio files)

## Git Commit Rules
- Do NOT add a "Co-Authored-By" trailer or any mention of Claude/AI
  authorship in commit messages.
- Commit messages should describe only the change itself.
- Keep commit messages concise but descriptive (what changed and why,
  not a full changelog).

## Working Style
- Before marking any task "done," verify it with real tests (actual
  requests/output), not just a description of expected behavior.
- Show literal file contents and real command output when reporting
  back — not summaries — since I review everything before we move on.
- Flag anything simplified, skipped, assumed, or uncertain rather than
  presenting it as fully complete.
- Don't start work on a phase that hasn't been explicitly requested yet
  (e.g. don't jump ahead to frontend/RAG work unless asked).

## Current Status

**Step 3 — data model + backend skeleton: complete.**
User/SavedItem models, Alembic migrations, JWT auth (email/password +
Google/Apple OAuth), and CRUD endpoints for saved_items, all scoped
per-user and tested with real HTTP requests.
- Google/Apple OAuth: routing, find-or-create logic, JWT issuance, and
  conflict handling (email already registered under a different method)
  are tested end-to-end with mocked token claims. The actual token
  *signature verification* against Google/Apple is still untested — needs
  real `GOOGLE_CLIENT_ID` / `APPLE_CLIENT_ID` values in `.env` (see
  comments there for where to get them) and one real sign-in from a
  frontend to confirm.

**Step 4 — ingestion pipeline: complete.**
Redis + RQ job queue added (`app/queue.py`, worker at `app/worker.py`);
`transcripts` table added; `saved_items` gained `failure_reason` and
`uploaded_file_path`. `POST /saved-items` returns immediately with
status `pending` and enqueues a background job (except `note`, which
has no extraction step and goes straight to `ready` synchronously).
Status flow: `pending -> processing -> ready` or `failed` (with
`failure_reason` set).

Per-source_type status, all tested with real inputs against the live
worker + Postgres:
- **article** (trafilatura): tested with a real Wikipedia URL (clean
  text + title extracted, ~15KB) and a real unreachable-domain URL
  (correctly landed in `failed` with a clear `failure_reason`).
- **youtube** (youtube-transcript-api, faster-whisper fallback): tested
  with a real YouTube video that has captions — captions path used
  (fast, ~1s), title fetched via YouTube's oEmbed endpoint, real
  transcript text stored. The Whisper *fallback* path (for videos with
  no captions) is implemented (yt-dlp audio download -> faster-whisper)
  but has not been exercised by a real captionless video — flagged as
  untested, though it shares the same `transcribe_audio()` function
  proven by the upload path below.
- **note**: tested — synchronous, no queue involved, goes straight to
  `status: ready` with the provided text stored as the transcript.
  Missing-content case correctly returns 400.
- **instagram/tiktok/voice_note** (upload + faster-whisper): tested via
  `POST /saved-items/upload` with a real ~62s MP4 file — ffmpeg audio
  extraction and faster-whisper transcription both ran for real against
  actual audio content.

**Whisper model size: `small` (chosen after a real benchmark, not the
initial default).** Language is never hardcoded — `model.transcribe()` is
called with no `language=` argument anywhere, so Whisper auto-detects per
file and the result is stored in `transcripts.language`. Confirmed
end-to-end with real audio in English and Hindi (`en`/`hi` both detected
correctly). On a real 62s test video (CPU, int8), inference time vs `base`:
- `base`: 17.45s (0.28x realtime) — fast, but Hindi transcription was
  unusable garbled English-ish text.
- `small`: 44.80s (2.57x base, 0.72x realtime) — fixed most English
  proper-noun errors `base` missed (naan, aloo gobi, Diwali), Hindi became
  readable and mostly correct (a few word-level typos). **Chosen default.**
- `medium`: 124.94s (7.16x base, 2.02x realtime — slower than the clip
  itself) — best accuracy and near-perfect Hindi, but an unexplained
  formatting regression (lost capitalization/punctuation) and too slow for
  a single-worker background queue on this machine. Rejected on cost, not
  quality — revisit if a GPU becomes available (`device="cpu"` is
  currently hardcoded in `app/ingestion/media.py`).

**Per-segment timestamps: added.** `transcript_segments` table
(transcript_id, start_time, end_time, text) stores real per-segment timing
from both the Whisper path (`faster-whisper`'s native `Segment.start/end`)
and the YouTube captions path (`youtube-transcript-api`'s `start`/`duration`
per snippet, `end = start + duration`). `raw_text` on `transcripts` is kept
alongside segments, not replaced. Article and note transcripts correctly
produce zero segment rows (no natural timestamp concept for either) —
confirmed via a DB query grouping segment counts by source_type.
Verified with real data:
- Instagram upload (Whisper `small`, 62s video): 28 segments, 0.00s-61.68s,
  no gaps larger than ~1s.
- YouTube captions ("Me at the zoo"): 6 segments, 1.20s-18.88s, with real
  gaps between captions (e.g. 3.36s-5.32s) where nothing was captioned.

Flagged difference between the two segment sources: YouTube's `end_time`
is `start + duration`, where `duration` is documented by the library as
"how long the snippet stays on screen," *not* detected speech duration —
adjacent YouTube caption segments can theoretically overlap. Whisper's
segments are actual detected speech boundaries and don't have this
property. Both are stored in the same table/shape, but they mean slightly
different things — noted in a comment in `app/ingestion/youtube.py`.

**`GET /saved-items/{id}/segments`: added.** JWT-protected, scoped to the
current user (same pattern as `get_saved_item`: 404 if the item doesn't
exist or isn't theirs). Items that exist but have no segments yet
(`article`/`note`, or still `pending`/`processing`) return `200 []`, not
404 — that distinction wasn't explicit in the request, noted as a judgment
call. Tested for real: 28 segments back for the Instagram upload item, 6
for the YouTube item, `[]` for article and note, `401` with no token,
`404` for a nonexistent id, and `404` (not leaked data) when a different
user requests someone else's item.

Known simplifications/gaps carried into later phases:
- No file size limit or content-type validation on uploads.
- No retry/backoff on job failure.
- Only English and Hindi have been verified; other languages are expected
  to work (Whisper is multilingual and nothing is hardcoded) but untested.

Not started: Step 5 (RAG/embeddings) and frontend work.
