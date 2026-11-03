# AGENTS.md — PepperAI

> Read order: `PORTFOLIO.md` (cross-project routing) → `docs/CONTEXT.md` →
> `docs/TASKS.md` → `docs/DECISIONS.md`.

## Your role
You are the builder/operator. Implement, test, commit, report.
Do **not** make product or architecture decisions — escalate those to Claude
(record the question in `docs/TASKS.md` under "Claude gate?").

## Stack
- Backend: FastAPI, PostgreSQL + pgvector, Redis/RQ, SQLAlchemy, Alembic
- Frontend: React 19, Vite (port 3000), Tailwind 4, React Router 7
- Ingestion: trafilatura (articles), yt-dlp + captions API + faster-whisper (video/audio),
  Tesseract OCR (scanned PDFs, English only), Groq (transcription timeout path)
- RAG: Voyage embeddings + pgvector cosine search; Gemini grounded chat with citations

## Task protocol
1. Read the task brief and acceptance criteria in `docs/TASKS.md`.
2. Inspect only the relevant files.
3. State a short plan (3–5 bullets).
4. Implement in small commits.
5. Verify: build, lint, tests, and a critical-path smoke test.
6. Report: **done / changed / verified / risks / decisions needed.**
7. Update `docs/TASKS.md` status and append a Session Log row in `PORTFOLIO.md`.

## Definition of done
- `cd frontend && npm run build && npm run lint` pass.
- Critical path smoke-tested: **save → ingest → ready → chat with citation.**
- No secrets committed (`.env` is untracked — keep it that way).
- `docs/CONTEXT.md` updated if behavior changed.

## Escalate to Claude when
- Requirements are ambiguous.
- Architecture, data model, security, or launch readiness is at stake.
- A fix has failed more than once.
- UX/design direction is a judgment call.
Do not escalate routine implementation.

## Ingestion pipeline facts (don't break these)
- Status flow: `pending -> processing -> ready` / `failed`; notes are the synchronous path.
- Failures must surface `failure_reason`, never store empty/garbage transcripts.
- Background work runs through Redis + RQ (`app/queue.py`, `app/worker.py`).
- Chat answers come only from the user's saved corpus; `INSUFFICIENT_CONTEXT` falls back
  to live web search.

## Commands
- Backend: `uvicorn app.main:app --reload`
- Migrations: `alembic upgrade head`
- Frontend: `cd frontend && npm run dev`
- Build/lint: `cd frontend && npm run build && npm run lint`
- Infra: `docker compose up -d db redis`
- Tests: `python scripts/test_chunking.py`, `python scripts/test_hindi_ocr.py`
- Health: `GET /health`
