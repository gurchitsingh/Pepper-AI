# PepperAI — Context

**Last updated:** 2026-10-19
**Strategic role:** side project; current execution priority until basic establishment.
**Git:** `main` == `origin/main` at `d5b0d12` (backend fixes merged 2026-10-19 16:35).

## What it is
A personal knowledge-management app. Users save content from scattered platforms
(YouTube videos and reels, Instagram, podcasts, articles, documents, voice notes,
handwritten notes) and chat with a RAG assistant that answers **only from their saved
corpus, with citations**.

## Users
Heavy social/content consumers who save a lot from mobile and lose track of it.
The job: capture with zero friction, then actually retrieve and use it later.

## Positioning
The differentiator is retrieval-grounded chat over the user's own saved corpus —
not general knowledge. Multi-format ingestion and auto-transcription are the plumbing.

## Current stage
- Pre-launch. Local `main` is synced with origin (backend fixes merged).
- Web design handoff implemented (Ember P mark rolled out).
- **Mobile design handoff not implemented:** `pepper-ai-mobile-app-design/` is untracked.
- **No meaningful test suite:** only `scripts/test_chunking.py`,
  `scripts/test_hindi_ocr.py`, `frontend/scripts/streak.test.ts`.
- 49 visual-audit screenshots in `backup/Design/v2-audit/` (light/dark, 390/1280).
- Untracked: `pepper-ai-mobile-app-design/`, `logo-1d/`.

## Architecture
- **Backend:** FastAPI + PostgreSQL/pgvector + Redis/RQ.
- **Frontend:** React 19 + Vite (port 3000) + Tailwind 4 + React Router 7;
  framer-motion, react-markdown, react-easy-crop, lucide-react.
- **Ingestion pipeline:** `pending -> processing -> ready` / `failed`.
  Notes are the one synchronous, no-queue path.
- **Retrieval:** pgvector cosine over `Chunk.embedding`, scoped by `user_id`
  (`app/retrieval.py`), top-k = 5.
- **Chat:** Gemini `gemini-flash-latest` with an `INSUFFICIENT_CONTEXT` sentinel;
  falls back to live web search (`app/routers/chat.py`).
- **Auth:** JWT email/password + Google/Apple OAuth.
- **Deploy:** Dockerfile for Render exists; frontend host not set up.

## Repo map
- `app/routers/` — auth, saved_items, folders, insights, chat, billing
- `app/ingestion/` — article, youtube, media, document, chunking, transliteration, tasks
- `app/embeddings.py` · `app/retrieval.py` · `app/web_search.py`
- `app/queue.py` · `app/worker.py` · `app/models/models.py`
- `frontend/src/pages/` — Home, Library, LibraryDetail, Save, Chatbot, Insights,
  Settings, Login, Signup, Landing
- `frontend/src/` — `onboarding/`, `components/`, `chat/`, `theme/`, `api/`, `hooks/`
- `alembic/versions/` — migrations (pgvector enabled, chunks, transcript_segments,
  folders, oauth fields)
- `backup/Design/v2-audit/` — visual audit screenshots

## Current status
**Done:** auth, onboarding, save hub, ingestion for all source types, transcription,
retrieval chat with citations, library/folders, insights, billing scaffolding,
settings (username/email, profile crop, password change), email verification,
web search, markdown chat, suggestions, landing page, design handoff, backend fixes
(logging, OOM guard, orphan recovery, Render Dockerfile, Facebook ingestion, Groq swap).

**In progress:** mobile design handoff; visual audit fixes; test coverage.

**Next:**
1. Test coverage for the critical path (save → ingest → ready → chat with citation).
2. Mobile design handoff implementation.
3. Visual audit fix pass.
4. Deploy backend (Render) + frontend host; real-device QA.
5. Then shift primary focus to PepperLens.

## Constraints
- Answers must stay grounded in saved content; never present outside knowledge as saved.
- Failures must surface explicit reasons (`failure_reason`).
- `.env` is gitignored — never commit secrets.
- Free/paid plan limits are in flux; do not treat current numbers as locked.
- Brand is **Pepper / Pepper AI**; "Weave AI" is legacy internal naming.
- CORS allows only `http://localhost:3000` and `:3001`.

## Key env vars (never commit values)
`DATABASE_URL`, `JWT_SECRET_KEY`, `JWT_ALGORITHM`, `REDIS_URL`, `UPLOAD_DIR`,
`TESSDATA_PREFIX`, `VOYAGE_API_KEY`, `GOOGLE_API_KEY` (Gemini), `GOOGLE_CLIENT_ID`,
`APPLE_CLIENT_ID`, `TAVILY_API_KEY`, `GROQ_API_KEY`

## Open decisions / risks
- Mobile design handoff scope and component mapping.
- Test strategy for ingestion and chat (biggest pre-launch gap).
- Render + frontend deployment topology.
- Billing limits and plan definition.
