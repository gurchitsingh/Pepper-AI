# Pepper AI — Engineering/Deployment Context

This covers the stack, deployment, and operational history that isn't in DESIGN.md
(design system) or PRODUCT.md (product vision). Written after a deployment session
that took the app from local-only to live on the public internet.

## Stack and why each piece is there

| Layer | Service | Why |
|---|---|---|
| Frontend | Vercel | Static Vite/React build, free CDN hosting |
| Backend compute | Render (free Web Service, Docker) | The only layer actually running Python code 24/7 — FastAPI + the RQ worker, in one container (see below) |
| Database | Neon (Postgres + pgvector) | Free tier, pgvector built in, scale-to-zero |
| Redis / job queue | Upstash | Free tier, TCP (`rediss://`), used by RQ |
| Chat LLM | Groq (`openai/gpt-oss-120b`) | Swapped off Gemini — Gemini's free tier is 20 requests/day, shared across chat + suggested-questions + title-gen, and was exhausted by normal browsing alone. Groq's free tier is far more generous. |
| Transcription | Groq hosted Whisper (`whisper-large-v3`), falls back to local `faster-whisper` | `GROQ_API_KEY` set → Groq used; local fallback is memory-heavy, **disabled in production** via `DISABLE_LOCAL_WHISPER_FALLBACK=true` since Render's free tier only has 512MB RAM |
| Embeddings | Voyage AI | Unrelated to the chat-provider swap, untouched |
| Web search (chat fallback) | Tavily | Free tier, 1,000 credits/month, recurring |

**Why Render specifically**: Vercel is serverless (functions run per-request, then vanish) — it
cannot host the RQ worker, which has to sit idle and continuously poll Redis for ingestion jobs.
Neon and Upstash are pure storage, not compute. Render is the only one of the four actually
running `app/main.py` and `app/worker.py`.

**Why a `Dockerfile` instead of Render's native Python runtime**: needed to guarantee `ffmpeg`
is present (used by `yt-dlp` and local Whisper) — Render's native runtime doesn't document this
reliably. `start.sh` runs `alembic upgrade head`, then the worker in the background, then
`uvicorn` in the foreground — one container does both jobs since Render's free tier has no
separate Background Worker service type.

## Live deployment

- Frontend: https://pepper-ai-psi.vercel.app
- Backend: https://pepper-ai-orqt.onrender.com (`/health` for a status check)
- Repo: `github.com/gurchitsingh/Pepper-AI` (owned by a collaborator, not this account —
  GitHub App installs for Render/Vercel had to be granted by the repo owner separately from
  normal collaborator push access; this bit us twice during setup)

All secrets live in Render's and Vercel's own environment variable dashboards, not in the repo.
Local `.env` is gitignored and was never committed.

## Resolved: reel ingestion was hanging forever on Render

Saving a reel/short got stuck in `"processing"` forever. **Root cause found and fixed**
(commit `dd127e4`), after several iterations that fixed real-but-secondary issues along the way:

1. Added a 30s timeout to Groq LLM calls (real bug, fixed, but not the cause of this one)
2. Added a 60s timeout to Groq transcription calls (also real, also not the root cause)
3. Added `DISABLE_LOCAL_WHISPER_FALLBACK` to stop the container from attempting the
   memory-heavy local Whisper model on a 512MB host (reasonable risk-reduction, turned out to
   be unrelated to this specific bug but worth keeping)
4. **Discovered the app had no logging configuration at all** — `logging.basicConfig()` was
   never called anywhere, so every `logger.info()` call was silently dropped, and even
   `logger.warning()` only survived by accident via Python's logging "handler of last resort."
   Fixed in both `app/main.py` and `app/worker.py` (separate processes, each needed its own
   config). This was the key unlock — without it the real error was invisible.
