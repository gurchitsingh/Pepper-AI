# Redesign v2 — fidelity pass

## Scope note: `Design/v2/` doesn't exist

The brief for this pass pointed at `Design/v2/` (a Claude Design export including a
design-system page) as the source of truth. That path doesn't exist anywhere in the
repo or its other worktrees. What actually exists is a flat, gitignored `Design/`
folder (only present in the main checkout, not in worktrees) with one subfolder per
screen — `pepper_ai_home`, `pepper_ai_premium_chatbot`, `pepper_ai_updated_save_hub`,
`pepper_ai_refined_settings_profile`, `pepper_ai_library`, `pepper_ai_insights`,
`pepper_ai_refined_sign_up`, `pepper_ai_referral_survey`, `pepper_ai_animated_onboarding`,
`pepper_ai_narrative` — each with a `code.html` and (mostly) a `screen.png`. There is no
"Usage and plan" or "Streak sheet" export, and no dedicated tokens/design-system page.
Confirmed with the user before proceeding; agreed to treat the flat `Design/` folder as
the reference, mapping names to the closest matching screen.

## A second, more consequential mismatch

The per-screen `code.html` exports are **not** built on this app's design system. They're
independent AI-generated mockups (Material-You-style token names — `surface-container`,
`on-surface-variant`, etc. — a different accent `#ffb694` instead of the app's `#F08A3C`,
12px card radius instead of 16px, a different font scale). They read as earlier/alternate
concept explorations, not a literal spec to copy pixel values from.

The actual, coherent design-system source of truth already living in this repo is
[`DESIGN.md`](../DESIGN.md) (root of this worktree) — it has real tokens (colors, type
scale, radii, spacing, shadow vocabulary, named rules like "The One Accent Rule" and "The
Full-Pill Rule") and the shipped app already implements it closely. Copying the `Design/`
exports' literal colors/radii instead would have pulled the app *away* from its own
documented system and violated the brief's own "tokens only, no one-off hardcoded values"
and "never use a second accent color" rules.

**Decision:** `DESIGN.md` is treated as the token source of truth. The `Design/` screen
exports are used only for layout/content/IA reference (what sections exist, what states
are shown), not literal color/radius/shadow values.

## What was actually found and fixed

A full grep for hardcoded hex colors, arbitrary Tailwind radius/shadow values
(`rounded-[...]`, `shadow-[...]`, `style={{...}}`) across `frontend/src` turned up
basically nothing outside the Google "G" logo's brand colors (`GoogleSignInButton.tsx`,
correctly exempt). The app's token discipline is already good. Two real, concrete issues
were found and fixed:

1. **Token drift risk (the literal ask).** `frontend/src/theme/themes.ts` (consumed by
   the theme-swatch UI in Settings/Preferences) and `frontend/src/index.css` ([data-theme]
   CSS blocks, consumed by the rest of the app) were two independently-maintained copies
   of the same dark/light color values — currently in sync, but nothing enforced that.
   Fixed: `themes.ts` is now the single source of truth. `ThemeContext`'s provider applies
   a theme's CSS custom properties at runtime from `THEMES` (see `applyThemeColors` in
   [`ThemeContext.tsx`](../frontend/src/theme/ThemeContext.tsx)). `index.css`'s `:root`
   block keeps only the dark/default values, needed for first paint before React mounts,
   explicitly commented as the one intentional duplicate. Verified live: switching
   Dark ⇄ Light in Settings still recolors the whole app correctly.

2. **`SavedItemCard` didn't use the shared card treatment.** It used a bespoke
   `bg-surface border border-text-secondary/15 rounded-xl` instead of the `.glass-card`
   utility class, so saved-item cards (used on Home and Library, the single
   highest-traffic card in the app) had no ambient shadow, no glass top-inset border, and
   a 12px radius instead of the system's 16px standard card radius (`DESIGN.md` is
   explicit that list items get the full `glass-card` treatment at 16px, same as stat
   tiles/modals). Fixed in
   [`SavedItemCard.tsx`](../frontend/src/components/SavedItemCard.tsx): now
   `glass-card rounded-2xl`, matching `StatRing` and other cards. Verified live in both
   themes at 390×844 and 1280px.

