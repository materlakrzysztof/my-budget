# Sticky Navigation Header Implementation Plan

## Overview

Make the navigation header (`Topbar`) stick to the top of the viewport so it stays
visible while the page scrolls. The header currently lives in normal document flow
and scrolls away with the page. This change pins it flush to the top with a frosted,
readable background, layered below modal dialogs, on all breakpoints.

## Current State Analysis

- **`src/components/Topbar.astro:13`** — the nav header. Root element is a
  `<div class="mb-4 flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 ... sm:flex-row ...">`.
  It is a semi-transparent frosted-ish card in **normal document flow** (`mb-4`
  spacing), so it scrolls off-screen with the page. It renders user email, the
  Dashboard / Add Expense / Settings links, and a Sign out form (or Sign in / Sign
  up when logged out).
- **`src/layouts/Layout.astro:39-42`** — wraps the header:
  `<div class="p-4 sm:p-8"><Topbar /></div>` immediately followed by `<slot />`.
  This padding wrapper is the key structural gotcha: a naive `sticky top-0` on the
  inner card would leave the wrapper's `p-4 sm:p-8` padding _above_ the pinned
  header, so page content would peek through that gap while scrolling.
- **`src/layouts/Layout.astro:22-38`** — `<body class="bg-cosmic">` renders a
  config-error `Banner` (only when `missingConfigs` is non-empty) **above** the
  padding wrapper, then the Topbar wrapper, then `<slot />`.
- **Pages** (`dashboard.astro:15`, `expenses.astro:23`, `settings.astro`) each wrap
  their own content in `<div class="bg-cosmic min-h-screen p-4">` with `mt-8`
  frosted cards (`rounded-2xl border border-white/10 bg-white/10 ... backdrop-blur-xl`).
  Content will scroll _under_ the sticky header, so the header background must be
  readable over arbitrary scrolling content — hence the frosted treatment.
- **Scroll container**: the document/`body` itself (no custom `overflow` wrapper),
  so plain CSS `position: sticky` on a top-level child works without extra plumbing.
- **Dialogs** (`src/components/ui/dialog.tsx:29,51`) render a `fixed inset-0 z-50`
  overlay and a `z-50` content panel. The sticky header must sit **below** `z-50` so
  modals continue to cover it — target `z-40`.
- **Aesthetic**: the app uses translucent frosted cards throughout
  (`bg-white/10 backdrop-blur-xl`) over a `bg-cosmic` gradient
  (`linear-gradient(to bottom, #0a0e1a, #0f1529, #0a0e1a)`, `global.css:113-115`).

## Desired End State

Scrolling any page keeps the navigation header pinned flush to the top of the
viewport. The header has an opaque cosmic-toned `backdrop-blur` background, so links
and email remain readable as content scrolls beneath it. The header
spans the full viewport width, sits below open dialogs, and behaves identically on
mobile and desktop. The config-error Banner remains in normal flow (scrolls away).

Verify by scrolling `/dashboard`, `/expenses`, and `/settings`: the header stays at
the top, content passes cleanly (blurred) underneath, no padding gap shows above the
header, and opening an expense/category dialog fully covers the header.

### Key Discoveries:

- Topbar must be lifted out of `Layout.astro`'s `p-4 sm:p-8` wrapper and given its
  own internal padding, otherwise the wrapper padding creates a gap above the pinned
  header (`Layout.astro:39-42`).
- Header must be `z-40` (below dialog `z-50` — `dialog.tsx:29,51`).
- Use an always-opaque cosmic-toned background (`bg-[#0f1529]`) with
  `backdrop-blur-md`. This guarantees readability without a browser-specific
  fallback path; the blur remains a subtle enhancement where supported.
- No JS/hydration needed — Topbar is a static `.astro` component; keep it that way.

## What We're NOT Doing

- No scroll-driven behavior (no shadow/elevation-on-scroll, no hide-on-scroll-down).
  The header's appearance is static — no client-side JS added.
- No mobile header redesign — the existing `flex-col` → `sm:flex-row` layout is kept
  as-is; it simply becomes sticky (it is slightly taller on mobile, accepted).
- No pinning of the config-error `Banner` — it stays in normal flow and scrolls away.
- No changes to page-level content wrappers, cards, links, auth, or navigation
  targets.

## Implementation Approach

Two coordinated edits:

1. **`Layout.astro`** — lift `<Topbar />` out of the `p-4 sm:p-8` padding wrapper so
   it can pin flush at `top-0` as a full-width bar. The former wrapper padding is
   absorbed into the Topbar component and the page content (pages already provide
   their own `p-4` content padding).
2. **`Topbar.astro`** — make the header a `sticky top-0 z-40` full-width bar with its
   own horizontal/vertical padding, and swap the background to an opaque cosmic-toned
   `backdrop-blur` treatment so scrolled content stays readable.

The `cn()` helper / `class:list` conventions already in use are preserved; Tailwind
utility classes carry the change.

## Phase 1: Sticky frosted header

### Overview

Restructure the Layout so the header pins flush to the top, and restyle Topbar as a
sticky, frosted, full-width bar that content scrolls cleanly beneath while dialogs
still cover it.

### Changes Required:

#### 1. Layout: lift Topbar out of the padding wrapper

**File**: `src/layouts/Layout.astro`

**Intent**: Remove the `p-4 sm:p-8` wrapper that currently boxes `<Topbar />` so the
header can span full width and pin flush to `top-0` without a padding gap above it.
The Banner stays where it is (above the header, in normal flow). Page content already
supplies its own padding via each page's `p-4` content wrapper.

