---
name: Pepper AI
description: A warm, tactile knowledge companion for capturing and chatting with everything you save
colors:
  bg: "#121212"
  surface: "#201C1A"
  text-primary: "#F2EEE9"
  text-secondary: "#A39C93"
  accent: "#F08A3C"
  accent-contrast: "#171310"
  error: "#E5484D"
  success: "#2F9E5B"
typography:
  display:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "normal"
  headline:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "normal"
  title:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "normal"
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.625rem"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "0.1em"
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  full: "9999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  2xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-contrast}"
    rounded: "{rounded.full}"
    height: "48px"
    padding: "0 32px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.full}"
    height: "44px"
  button-danger:
    backgroundColor: "{colors.error}"
    textColor: "#ffffff"
    rounded: "{rounded.full}"
    height: "44px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "16px"
  chip-active:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-contrast}"
    rounded: "{rounded.full}"
    padding: "8px 16px"
  chip-inactive:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.full}"
    padding: "8px 16px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
    padding: "12px 16px"
---

# Design System: Pepper AI

## Overview

**Creative North Star: "The Warm Study"**

Pepper reads like a cozy, personal workspace rather than a productivity tool: a warm serif for headings, soft glass-like surfaces, and hand-drawn blob illustrations that make the app feel like a notebook lit by lamplight, not a dashboard. It's built to hold a *lot* of disparate content (reels, PDFs, voice notes, articles) without ever feeling clinical or archival — the interface stays calm and single-accented so the content, not the chrome, is what stands out.

Density is low and forgiving: generous padding, one primary action per screen, short line lengths, and a bottom-tab structure that never asks the user to hold more than five destinations in mind at once. Depth is soft and physical — surfaces lift gently off the page and buttons press down when tapped — so the app feels like a well-made object you're handling, not a flat document you're scrolling. Nothing here is sharp-cornered, heavy, or loud; the one accent color is the only thing allowed to raise its voice.

**Key Characteristics:**
- One warm serif display voice (Fraunces) paired with a quiet, highly-legible sans (Inter) for everything functional.
- A single accent color per theme carries all emphasis and interactivity; neutrals do everything else.
- Soft, diffused, natural-light shadows on cards and buttons — never a hard, dark UI-kit drop-shadow.
- Fully-rounded pill shapes for every tappable action; generously-rounded rectangles for containers.
- Fast (120–250ms), physical micro-motion: press-scale on tap, staggered list reveals, spring-based modal entrances.

## Colors

The palette is intentionally monochrome-plus-one: a neutral background/surface/text scale that barely changes across the five built-in themes, and exactly one accent hue that gives each theme its whole personality. Users pick a theme as a first-class preference (Settings), not a light/dark toggle — all five are equally supported, not a "default + alternates."

### Primary
- **Amber Ember** (`#F08A3C`, default "Orange & Black" theme): the sole accent — primary buttons, active nav/tab state, active filter chips, focus rings, icon tint inside avatar circles, links.

### Neutral
- **Near-Black Canvas** (`#121212`): page background.
- **Warm Charcoal Surface** (`#201C1A`): card, input, and modal background (`glass-card`).
- **Warm Ivory** (`#F2EEE9`): primary text.
- **Muted Taupe** (`#A39C93`): secondary/meta text, placeholders, inactive icons.
- **Accent Contrast** (`#171310`): text/icon color placed on top of the accent (e.g. inside primary buttons).

### Named Rules
**The One Accent Rule.** Exactly one accent color is active at a time. It marks primary actions, active/selected state, and emphasis — nothing else in the interface competes with it for attention.

### Theme family (all five equally valid, selected via Settings)

| Theme | bg | surface | text-primary | text-secondary | accent | accent-contrast |
|---|---|---|---|---|---|---|
| **Orange & Black** (default, dark) | `#121212` | `#201C1A` | `#F2EEE9` | `#A39C93` | `#F08A3C` | `#171310` |
| **Muted Indigo** (dark) | `#14161F` | `#1E212C` | `#E7E9F0` | `#8C90A3` | `#5B63A8` | `#FFFFFF` |
| **Charcoal & Electric Blue** (dark) | `#16181C` | `#202329` | `#EDEEF0` | `#8C9099` | `#4F8FF0` | `#FFFFFF` |
| **Deep Plum & Rose** (dark) | `#201621` | `#2B1E2C` | `#F2E9EC` | `#A08C9E` | `#D9899E` | `#2B1E2C` |
| **Warm Cream & Forest** (light) | `#F7F3E9` | `#FFFFFF` | `#1E2A1E` | `#6E7A6A` | `#2F5233` | `#FFFFFF` |

Every theme keeps the same six-role structure (`bg`/`surface`/`text-primary`/`text-secondary`/`accent`/`accent-contrast`) — new themes should follow this exact shape rather than introducing new roles.