## State coverage checked

`SavedItemCard` already handles all four saved-item states distinctly (`ready` /
`pending` / `processing` / `failed`, each with its own badge color and, for `failed`,
the failure reason in place of the transcript preview) — no gap found there.

## Bug found, not fixed (backend, out of scope)

When a chat request's LLM call fails upstream — reproduced live with the shared Gemini
free-tier quota exhausted (`429 RESOURCE_EXHAUSTED`, expected/ignorable per the other
parallel sessions sharing the same key) — the `/chat` endpoint returns **200 OK** with
the raw stringified Python exception as the answer body. The frontend has no way to
distinguish that from a real answer, so it renders the full exception dict, unstyled and
overflowing, as if Pepper had actually replied. This is a backend bug (the chat endpoint
needs to turn an upstream failure into a proper error response), not a token/visual
issue, and the brief is explicit that this pass makes no backend changes — so it's
reported here rather than fixed. The frontend-side error path
(`Chatbot.tsx`'s `catch` block around `api.chat`) is already reasonable for real
`ApiError`s; it just never gets a chance to run because the backend doesn't surface this
case as an error.

## Deviations / not done, and why

- **No literal design-system page existed to diff tokens against** (see above) — the
  type-scale/radii/spacing numbers named in the original brief (32/24/20/16/14/12,
  card radius 20, input radius 16) don't match either `DESIGN.md` or the `Design/`
  exports and weren't applied; `DESIGN.md`'s own scale (display 30px/headline 24px/
  title 18–20px/body 16px, card radius 16px via `rounded-2xl`, input radius 8px via
  `rounded-lg`, pills `rounded-full`) was kept since the shipped app already implements
  it and it's internally consistent.
- **5-theme system.** `DESIGN.md` and the Settings design export both describe/show five
  themes (Orange & Black, Muted Indigo, Charcoal & Electric Blue, Deep Plum & Rose, Warm
  Cream & Forest); the shipped app and this task's brief both only cover two (dark/light).
  Implementing the other three is a real feature, not a token fix — out of scope here.
- **"Recent Captures" strip on the Save sheet.** The `pepper_ai_updated_save_hub` export
  shows a horizontally-scrolling "Recent Captures" section below the four action tiles;
  the shipped Save screen doesn't have one. New component/data-wiring, not a token fix —
  flagged, not built.
- **Settings page IA differences** (profile edit affordance, account-management
  interaction pattern, 2FA/export-data rows) vs. the `pepper_ai_refined_settings_profile`
  export are product/IA decisions tied to the existing username/email-editing feature on
  another branch, not visual tokens — left alone.
- **Before/after screenshot matrix.** The brief asked for Playwright screenshots of 8
  screens × 2 themes at 390×844, plus 3 screens at 1280px, before and after, saved to
  `Design/v2-screenshots/`. Playwright itself isn't a project dependency here (fetched
  ad hoc via `npx` to check availability, not installed). Verification was done instead
  via the built-in browser tool, live, after each fix, including a full manual
  click-through (see below) — but a persisted before/after screenshot set was not
  produced. If that artifact is actually needed, it's a follow-up: add `@playwright/test`
  as a devDependency and a small screenshot script.

## Verification performed

- `npx tsc -b` — clean.
- `npm run build` — clean (pre-existing >500kB chunk-size warning only, unrelated to this
  change).
- Manual click-through against the local dev stack (own backend on :8106, own frontend
  on :3104, isolated from other parallel sessions): signed up a local test account →
  Home (empty state) → Save a link → Library (processing → ready) → opened the item
  (article content rendered) → Chat → asked the suggested question about the saved item.
  No console errors at any step. Confirmed in both Dark and Light, at 390×844 and
  1280px for Home/Library/Settings.
- Theme switching (Settings → Dark/Light) re-verified after the `ThemeContext` token
  refactor — still recolors correctly.

## Problems noticed outside this task's scope (not touched)

- The chat-error-rendering bug above (backend).
- Nothing else observed in the explicitly off-limits areas (header/app-shell, signup/
  verify/onboarding, document upload UI, `public/` icons) during this pass — not
  inspected in depth since they're owned by other parallel sessions.
