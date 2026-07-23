---
name: Cyrus
colors:
  surface: '#121414'
  surface-dim: '#121414'
  surface-bright: '#38393a'
  surface-container-lowest: '#0c0f0f'
  surface-container-low: '#1a1c1c'
  surface-container: '#1e2020'
  surface-container-high: '#282a2b'
  surface-container-highest: '#333535'
  on-surface: '#e2e2e2'
  on-surface-variant: '#d6c4ae'
  inverse-surface: '#e2e2e2'
  inverse-on-surface: '#2f3131'
  outline: '#9f8e7a'
  outline-variant: '#524534'
  surface-tint: '#ffb950'
  primary: '#ffca80'
  on-primary: '#452b00'
  primary-container: '#f4a827'
  on-primary-container: '#644100'
  inverse-primary: '#825500'
  secondary: '#bbc6e2'
  on-secondary: '#263046'
  secondary-container: '#3e4960'
  on-secondary-container: '#adb8d3'
  tertiary: '#9edaff'
  on-tertiary: '#00344a'
  tertiary-container: '#40c3ff'
  on-tertiary-container: '#004e6b'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffddb3'
  primary-fixed-dim: '#ffb950'
  on-primary-fixed: '#291800'
  on-primary-fixed-variant: '#624000'
  secondary-fixed: '#d7e2ff'
  secondary-fixed-dim: '#bbc6e2'
  on-secondary-fixed: '#101b30'
  on-secondary-fixed-variant: '#3c475d'
  tertiary-fixed: '#c4e7ff'
  tertiary-fixed-dim: '#7cd0ff'
  on-tertiary-fixed: '#001e2c'
  on-tertiary-fixed-variant: '#004c69'
  background: '#121414'
  on-background: '#e2e2e2'
  surface-variant: '#333535'
typography:
  display:
    fontFamily: DM Sans
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: DM Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: DM Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: DM Sans
    fontSize: 24px
    fontWeight: '500'
    lineHeight: 32px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: DM Sans
    fontSize: 18px
    fontWeight: '300'
    lineHeight: 32px
    letterSpacing: 0.01em
  body-md:
    fontFamily: DM Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 28px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: DM Sans
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  container-padding: 24px
  gutter: 16px
  stack-sm: 8px
  stack-md: 24px
  stack-lg: 48px
---

## Brand & Style

This design system is built for a premium personal knowledge companion, focusing on intellectual clarity and cognitive ease. The aesthetic is **High-End Minimalism**—a synthesis of rigorous data structure and organic softness. 

The interface prioritizes content over chrome, utilizing a "calm-tech" philosophy where the UI recedes to let the user's thoughts lead. Visual interest is generated through precise typography and the interplay of light and shadow rather than decorative elements. The goal is to evoke the feeling of a quiet, well-lit digital study where every piece of information has a dedicated home.

## Colors

The palette is anchored in a sophisticated "Deep Navy" ecosystem for its primary dark mode, providing a low-strain environment for long-form reading and thinking. 

- **Primary (Accent):** Warm Amber (#F4A827) is used sparingly for high-intent actions, highlights, and status indicators. It provides a human, warm contrast to the cooler navy tones.
- **Surface (Dark):** The background is #0D1B2A. Secondary surfaces (cards) use a slightly lighter navy (#1B263B) to create subtle depth.
- **Surface (Light):** A pure white background with soft grey (#F2F4F7) secondary surfaces.
- **Text:** High-contrast off-white (#EAEAEA) for dark mode and deep charcoal (#1C1C1E) for light mode ensure maximum legibility without the harshness of pure black/white extremes.

## Typography

DM Sans is the sole typeface, chosen for its geometric purity and exceptional readability at low weights. 

The hierarchy is intentionally dramatic. **Display and Headlines** are bold and condensed in tracking to feel authoritative and architectural. **Body text** utilizes a lighter weight (300/400) with generous line-height (1.6x - 1.8x) to create a "breathable" reading experience that prevents cognitive fatigue. Information density is managed through whitespace rather than decreasing font size.

## Layout & Spacing

This design system uses a **Fluid-Fixed hybrid model**. On desktop, content is contained within a max-width of 1200px to maintain line-length readability, while sidebars and utility panels utilize fluid edges.

The spacing rhythm is based on an 8px grid. To achieve the "premium" feel, the system leans into "overspaced" margins—specifically using 48px or 64px vertical gaps between major content sections. Mobile layouts should maintain a minimum of 24px horizontal padding to reinforce the airy, high-end aesthetic.

## Elevation & Depth

Hierarchy is established through **Tonal Layering** and **Subtle Diffusion**. 

In dark mode, depth is not created with heavy black shadows, but with 1px semi-transparent borders (10% White) and very soft, large-radius shadows (20px-40px blur) with low opacity (0.15) tinted by the primary navy color. 

A subtle linear gradient (Top-Left to Bottom-Right) is applied to cards, moving from the secondary surface color to a slightly darker shade, giving elements a soft, tactile convexity. Backdrop blurs (12px-20px) are used on navigation bars and overlays to maintain context while focusing the user's attention.

## Shapes

The shape language is defined by "Super-ellipses." While the base system uses 0.5rem for small components like inputs and buttons, **major containers and cards utilize a signature 24px (1.5rem) or 32px (2rem) radius**. 

This extreme roundedness softens the data-heavy nature of the app, making the knowledge base feel approachable and organic. Interactive elements should feel "squishy" and tactile, avoiding sharp corners entirely.

## Components

- **Cards:** The hallmark of the UI. Use a 24px corner radius, 1px border (#FFFFFF10 in dark mode), and a subtle gradient fill. No heavy drop shadows; use a soft ambient glow.
- **Buttons:** Primary buttons use the Warm Amber fill with deep charcoal text. Secondary buttons are "Ghost" style with a 1px border. All buttons use 32px height for a compact, precise feel, or 48px for main CTAs.
- **Inputs:** Minimalist underlining or soft-filled rectangles with 8px radius. Focus states should be indicated by the Warm Amber border color, never a thick "glow."
- **Chips/Tags:** Used for categorization. These should be pill-shaped with low-contrast backgrounds and slightly increased letter spacing for the labels.
- **Knowledge Nodes:** Small, circular or highly rounded elements that represent data points, using the accent color for active states.
- **Progressive Disclosure:** Use subtle chevron icons and smooth transitions to hide/show complex data, keeping the initial view distraction-free.