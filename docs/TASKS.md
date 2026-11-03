# PepperAI — Tasks

Owner legend: **C** = Claude (judgment), **O** = OpenCode (code), **G** = ChatGPT (analysis),
**M** = Gemini (large-context research).
"Claude gate" = must be reviewed/decided by Claude before the task is done.

## Now
| Task | Owner | Support | Claude gate | Status |
|---|---|---|---|---|
| ~~Sync local `main` with `origin/main`~~ | O | — | no | ✅ done 2026-10-19 (`d5b0d12`) |
| Critical-path test coverage: save → ingest → ready → chat with citation | O | G: test checklist | no | open |
| Mobile design handoff: read bundle → implementation spec | O | M/G: spec extraction | **yes** (scope decision) | open |
| Implement mobile design handoff | O | G: component checklist | **yes** (visual sign-off) | open |
| Launch plan: Vercel frontend + backend host + Google sign-in prod config | O | — | **yes** (host choice, domain, CORS allowlist) | open |
| Email deliverability check at signup (Abstract API) | O | — | **yes** (provider + fail-open policy) | ✅ code done 2026-10-19 (`2eb88a7`); needs `EMAIL_VERIFIER_API_KEY` + review |

## Next
| Task | Owner | Support | Claude gate | Status |
|---|---|---|---|---|
| Visual audit fix pass from `backup/Design/v2-audit/` (49 shots) | O | G: defect triage | **yes** (prioritize taste-impact) | open |
| Deploy backend on Render + frontend host | O | G: Render runbook | **yes** (pre-deploy risk review) | open |
| Real-device QA (phone + desktop) | O | G: test matrix | no | open |

## Later
| Task | Owner | Support | Claude gate | Status |
|---|---|---|---|---|
| Billing limits / plan definition | C | G: market scan | **yes** (product decision) | backlog |
| PepperLens pivot (when establishment checklist closes) | C | — | **yes** | blocked |

## Claude parking lot
<!-- Collect questions here during the week; Claude answers them in batch. -->
- 2026-10-19 OpenCode → Claude: launch planning started. Decisions needed before deploy:
  (1) backend host — Render vs Railway/Fly (user said Vercel only for frontend);
  (2) production domain + CORS allowlist values;
  (3) email verifier provider (code defaults to Abstract API, gated on
  `EMAIL_VERIFIER_API_KEY`) and fail-open-on-outage policy;
  (4) user asked for "physical DB visibility" of users — script provided
  (`scripts/inspect_users.py`); is a read-only admin users view acceptable for
  launch, or is that deferred?
  (5) user listed additional "external features" — not yet specified, awaiting list.

## Establishment checklist (exit criteria for PepperAI-as-priority)
- [ ] Critical path covered by automated tests
- [ ] Critical path smoke-tested manually end-to-end
- [ ] Mobile design handoff implemented
- [ ] Visual audit defects fixed or explicitly deferred
- [ ] Backend deployed (Render)
- [ ] Frontend deployed (HTTPS) + real-device QA passed
- [ ] `docs/CONTEXT.md` matches reality
