# Design system

Tokens, primitives and the rules the funnel is built on. Everything lives in
`src/app/globals.css` and `src/components/ui/`.

---

## Two token layers

**Brand scales** — the raw AION palette, type, spacing, radii, shadows and
motion. These never change.

**Semantic tokens** — role names (`background`, `primary`, `border`, `ring`, …)
that the shadcn/ui primitives are written against. These are re-mapped per
surface, which is why the same `<Button>` renders correctly on warm white and
on deep navy without a single conditional class at the call site.

### Surfaces

Three classes swap the semantic layer for everything inside them:

| Class | Background | Used for |
|---|---|---|
| `.surface-light` | Warm white `#fdfcfa` | Default reading surface |
| `.surface-tint` | Warm grey `#f7f4ee` | Alternating bands |
| `.surface-dark` | Deep navy `#081525` | Emphasis bands and the funnel's context column |

This is a surface system, not a dark mode. The landing page alternates down the
page on purpose; `tests/browser/viewports.mjs` asserts no two adjacent bands
share a surface, in both the with-booking and without-booking configurations.

### Colour

| Token | Value | Role |
|---|---|---|
| `navy-900` | `#081525` | Dark surfaces, headings |
| `navy-850` | `#0b1d31` | Cards on dark |
| `charcoal-500` | `#5a6472` | Muted text on light |
| `charcoal-300` | `#9aa3ae` | Muted text on dark |
| `paper-100` | `#fdfcfa` | Default background |
| `paper-400` | `#e2dbca` | Borders |
| `electric-500` | `#1e63f2` | Primary action on light |
| `electric-400` | `#4d86ff` | Primary action on dark |
| `cyan-400` | `#4ec8e4` | Restrained accent on dark only |

Electric blue is for action. Cyan is for detail and appears only on dark
surfaces, where it has the contrast to earn its place.

### Type

A fluid display scale, so a 360px phone and a 1440px desktop each get a
headline that fills its measure without a pile of breakpoints.

| Token | Size | Use |
|---|---|---|
| `text-display` | `clamp(2rem, 1.35rem + 2.9vw, 3.5rem)` | Hero headline only |
| `text-h1` | `clamp(1.6rem, 1.2rem + 1.8vw, 2.5rem)` | Section and question headings |
| `text-h2` | `clamp(1.4rem, 1.15rem + 1.1vw, 2rem)` | Card headings |
| `text-h3` | `1.15rem` | Option labels, list headings |
| `text-lead` | `1.0625rem` | Supporting copy |
| `text-body` | `1rem` | Body |
| `text-small` | `0.9375rem` (15px) | Hints and captions |
| `text-eyebrow` | `0.75rem`, `0.18em` tracking, uppercase | Section eyebrows |

15px is the floor for anything a visitor reads. The eyebrow is smaller but
uppercase and widely tracked, and never carries information found nowhere else.
Form inputs are pinned to at least 16px so iOS Safari does not zoom on focus.

### Radii, elevation, motion

Radii: `xs .375` · `sm .5` · `md .75` · `lg 1` · `xl 1.25` · `2xl 1.5` · `pill`.

Shadows: `subtle` (inputs) · `card` (resting cards) · `lift` (raised) ·
`action` (primary buttons) · `bar` (the action area).

Motion: `--duration-feedback: 150ms` for control feedback (target band
120–180ms) and `--duration-step: 240ms` for step transitions (180–280ms), both
on `cubic-bezier(0.22, 1, 0.36, 1)`.

---

## Thumb-first sizing

| Token | Value | Applies to |
|---|---|---|
| `--tap-min` | 48px | Every interactive target |
| `--action-min` | 52px | Primary actions in a bottom action area |

`tests/browser/viewports.mjs` fails the build if any visible interactive
element measures under 48px at any of the five widths.

The answer card is the clearest case: the Radix control is stretched across the
whole card at zero opacity, so the real hit area is the card rather than a 24px
dot. The visible indicator is a decorative sibling driven by `peer-*`.

---

## Primitives

shadcn/ui components on Radix, vendored into `src/components/ui/` and adjusted
to the tokens above.

| Component | Notes |
|---|---|
| `button` | Variants `primary` / `secondary` / `ghost` / `quiet` / `destructive` / `link`; sizes `action` (52px) / `default` (48px) / `compact` / `icon`; built-in `loading` state that disables the button and sets `aria-busy` |
| `input` | 48px tall, 16px text, `aria-invalid`-driven error styling |
| `checkbox`, `radio-group` | Radix controls, native keyboard behaviour |
| `progress` | Radix progressbar with `aria-valuetext` |
| `accordion` | Radix, used for the FAQ |
| `choice-card` | AION answer option |
| `alert` | `role="alert"` for errors, `role="status"` otherwise |
| `section` | Landing band with a surface |
| `step-shell` | The funnel step frame |
| `recommendation-card` | The result, with a staggered reveal |

### States

Every interactive component carries all of: default, hover, **focus-visible**
(3px ring in `--ring`, never removed), **selected**, **loading**, **error** and
**disabled**. Selection is signalled three ways — border weight, background
tint and an explicit indicator — so it never depends on colour alone.

---

## Layout rules

**The funnel shell is exactly one viewport tall** (`--app-height`, resolving to
`100dvh` with a `100vh` fallback). The step region scrolls internally and the
action area is a flex sibling of it, never an overlay — which is what makes it
structurally incapable of covering an answer or a focused field.

**When the mobile keyboard opens**, `useKeyboardOpen` detects the
`visualViewport` shrink and the action area detaches, scrolling with the
content instead. A visitor is never pinned between the keyboard and a fixed
footer.

**On desktop**, `.container-step` caps the active question at 552px — inside
the 440–560px band — so the mobile layout is adapted rather than stretched. The
second column carries the answer summary, then the recommended service.

---

## Motion language

- Step changes: direction-aware, 16px on one axis plus opacity, 240ms.
  `AnimatePresence mode="wait"` means two steps are never in the DOM at once,
  so a fast double-tap cannot produce a duplicate transition.
- Controls: 150ms press feedback via the `.press` utility, which also covers
  keyboard activation.
- Progress: width-only, so nothing reflows.
- The recommendation: a short staggered fade in reading order. Decorative —
  the content is already in the DOM, and nothing waits on it.

Reduced motion is handled twice: `MotionConfig reducedMotion="user"` drops
transform animations while keeping opacity, and a CSS media query collapses
every remaining animation and transition. There are no artificial delays, no
fake analysis screens, no scroll-jacking, no pulsing CTAs and no confetti.

---

## Accessibility

Semantic elements throughout — real buttons, inputs, fieldsets, labels, and
Radix for the composite controls. The whole funnel is completable from the
keyboard. Focus moves to the new screen's live region on every step change and
is never lost to `<body>`. Errors are tied to their fields with `aria-invalid`
and `aria-describedby`. Progress is announced via `aria-valuetext`. Nothing
necessary is hidden behind an animation.