Two semantic colors are **fixed across every theme** so state stays recognizable regardless of which theme is active: **Signal Red** (`#E5484D`, errors, destructive actions, failed status) and **Signal Green** (`#2F9E5B`, success/ready status).

## Typography

**Display/Headline/Title Font:** Fraunces (variable, optical-size + weight axis `9..144, 300..700`), with Georgia/serif fallback
**Body Font:** Inter, with system-ui/sans-serif fallback

**Character:** Fraunces is warm, high-contrast, slightly editorial — it's the app's one moment of personality per screen (a page title, a stat number, the "Pepper" wordmark). Inter is quiet and gets out of the way for everything the user actually has to read or type.

### Hierarchy
- **Display** (700, 1.875rem/`text-3xl`, 1.2): onboarding slide titles — the single largest, most ceremonial text in the app.
- **Headline** (700, 1.5rem/`text-2xl`, 1.25): page titles ("Log in to Pepper", "Library", "Chat with Pepper", the "Pepper" header wordmark).
- **Title** (600–700, 1.125–1.25rem/`text-lg`–`text-xl`, 1.3): section headers within a page ("Recent saves", "Theme", "Account") and stat numbers on Home.
- **Body** (400–500, 1rem/`text-base`, 1.5): paragraph text, form inputs, button labels, list item titles.
- **Label** (500, 0.625–0.75rem/`text-[10px]`–`text-xs`, uppercase, `tracking-widest`): the small source-type badges above list items ("NOTE", "ARTICLE") and stat captions ("SAVED", "READY").

### Named Rules
**The Two-Voice Rule.** Fraunces speaks only for headings, the wordmark, and standalone numbers — never for body copy, labels, or button text. Inter carries every functional string in the app. Mixing them within a single line of text doesn't happen anywhere in the system.

## Layout

