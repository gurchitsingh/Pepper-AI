# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Heavy social/content consumers: people who save a lot of reels, videos, podcasts, articles, and notes day-to-day (mostly from mobile) and lose track of what they've saved. Their job is to capture something now with zero friction and actually be able to find and use it later, instead of it rotting in scattered bookmarks, screenshots, and "watch later" lists.

## Product Purpose

Pepper AI is a personal knowledge-management app. Users save anything (reels, videos, podcasts, articles, notes, voice notes, documents), the app extracts and transcribes the content automatically, and lets users chat with an AI that has context over everything they've saved. Success means saved content actually gets retrieved and used, not just archived.

## Positioning

The differentiator is the chat experience grounded strictly in the user's own saved corpus — answers come only from what the user personally saved, not general knowledge. Multi-format ingestion and auto-transcription are the plumbing that feeds this; the retrieval-grounded chat is the mechanism a competitor can't clone by just bolting on a "save" button.

## Operating Context

Users save items primarily from mobile: reels, videos, podcasts, articles, voice notes, quick notes, and documents (`.md`/`.txt`/`.pdf`/`.docx`), either by upload or URL. Saved items move through an async ingestion pipeline (`pending -> processing -> ready`/`failed`) before becoming chattable; notes are the one synchronous, no-queue path. New users go through onboarding slides, a preferences step, and a referral-source capture. A daily streak (computed client-side from saved-item timestamps) tracks the saving habit on the Home page.

## Capabilities and Constraints

- Ingestion by source type: article (trafilatura), YouTube (captions API, faster-whisper fallback for uncaptioned video), instagram/tiktok/voice_note (upload + faster-whisper), document (md/txt/pdf/docx; scanned/image-only PDFs fall back to OCR via Tesseract, English only), note (synchronous, no extraction).
- Auth: JWT (email/password via bcrypt) plus Google/Apple OAuth.
- Background processing via Redis + RQ; failures surface a clear `failure_reason` rather than silently storing empty/garbage transcripts.
- Backend: FastAPI + PostgreSQL (SQLAlchemy/Alembic). Frontend: React 19 + Vite + Tailwind + React Router — mobile-first responsive web, no native app wrapper.
- A free/paid plan distinction and usage-based billing (measured in seconds of submitted content) exist in the code, but the specific limits are still in flux — undecided, do not treat any current number as locked.

## Brand Commitments

The user-facing product name is **Pepper AI** (referred to simply as "Pepper" in-product, e.g. onboarding copy, header logo). The repository/codebase name "Weave AI" is a legacy internal name — future user-facing copy, docs, and design work should use "Pepper" / "Pepper AI", not "Weave AI".

## Evidence on Hand

None provided. No real testimonials, case studies, press mentions, or user research are available — future work must not fabricate these.

## Product Principles

- Capture must be effortless: any supported format reaches a ready, chattable state without manual user work.
- Chat answers are grounded only in what the user actually saved — never presented as drawing on outside knowledge.
- Failures are surfaced honestly (explicit failure reasons) rather than masked as silent empty results.
- Retrieval and habit matter as much as capture — the product exists to prevent saved content from being forgotten, which is why return-usage signals (like the streak) are part of the product, not just an engagement gimmick.
