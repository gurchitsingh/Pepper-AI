# PepperAI — Decisions

Format per entry:
```
## YYYY-MM-DD — Title
Status: accepted | proposed | superseded
Decision:
Rationale:
Alternatives considered:
Consequences / acceptance criteria:
Owner: Claude | OpenCode | ChatGPT | Gemini
Revisit when:
```

---

## 2026-01-01 — Chat model is Gemini `gemini-flash-latest`
Status: accepted
Decision: chat and suggestion generation use the alias `gemini-flash-latest`, not a dated model.
Rationale: a pinned dated model 404'd when Google retired it; the alias keeps the endpoint alive.
Alternatives: pin an exact model (broke once), switch provider.
Consequences: model behavior can change silently; review prompt quality after model changes.
Owner: Claude
Revisit when: chat quality regresses or a new Gemini tier is released.

## 2026-01-01 — Grounded-only chat with a web-search fallback
Status: accepted
Decision: answers use only saved-corpus excerpts; the `INSUFFICIENT_CONTEXT` sentinel
triggers a live web search, clearly labelled as a web source.
Rationale: the product principle is that answers come only from what the user saved.
Consequences: users see honest "not in your saved content" behaviour.
Owner: Claude
Revisit when: pricing/plan model is finalized.

## 2026-10-19 — Portfolio order: PepperAI establishment → PepperLens main focus
Status: accepted
Decision: push PepperAI to basic establishment (tested + deployed + stable), then move
primary effort to PepperLens. Vinyl stays in backlog.
Rationale: PepperAI needs a stable base; PepperLens is the strategic main focus but has
no research corpus yet.
Consequences: new capacity goes to PepperAI tasks until the establishment checklist closes.
Owner: Claude
Revisit when: the "establishment" checklist in `docs/TASKS.md` is fully checked.