**Contract**: `<Topbar />` is rendered directly as a body-level child (no
surrounding `p-4 sm:p-8` div), positioned after the `Banner` map and before
`<slot />`. The header's own padding now lives in `Topbar.astro` (change #2).

#### 2. Topbar: sticky, frosted, full-width bar

**File**: `src/components/Topbar.astro`

**Intent**: Make the header root a full-width sticky bar pinned to the top on all
breakpoints, with its own internal padding (replacing the removed wrapper padding)
and a frosted background that keeps content readable as it scrolls underneath. Keep
it below dialogs.

**Contract**: The root element becomes a full-width sticky container. Required
utility semantics on the header root:

- `sticky top-0 z-40` — pins flush to the viewport top on all breakpoints, below
  dialog `z-50`.
- Own padding matching the previous wrapper rhythm (`p-4 sm:px-8` scale) plus the
  inner card spacing, so links aren't flush against the viewport edge.
- Opaque cosmic-toned background: `bg-[#0f1529] backdrop-blur-md`. The opaque base
  guarantees readability when `backdrop-filter` is unavailable or disabled; blur is
  a subtle enhancement where supported.
- Remove the `mb-4` bottom-margin-in-flow reliance where it no longer applies (the
  bar is now pinned; spacing below is handled by page content's own top padding /
  `mt-8` cards). Preserve the existing `border`/rounded treatment or adapt it to a
  full-width bar (bottom border instead of a floating rounded card) as fits a pinned
  header.

The existing `linkClass()` active-state logic, the `user ? … : …` branches, links,
and the Sign-out form are unchanged — only the root container's positioning,
padding, and background change.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run build` (Astro type-check runs in build)
- Linting passes: `npm run lint`
- Formatting is clean: `npx prettier --check src/layouts/Layout.astro src/components/Topbar.astro`

#### Manual Verification:

- On `/dashboard`, `/expenses`, and `/settings`, scrolling keeps the header pinned to
  the top of the viewport.
- Page content scrolls _underneath_ the header and remains legible through the
  frosted background (no unreadable text bleed-through).
- No padding gap appears above the pinned header (content does not peek over it).
- The header spans the full viewport width and does not overflow horizontally.
- Opening the Add/Edit Expense dialog and the Category dialog fully covers the header
  (dialog `z-50` sits above the header `z-40`).
- On a narrow (mobile) viewport the header still pins and remains usable; the
  `flex-col` layout is intact.
- When a config-error Banner is present (missing env var), the Banner scrolls away
  normally and the header pins to the top — no visual collision that hides the nav.
- Active-link highlighting still reflects the current route.

**Implementation Note**: After completing this phase and all automated verification
passes, pause here for manual confirmation from the human that the manual testing was
successful before considering the change complete.

---

## Testing Strategy

### Unit Tests:

- None. This is a presentational Astro-template change with no logic; there is no
  unit-testable behavior added. Existing tests must remain green.

### Integration Tests:

- None required. Existing navigation E2E/integration coverage (if any) must remain
  green — the links, routes, and auth flows are unchanged.

### Manual Testing Steps:

1. `npm run dev`, sign in, open `/dashboard`.
2. Scroll down — confirm the header stays pinned at the top and content passes
   legibly beneath the frosted background.
3. Repeat on `/expenses` and `/settings`.
4. On `/expenses`, open the Add Expense dialog — confirm it fully covers the header.
5. Narrow the window to a mobile width — confirm the header still pins and the
   `flex-col` layout is intact and usable.
6. (If reproducible) run with a missing env var so the config Banner shows — confirm
   the Banner scrolls away and the header pins without hiding navigation.

## Performance Considerations

`backdrop-blur` has a minor GPU cost but is already used pervasively
(`backdrop-blur-xl` on every page card), so it introduces no new class of cost. The
opaque cosmic base guarantees readability without relying on the blur. No JS is
added, so no hydration or scroll-listener overhead.

## Migration Notes

None — no data or schema involved.

## References

- Header component: `src/components/Topbar.astro:13`
- Layout wrapper to restructure: `src/layouts/Layout.astro:39-42`
- Dialog z-index (must stay above header): `src/components/ui/dialog.tsx:29,51`
- Cosmic background token: `src/styles/global.css:113-115`
- Example page content wrapper: `src/pages/dashboard.astro:15`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Sticky frosted header

#### Automated

- [x] 1.1 Type checking passes (`npm run build`) — e6b3d5b
- [x] 1.2 Linting passes (`npm run lint`) — e6b3d5b
- [x] 1.3 Formatting is clean (`npx prettier --check src/layouts/Layout.astro src/components/Topbar.astro`) — e6b3d5b

#### Manual

- [x] 1.4 Header stays pinned to top while scrolling on /dashboard, /expenses, /settings — e6b3d5b
- [x] 1.5 Content scrolls underneath and stays legible through frosted background — e6b3d5b
- [x] 1.6 No padding gap appears above the pinned header — e6b3d5b
- [x] 1.7 Header spans full width without horizontal overflow — e6b3d5b
- [x] 1.8 Open dialogs (expense/category) fully cover the header (z-40 below z-50) — e6b3d5b
- [x] 1.9 Header pins and remains usable on a mobile-width viewport — e6b3d5b
- [x] 1.10 Config-error Banner scrolls away without hiding the pinned nav — e6b3d5b
- [x] 1.11 Active-link highlighting still reflects the current route — e6b3d5b
