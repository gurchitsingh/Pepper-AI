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
  actual audio content. `voice_note` was already wired into
  `UPLOAD_SOURCE_TYPES`/`HANDLERS` from this phase (anticipated for the
  "note-with-recording" case) and specifically re-verified later with a
  genuine audio-only file (`ffprobe`-confirmed no video stream, extracted
  from `short.mp4` via `ffmpeg -vn`) — `-vn` on already-audio-only input
  is a safe no-op, same transcript either way.
- **document** (`.md`/`.txt`/`.pdf`/`.docx`, `app/ingestion/document.py`):
  added later, one source_type covering all four formats since the
  extension alone determines extraction method and nothing else
  differs — no reason to fragment source_type for a purely internal
  branch. `.md`/`.txt` are read as-is (no markdown stripping); `.pdf` via
  `pypdf`; `.docx` via `python-docx`. No `transcript_segments` (like
  article/note). Tested via real uploads: a real multi-paragraph `.md`
  (markdown syntax preserved verbatim, e.g. `**bold**` and `[link](url)`
  kept raw), `.txt`, a real PDF generated with an actual text layer, and
  a real `.docx` — all four extracted correctly and reached `ready`, `0`
  `transcript_segments` confirmed via DB query, chunked via the
  paragraph-based path (`start_time`/`end_time` NULL) as expected.
  **Scanned-PDF limitation confirmed for real, not just flagged in
  prose:** built a PDF with a blank page (no text layer, via `pypdf`'s
  own `PdfWriter`) and uploaded it — landed in `status: failed` with
  `failure_reason: "No extractable text found in this PDF. It may be a
  scanned image without a real text layer -- this is simple text
  extraction, not OCR."`, not a silent empty transcript. (OCR fallback for
  this exact case added later -- see below.)

**OCR fallback for scanned/image-based PDFs: added, English only.**
`document.py`'s PDF path now tries normal text extraction first (unchanged
behavior), and if that returns nothing, rasterizes each page (via
`PyMuPDF`/`fitz`, no external `poppler` binary needed) and runs Tesseract
OCR (`pytesseract`, `lang="eng"`) on the images. If OCR *also* produces
nothing, it still fails cleanly rather than storing empty/garbage text.
No architecture change was needed for "async, not blocking" -- `document`
uploads already went through the same `POST /saved-items/upload` ->
`ingestion_queue` -> RQ worker path as every other upload type from Step
4, so OCR runs in the background worker automatically, same as Whisper.
- **Tesseract OCR system dependency**: not installed on this machine;
  checked the same way `ffmpeg` was checked in Step 4, then installed via
  `winget install UB-Mannheim.TesseractOCR` (the standard Windows Tesseract
  distribution) after confirming it was actually missing rather than
  guessing. `document.py`'s `_ensure_tesseract()` checks PATH first, falls
  back to the two standard Windows install locations (handles the case
  where a fresh install isn't on PATH yet for an already-running process),
  and raises a clear install-instruction error for Windows/macOS/Linux if
  none is found -- never silently skips OCR or guesses at a path.
- **Tested for real, full pipeline (not just the extraction function in
  isolation)**: rendered a real English sentence onto a bitmap with PIL
  (actual pixels, not embedded text), embedded that image into a PDF with
  `PyMuPDF` (confirmed via `pypdf` first that this PDF has zero extractable
  text -- a genuine test case, not assumed), then uploaded it through the
  real `POST /saved-items/upload` endpoint. Job completed in the real RQ
  worker in ~5.5s, landed in `status: ready`, and
  `transcripts.raw_text` matched the rendered sentence exactly, including
  the line break. Re-tested the true-failure case too (the earlier blank
  page with no text layer *and* no image) -- still fails cleanly, now with
  an updated message noting OCR was attempted:
  `"No extractable text found in this PDF, even after OCR. It may be a
  blank page or an image with no readable text."`
- **Flag: `PyMuPDF` is AGPL-3.0-licensed** (or requires a commercial
  license from Artifex for proprietary/closed-source use) -- worth
  knowing before this app is distributed or sold, not just self-hosted.
  Chosen over `pdf2image` specifically to avoid a second system-level
  dependency (`poppler`) on top of Tesseract; revisit if the AGPL terms
  become a problem.
- **Hindi OCR is explicitly out of scope for this pass** (English only,
  `lang="eng"` hardcoded in `_ocr_pdf()`) -- flagged as the next step,
  not silently deferred.

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

**Step 5 — RAG core: partially complete, blocked on two API keys.**

*Done and tested with real data:*
- **Transliteration** (`app/ingestion/transliteration.py`, ITRANS via
  `indic-transliteration`): wired into the Whisper path in
  `app/ingestion/media.py` so new transcripts/segments are normalized to
  Roman script going forward; `scripts/backfill_transliteration.py`
  retroactively converted existing Devanagari (real before/after tested,
  since no real Devanagari existed in the DB from prior actual usage --
  one real item was created via a genuine gTTS-generated Hindi upload
  through the actual `/saved-items/upload` endpoint to have real data to
  convert). **Flagged limitation, found this session:** the transliteration
  scheme retains Hindi's inherent schwa vowels and uses ITRANS's
  capital-letter long-vowel convention (e.g. "कितने" -> "kitane", not the
  colloquial "kitne"; "हिंदी" -> "hiMdI"). This is standard behavior for
  every scheme this library offers (tested ITRANS, OPTITRANS, HK, IAST,
  SLP1 -- all retain schwas) -- it does letter-accurate script conversion,
  not colloquial Hindi-to-Latin respelling. Achieves the stated goal
  (consistent Roman script for search) but doesn't read the way a Hindi
  speaker would naturally type it. As previously flagged, mixed Hinglish
  (English loanwords Whisper phoneticizes into Devanagari) is also not
  fixed by this step -- confirmed again this session (English words like
  "message"/"reply"/"office" get transliterated into Devanagari-derived
  Roman spellings like "mesaja"/"riplai", not restored to English).

- **Chunking** (`app/ingestion/chunking.py`): `chunks` table added.
  Segment-based chunking (YouTube/Whisper) groups consecutive segments up
  to ~45s or ~300 words, never splitting inside a segment; text-based
  chunking (articles/notes) groups paragraphs up to ~1500 chars, never
  splitting a paragraph. Wired into both `process_saved_item` (queued
  path) and the synchronous note-creation path. Backfilled onto all
  pre-existing `ready` items via `scripts/backfill_chunks.py`. Tested on
  real data: YouTube "Me at the zoo" -> 1 chunk (18s, under both
  thresholds); Instagram upload (62s) -> 2 chunks, split exactly at the
  45s boundary; Wikipedia RAG article -> 13 chunks by paragraph (last few
  are bibliography entries, since trafilatura extracts the full page
  including references -- not a chunking bug, worth knowing for retrieval
  quality later).

- **pgvector**: the `postgres:16` image doesn't include pgvector at all --
  swapped `docker-compose.yml`'s `db` service to `pgvector/pgvector:pg16`
  (same Postgres 16, extension precompiled). Verified all existing data
  (9 users, 16 saved_items, 9 transcripts, 36 segments, 22 chunks at the
  time) survived the swap intact. Extension enabled via migration
  (`CREATE EXTENSION IF NOT EXISTS vector`), `chunks.embedding` is
  `vector(1024)`. Note: Postgres logs a harmless collation-version warning
  since the new image's OS locale library differs slightly from the old
  one (2.41 vs 2.36) -- doesn't affect anything the app relies on (no
  correctness-critical text-column sorting), fixable later with `ALTER
  DATABASE weave_ai_db REFRESH COLLATION VERSION` if it becomes annoying.