Mobile-first, single-column by default, built around a fixed header (64px, blurred) and fixed bottom tab bar, with `pt-24`/`pb-32` main-content insets so scrolling content never sits under either. Page content is centered and width-capped depending on the content's natural reading width:
- **600px** — Home, Save (short-form feed/action screens).
- **700px** — Chatbot, saved-item detail (content that benefits from a slightly wider column, like transcripts and chat bubbles).
- **1200px** — Library grid and the app header (the one place with real horizontal breathing room, since it's a grid, not prose).
- **max-w-sm / max-w-lg / max-w-xs** — forms and modals (auth screens, confirmation dialogs), intentionally narrower than the app shell.

Library's grid responds by column count, not by container width: 1 column on mobile, 2 at `sm` (640px), 3 at `lg` (1024px) — cards keep a fixed comfortable size rather than stretching.

Rhythm runs on an 8px base: tight groups use `gap-2`/`gap-3` (8–12px), sections use `gap-4`/`gap-8` (16–32px), and page-level padding is `px-6` (24px) almost everywhere.

## Elevation & Depth

Depth is soft, diffused, and physical — meant to read as natural light falling on real surfaces, never as a stock UI-kit drop-shadow. Two things carry it: a wide, low-opacity ambient shadow (`--shadow-card`, `--shadow-button`) that makes cards and primary buttons feel gently lifted off the page, and a frosted blur (`backdrop-blur-md` at 80% opacity) on the fixed header, which is the one place translucency itself is the depth cue. Cards additionally get a 1px near-transparent white top inset to suggest a glass edge catching light.

Buttons flatten to a much tighter, lower shadow on `:active` (`--shadow-button-pressed`) so the primary action visibly presses into the surface on tap — paired with the existing `whileTap` scale-down, this is what makes buttons feel physically pressable rather than just color-swapped.

### Shadow Vocabulary
- **Card (ambient lift)** (`inset 0 1px 0 rgba(255,255,255,0.05), 0 1px 2px rgba(0,0,0,0.14), 0 12px 28px -10px rgba(0,0,0,0.32)`): every `glass-card` surface — list items, stat tiles, forms, modals, source cards.
- **Button (resting)** (`0 2px 4px rgba(0,0,0,0.16), 0 6px 16px -6px rgba(0,0,0,0.28)`): primary accent pill buttons at rest.
- **Button (pressed)** (`0 1px 2px rgba(0,0,0,0.18)`): primary accent pill buttons on `:active` — the "pushed in" state.

### Named Rules
**The Natural Light Rule.** Shadows are always wide, soft, and low-opacity — large blur radius, negative spread, black at ≤32% opacity. A shadow that reads as a hard, dark edge (anything resembling `shadow-lg`/`shadow-xl` defaults) doesn't belong in this system.

## Shapes

Two corner languages, split by function: **fully-rounded pills** (`rounded-full`) for anything you tap as an action — primary/secondary/danger buttons, nav items, filter chips, avatar circles, the theme swatches in Settings — and a **fixed rounded-rectangle scale** for containers that hold content — inputs and small chips at 8px (`rounded-lg`), chat source cards and theme swatch buttons at 12px (`rounded-xl`), the dominant card radius at 16px (`rounded-2xl`), and modal sheets at 24px (`rounded-3xl`), the single largest radius in the system reserved for the "biggest" surface on screen. Borders are rare and always a low-opacity neutral hairline (`rgba(255,255,255,0.05)`–`rgba(text-secondary, 0.1–0.2)`), never a hard full-opacity stroke.

### Named Rules
**The Full-Pill Rule.** If it's tappable and represents an action (not a container), it's `rounded-full`. Containers step through the fixed 8/12/16/24px scale instead — never a bespoke radius outside it.

## Components

### Buttons
- **Shape:** fully rounded (`rounded-full`, 9999px).
- **Primary:** accent background, accent-contrast text, `font-medium`, fixed height (44–56px depending on context: 48px standard, 56px for the Home "Save something" CTA). Carries the resting button shadow, flattens to the pressed shadow on `:active`, and scales to 0.9–0.97 on tap (`whileTap`).
- **Secondary/Ghost:** surface background (or transparent), secondary-text color, thin neutral border — used for low-emphasis actions like "Cancel" and "New Session".
- **Danger:** error-colored background or error-tinted outline (`border-error/40 text-error`) — reserved for destructive actions (sign out).
- **Disabled:** `opacity-50`, no other visual change; never removes the shape or shadow.

### Chips (filter/toggle pills)
- **Style:** `rounded-full`, small (`text-sm`, `px-4 py-2`), icon + label.
- **State:** active = accent background + accent-contrast text + accent border; inactive = surface background + secondary text + subtle neutral border. Scales to 0.95 on tap.

### Cards / Containers (`glass-card`)
- **Corner Style:** 16px (`rounded-2xl`) standard; 12px for compact nested cards (chat source cards); 24px for modal sheets.
- **Background:** surface color, with the ambient card shadow and a barely-visible white top inset for a glass edge.
- **Shadow Strategy:** see Elevation & Depth — soft ambient lift, never a hard shadow.
- **Border:** 1px near-transparent white hairline (`rgba(255,255,255,0.05)`).
- **Internal Padding:** 16px standard (`p-4`), 24px for larger forms/modals (`p-6`/`p-8`).

### Inputs / Fields
- **Style:** surface background, 1px secondary-text-at-20%-opacity border, 8px radius (`rounded-lg`), 16px/12px padding. Pill-shaped (`rounded-full`) specifically inside the chat composer, matching its send-button pill.
- **Focus:** 2px accent focus ring (`focus:ring-2 focus:ring-accent`), no border-color change.
- **Error:** inline error text below in Signal Red; the field itself doesn't change color.

### Navigation
- **Header:** fixed, full-width, 64px tall, translucent background (`bg-bg/80`) with `backdrop-blur-md` — wordmark in Fraunces on the left, a circular avatar-style settings link on the right.
- **Bottom tab bar:** fixed, 5 destinations, icon + 11px label per tab. Active tab is accent-colored with a slightly bolder icon stroke (2.5 vs 2); inactive tabs are secondary-text colored. Each tab scales to 0.9 on tap.

### Signature Component: Onboarding Illustrations
Flat, single-color-plus-tint SVG mascot illustrations: solid accent-colored shapes for the subject, a soft ~14–18%-opacity accent "blob" glow behind it, and `accent-contrast` used only for tiny inner details (eyes, small marks). No gradients, no photographic imagery, no outline-only icon style — these read as warm, hand-drawn, and belong only to onboarding/empty-state moments, not general UI chrome.

## Do's and Don'ts

### Do:
- **Do** use exactly one accent color per theme for every interactive/emphasis moment; keep everything else neutral.
- **Do** give every tappable action a fully-rounded (`rounded-full`) shape.
- **Do** use soft, wide, low-opacity shadows (`--shadow-card` / `--shadow-button`) for lift — large blur, negative spread, ≤32% black opacity.
- **Do** pair a `whileTap` scale-down with a matching `:active` shadow flatten on primary buttons, so press feedback is both motion and depth.
- **Do** reserve Fraunces for headings, the wordmark, and standalone numbers; keep Inter for everything else.

### Don't:
- **Don't** use a hard, dark, or heavy drop-shadow (`shadow-lg`/`shadow-xl`-style defaults) anywhere — it breaks the soft/natural-light language.
- **Don't** introduce a second accent color on the same screen, even for a "secondary" action — use neutral surface/border treatments instead.
- **Don't** give a container (card, modal, input) a bespoke corner radius outside the 8/12/16/24px scale, or give a button anything less than fully rounded.
- **Don't** use photographic or gradient imagery for illustrations — the flat, single-tint blob-and-icon style is the only illustration language this system has.