5. With logging working, a Render log finally surfaced the actual exception:
   `rq.timeouts.JobTimeoutException: Task exceeded maximum timeout value (180 seconds)`, with a
   traceback showing it stuck inside yt-dlp's own `_get_ffmpeg_version()` — specifically a
   subprocess call running `ffmpeg -bsfs` to probe ffmpeg's capabilities, as part of yt-dlp's
   `FFmpegExtractAudio` postprocessor. That subprocess call was hanging indefinitely in
   production (reason for the hang itself not fully root-caused — some interaction between
   yt-dlp's internal ffmpeg invocation and this specific container environment).
6. First fix attempt (commit `dd127e4`): stopped using yt-dlp's `FFmpegExtractAudio`
   postprocessor, downloading raw audio and converting it via `extract_audio()` instead.
   **This looked right and passed a local test, but didn't actually fix it** — the exact same
   crash recurred in production with an identical traceback. Lesson: removing our own
   `postprocessors` entry wasn't enough, because it wasn't the actual trigger.
7. **Real fix** (commit `236397c`): the traceback showed the hang was inside yt-dlp's
   *automatic* `fixup()` step, which runs after every download regardless of configured
   postprocessors — for this reel's format (an `"m4a_dash"` container), it decided to
   auto-correct via `FFmpegFixupM4aPP`, which triggers the same hanging ffmpeg version-probe.
   Set `"fixup": "never"` in `ydl_opts`, which short-circuits that step before it ever touches
   ffmpeg (confirmed by reading yt-dlp's source: `if fixup_policy in ('ignore', 'never'):
   return`). Safe here since `extract_audio()` does its own conversion afterward regardless of
   the source container's quirks. Verified locally before pushing, **not yet confirmed against
   a fresh production retry** — the first "verified" fix also looked solid locally and still
   failed live, so don't trust this one either until a real Render retry confirms it.

## Operational gotchas learned this session

- **Local machine can't reach Neon (port 5432) or Upstash (port 6379) directly** — TCP connects
  fine, but the connection gets reset (RST) the instant a payload is sent. Confirmed not a
  credentials/SSL issue (tested with SSL disabled, with/without `channel_binding`). Most likely
  router/ISP-level port blocking. **Does not affect Render** — Render's network path is
  unaffected, confirmed by successful migrations/queries from there.
- **Render's `--reload`-equivalent (redeploy-on-push) has been unreliable** mid-session — it
  sometimes reports reloading but keeps running old code until a manual restart. If a fix
  doesn't seem to take effect, try a manual redeploy before assuming the fix is wrong.
- **GitHub App installs ≠ collaborator access.** Being a repo collaborator with push access does
  not let Render/Vercel see the repo — the repo *owner* has to explicitly grant the GitHub App
  access to that specific repo at `github.com/settings/installations`. This tripped up both the
  Render and Vercel setup steps.
- **CORS and JWT secret were hardcoded/placeholder values** before this session — fixed:
  `CORS_ORIGINS` is now a comma-separated env var (`app/main.py`), and `JWT_SECRET_KEY` is a
  real random secret (rotating it logs out all active sessions, expected).
- **Dedup-on-save** (`app/routers/saved_items.py`) treats anything that isn't `status="failed"`
  as "already saved" — so a stuck `"processing"` item blocks resubmitting the same URL until
  it's explicitly deleted or reconciled. `app/worker.py`'s `_recover_orphaned_jobs()` now
  handles the reconciliation automatically on every worker startup.

## Running locally

```powershell
docker compose up -d
.venv\Scripts\uvicorn.exe app.main:app --reload --port 8000
.venv\Scripts\python.exe -m app.worker
cd frontend; npm run dev
```

Local `.env` should **not** set `DISABLE_LOCAL_WHISPER_FALLBACK` — the local-fallback path is
fine on a real machine with real RAM; it's specifically a production (Render) safeguard.

## Not yet done

- Confirm the reel-ingestion crash fix (next retry + log check)
- `app/folders.py` (AI folder auto-naming) is still on Gemini, not migrated to Groq — out of
  scope of the chatbot swap, deliberately left as-is, still subject to Gemini's quota
- Capacitor/Play Store packaging (discussed, not started)
- No automated test suite exists