- **Embedding generation code** (`app/embeddings.py`): calls Voyage AI's
  `POST /v1/embeddings` with `voyage-4-large` (1024-dim, confirmed current
  via live docs fetch, not memory). Wired into `store_chunks()` so future
  ingestion embeds chunks automatically once a key exists --
  **specifically designed to fail soft**: if `VOYAGE_API_KEY` is missing,
  ingestion still completes normally (`status: ready`, chunk stored,
  `embedding` left NULL, warning logged) rather than marking items
  `failed`. Verified for real: created a note with no key set, confirmed
  it still reached `ready` and the chunk's `embedding` is `None`, with the
  warning visible in the server log. `scripts/generate_embeddings.py` is
  ready to backfill all NULL-embedding chunks once a key exists.

- **`POST /chat` endpoint** (`app/routers/chat.py`): JWT-protected,
  pgvector cosine-distance search scoped to `SavedItem.user_id ==
  current_user.id` (joins `Chunk` -> `SavedItem`, never queries across
  users), top 5 chunks, sent to Claude (`claude-sonnet-5`) with a system
  prompt restricting it to the provided context, returns `answer` +
  `sources` (which saved_items/chunks it drew from). Verified for real:
  `401` with no token; `501` with a valid token when `ANTHROPIC_API_KEY`
  is missing (checked before any embedding/DB work, so it fails fast and
  never fabricates an answer).

*Blocked, not yet done:*
- No real embeddings exist yet -- needs a real `VOYAGE_API_KEY` in `.env`
  (get one at https://dashboard.voyageai.com/), then run
  `python scripts/generate_embeddings.py` to backfill the 22 existing
  chunks.
- `/chat` has never returned a real answer -- needs a real
  `ANTHROPIC_API_KEY` in `.env` (get one at
  https://console.anthropic.com/settings/keys) *and* the embeddings step
  above, since retrieval depends on chunks actually having embeddings.
  Once both exist, test with a real question (e.g. about the RAG
  Wikipedia article or the zoo video) and confirm real retrieved
  chunks + a real Claude answer.
- Both keys were checked for and confirmed absent this session, including
  checking the shell environment (not just `.env`) for `ANTHROPIC_API_KEY`
  -- this project has never had a working server-side Anthropic key; the
  OAuth-based auth that runs Claude Code itself is unrelated and can't be
  reused here.

Not started: Step 6 (frontend) and Step 7 (auto-categorization/insights).
