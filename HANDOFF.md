# Handoff — Pepper AI deployment/debugging session

You're picking this up cold from another agent that ran out of context. Read this whole file
before doing anything. `context.md` in this same directory has the longer-form engineering
writeup (stack, architecture, gotchas) — read that second, for depth. This file is the
operational state: what's actually happening right now and what to do next.

## Repo state right now

- Branch `main`, clean, fully pushed (`43437c2` is HEAD, matches `origin/main`)
- One untracked file: `context.md` — ask the user if they want it committed, don't assume
- The repo is shared: owned by `gurchitsingh` on GitHub, the user you're talking to is a
  collaborator (push access), their friend owns the account. Both Render's and Vercel's GitHub
  App access had to be granted by the friend separately — if you ever hit "repo not showing up"
  in a deploy dashboard again, that's almost certainly the cause, not a bug.

## What's live right now

- Frontend: https://pepper-ai-psi.vercel.app (Vercel, auto-deploys from `main`)
- Backend: https://pepper-ai-orqt.onrender.com (Render, Docker, auto-deploys from `main`,
  `/health` returns `{"status":"ok","database":"connected"}` when healthy)
- Signup, login, CORS, DB connectivity: all confirmed working end-to-end against the real
  deployment, not just locally.

## Probably resolved, but treat with caution — a "confirmed" fix already failed once

**Saving a reel/short on the live deployed app was getting stuck in `"processing"` forever.**
Currently on fix attempt #2 (commit `236397c`). **Do not trust a local test alone on this bug**
— fix attempt #1 (`dd127e4`) passed a local end-to-end test, was written up as "resolved" in
these docs, and then failed identically in production on the very next real-world retry. Only
trust this is actually fixed once a fresh Render log confirms a reel saved successfully.

Chain of fixes that got here, in order (first several were real bugs but not this one's cause):

1. Groq LLM calls had no timeout — fixed, unrelated to this bug.
2. Groq transcription call had no timeout — fixed, also unrelated.
3. Added `DISABLE_LOCAL_WHISPER_FALLBACK` env var (set `true` on Render) to avoid the
   memory-heavy local Whisper model on a 512MB host — reasonable to keep, turned out unrelated
   to this specific bug.
4. **Key unlock**: the app had *zero* logging configuration anywhere — `logging.basicConfig()`
   was never called, so `logger.info()` was silently dropped everywhere, and even
   `logger.warning()` only survived by accident. Fixed in `app/main.py` and `app/worker.py`
   (two separate OS processes, each needs its own `basicConfig()` call).
5. With logging finally working, a Render log surfaced the real exception:
   `rq.timeouts.JobTimeoutException: Task exceeded maximum timeout value (180 seconds)`, with a
   traceback showing it stuck inside yt-dlp's internal `_get_ffmpeg_version()` — a subprocess
   call running `ffmpeg -bsfs`, hanging indefinitely in production. (Why that specific
   subprocess call hangs in this container isn't fully root-caused — both fixes below sidestep
   it rather than explain it.)
6. **Fix attempt #1** (`dd127e4`): stopped using yt-dlp's `FFmpegExtractAudio` postprocessor,
   downloading raw audio and converting it via the existing `extract_audio()` helper instead.
   Passed a local end-to-end test. **Failed in production with an identical traceback on the
   next real retry.** Turned out this wasn't the actual trigger.
7. **Fix attempt #2** (`236397c`, current): the repeat traceback revealed the hang is actually
   inside yt-dlp's *automatic* `fixup()` step, which runs after every download regardless of
   configured postprocessors — for this reel's format (an `"m4a_dash"` container), yt-dlp
   decided to auto-correct it via `FFmpegFixupM4aPP`, which triggers the same hanging ffmpeg
   probe. Set `"fixup": "never"` in `ydl_opts` (confirmed from yt-dlp's own source: `if
   fixup_policy in ('ignore', 'never'): return`, before `ffmpeg_fixup()` is ever called). Safe
   since `extract_audio()` does its own conversion afterward regardless of container quirks.
   Passed the same local test attempt #1 passed — **which is exactly why that's not enough
   evidence this time.**

### What to do next on this problem

Ask the user to retry a reel save on the live app and paste fresh Render logs. Look for either:
- Success (item reaches `"ready"` with a transcript) → genuinely fixed, update this doc to say so
- The identical `JobTimeoutException` traceback again → attempt #2 also failed; the `"fixup":
  "never"` theory was wrong or incomplete. Next angle to try: `yt-dlp` accepts an
  `"ffmpeg_location"` option — pointing it at a known-working ffmpeg binary path might avoid
  whatever `_get_ffmpeg_version()`'s own `Popen` call is doing differently from our working
  `extract_audio()` subprocess call (which does *not* open `stdin=subprocess.PIPE` — that's a
  concrete difference between the two code paths worth investigating if this recurs)
- A *different* error entirely → new, separate issue, don't assume it's related to this one

**Still true, unrelated to the above**: direct DB/Redis access to Neon/Upstash from the *user's
local machine* is blocked by their network (confirmed: TCP connects, then gets reset the instant
a payload is sent — not a credentials issue, tested extensively). Does **not** affect Render
itself. Don't waste time re-diagnosing this if you hit it — ask the user to paste Render's logs
instead, or check if you have network access Render-side.

**Still true, unrelated to the above**: direct DB/Redis access to Neon/Upstash from the *user's
local machine* is blocked by their network (confirmed: TCP connects, then gets reset the instant
a payload is sent — not a credentials issue, tested extensively). Does **not** affect Render
itself. Don't waste time re-diagnosing this if you hit it — ask the user to paste Render's logs
instead, or check if you have network access Render-side.

## User preferences learned this session (don't relitigate)

- **Correct them plainly when they're wrong, with evidence** — they explicitly value this over
  polite agreement (e.g., corrected an "it's not free" claim with actual current pricing data
  rather than conceding or guessing).
- **Verify facts rather than assume**, especially anything with a knowledge-cutoff risk (API
  pricing, platform policies, SDK behavior) — this user has caught stale/wrong assumptions
  before and pushed back hard when a claim wasn't checked first.
- **Be economical with paid/rate-limited API calls during testing** — they explicitly said not
  to "overdo tests" to avoid draining free-tier quotas (Groq, Voyage, Tavily). Prefer direct
  DB/log inspection over live app testing when diagnosing issues, and don't retry AI-backed
  calls repeatedly "just to be sure."
- **Git safety**: always `git pull` before pushing (this repo has two active contributors —
  branch divergence has happened more than once), never force-push, stage files explicitly
  (not `git add -A`), write real commit messages explaining *why*.
- They're on Windows (PowerShell primary, Git Bash tool available), local dev requires Docker
  Desktop to be manually launched each session (it's not kept running).

## Full stack quick-reference

Frontend: Vercel (Vite/React) · Backend: Render (Docker, FastAPI + RQ worker in one container)
· DB: Neon (Postgres + pgvector) · Queue: Upstash (Redis) · Chat LLM: Groq
(`openai/gpt-oss-120b`) · Transcription: Groq Whisper, local `faster-whisper` fallback (disabled
in prod) · Embeddings: Voyage AI · Web search: Tavily. All API keys live in Render's and
Vercel's own env var dashboards — never in the repo, `.env` is gitignored and was never
committed.

See `context.md` for the full gotcha list (GitHub App permissions, Render reload flakiness,
dedup-on-save interactions, etc.) — several of these will bite you again if you don't read them
first.
