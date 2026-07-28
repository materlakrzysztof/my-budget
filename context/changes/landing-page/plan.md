# Public Landing Page Implementation Plan

## Overview

Replace the untouched starter boilerplate at `/` with a real public landing page for
**MyBudget** that describes the app's shipped capabilities, and route authenticated
visitors straight to the dashboard. This is roadmap slice **S-12 `landing-page`**
(PRD **FR-021**). Copy ships in English for now — the Polish message-key layer is a
separate, not-yet-built slice (**S-11 `polish-ui`**) that will translate these
strings later.

## Current State Analysis

- **`src/pages/index.astro`** is a 9-line page that renders `<Welcome />` inside
  `<Layout>`. No auth handling.
- **`src/components/Welcome.astro`** is the untouched 10x-astro-starter boilerplate:
  an English "10x Astro Starter" hero with generic subcopy and three feature cards
  ("Authentication Ready", "Modern Stack", "Developer Experience"). It carries an
  on-brand cosmic aesthetic — `bg-cosmic` background, blurred gradient orbs, a
  radial-gradient star field, a centered hero with gradient-text headline + two CTA
  buttons (`Sign In` / `Sign Up`, equal weight), and a `sm:grid-cols-3` feature-card
  grid (`rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl`). This
  styling is worth reusing; only the copy/structure of the content changes.
- **`/` is public** — `src/middleware.ts:4` lists only `/dashboard`, `/expenses`,
  `/settings` as `PROTECTED_ROUTES`. Middleware resolves the user onto
  `context.locals.user` for **every** request (including `/`), then redirects
  *unauthenticated* users away from protected routes. There is **no** redirect for
  *authenticated* users hitting `/` today — they see the boilerplate landing with the
  Topbar showing their email.
- **The dashboard exists** — `monthly-dashboard` shipped (`src/pages/dashboard.astro`
  live at `/dashboard`), so the authed redirect has a real target.
- **`src/layouts/Layout.astro`** renders `<Topbar />` on every page and accepts a
  `title` prop defaulting to `"10x Astro Starter"` (`Layout.astro:11`), used in
  `<title>{title}</title>` (`Layout.astro:20`). `index.astro` currently passes no
  title, so the landing's browser tab reads "10x Astro Starter".
- **`Topbar.astro`** already renders `Sign in` / `Sign up` links for a logged-out
  visitor (`Topbar.astro:37-49`) — so reusing it on the landing needs no change.
- **No i18n / message-key layer exists** (confirmed: no `locales`/`messages`
  directory; S-11 is "ready", not done). The whole app is currently English, so
  English landing copy is consistent with the app as it stands today.

## Desired End State

- An **unauthenticated** visitor to `/` sees a MyBudget landing page: a product hero
  (headline, subcopy, a primary **Sign up** CTA and a secondary **Sign in** action)
  and a three-card grid describing shipped capabilities — expense logging &
  categories, the monthly dashboard, and per-user currency — rendered in the existing
  cosmic style. The browser tab reads a real MyBudget title.
- An **authenticated** visitor to `/` is redirected server-side to `/dashboard`
  before any landing content renders (no flash).
- The existing auth-redirect behavior is unchanged: unauthenticated users hitting
  `/dashboard`, `/expenses`, `/settings` still go to `/auth/signin`; sign-in/session
  behavior is untouched (FR-014 guardrail).

Verify: logged out, `/` shows the MyBudget landing; logged in, `/` lands on
`/dashboard`. `npm run build` / `lint` / `format` clean.

### Key Discoveries:

- The authed redirect belongs in `index.astro` frontmatter using the already-resolved
  `Astro.locals.user` — no middleware change needed, keeping the global auth guardrail
  untouched (`middleware.ts:18-22`).
- `Welcome.astro`'s cosmic scaffolding (orbs, star field, hero, card grid) is reusable
  as-is; this is a copy + structure rewrite, not a restyle.
- `Layout` already supports a `title` prop — the landing just needs to pass one; a
  meta description can be added to `Layout`'s `<head>` if desired.
- English copy should be written so it's straightforward to lift into message keys in
  S-11 (plain, self-contained strings) — a soft consideration, not a hard contract.

## What We're NOT Doing

- **Not** translating to Polish or building the message-key layer — that is S-11
  `polish-ui`. Copy ships in English and gets keyed later.
- **Not** advertising unbuilt features — no AI-assisted free-text entry
  (FR-025–028) on the landing.
- **Not** building a long-form marketing page — no screenshots, testimonials,
  pricing, or a "how it works" section beyond the hero + feature cards.
- **Not** adding a dedicated marketing header or suppressing the Topbar — the shared
  `Topbar` is reused as-is.
- **Not** touching `middleware.ts`, `PROTECTED_ROUTES`, or the unauthenticated-user
  auth redirect.
- **Not** changing the auth pages (`/auth/signin`, `/auth/signup`) or their flows.

## Implementation Approach

Two small, sequenced phases:

1. **Behavior first** — add the auth-aware server redirect in `index.astro` and give
   the page a real title/meta. This is the guardrail-sensitive, functionally testable
   piece; isolating it lets us verify redirect behavior independent of content.
2. **Content** — rewrite `Welcome.astro` in place into the MyBudget landing (hero +
   feature cards, English, MyBudget branding, Sign-up-primary CTA), reusing the
   existing cosmic layout.

## Phase 1: Auth-aware redirect + page metadata

### Overview

Route authenticated visitors from `/` to `/dashboard` server-side, and give the
landing page a real MyBudget title/meta — without touching global auth behavior.

### Changes Required:

#### 1. Authed redirect in the landing page

**File**: `src/pages/index.astro`

**Intent**: When an authenticated user requests `/`, redirect them to the dashboard
before rendering any landing content, so authed users land on `/dashboard` (FR-021)
with no content flash. Unauthenticated users fall through to the landing.

**Contract**: In the frontmatter, read `Astro.locals.user` (populated by middleware
for every request) and, when it is truthy, `return Astro.redirect("/dashboard")`
before the component renders. The middleware and `PROTECTED_ROUTES` are not modified.

#### 2. Real page title / meta for the landing

**File**: `src/pages/index.astro` (and, if a meta description is wanted,
`src/layouts/Layout.astro`)

**Intent**: Replace the default "10x Astro Starter" tab title with a MyBudget title
so the public page has correct branding/SEO. Optionally add a meta description.

**Contract**: `index.astro` passes a `title` prop to `<Layout>` (e.g. a MyBudget
landing title). If a meta description is added, `Layout.astro` gains an optional
`description` prop rendered as `<meta name="description">` in `<head>`; the default
`title` fallback in `Layout.astro:11` may also be updated away from "10x Astro
Starter". Keep the `Layout` prop interface backward-compatible (optional props) so
other pages are unaffected.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run build`
- Linting passes: `npm run lint`
- Formatting is clean: `npm run format`

#### Manual Verification:

- Logged out, visiting `/` renders the landing (not a redirect).
- Logged in, visiting `/` lands on `/dashboard` with no visible flash of the landing.
- Unauthenticated access to `/dashboard`, `/expenses`, `/settings` still redirects to
  `/auth/signin` (guardrail unchanged).
- The browser tab for `/` shows the MyBudget title, not "10x Astro Starter".

**Implementation Note**: After completing this phase and all automated verification
passes, pause for manual confirmation that redirect behavior is correct before
starting Phase 2.

---

## Phase 2: Product landing content

### Overview

Rewrite the boilerplate `Welcome.astro` into the MyBudget landing: a product hero and
a three-card feature grid describing shipped capabilities, in the existing cosmic
style, with a Sign-up-primary CTA.

### Changes Required:

#### 1. Rewrite the landing component

**File**: `src/components/Welcome.astro`

**Intent**: Replace the starter boilerplate content with MyBudget landing content
while keeping the existing cosmic scaffolding (background, orbs, star field, hero
layout, card grid). Communicate what the app does to an unauthenticated visitor.

**Contract**: Content deltas within the existing structure:
- **Hero**: headline names/positions MyBudget (personal budget / expense tracking);
  subcopy is a one–two line English value statement; CTAs become a **primary** "Sign
  up" button (`/auth/signup`, filled purple style) and a **secondary** "Sign in"
  action (`/auth/signin`, quieter outline/link style) — a clear visual hierarchy,
  unlike the current equal-weight pair.
- **Feature cards** (three, reusing the `sm:grid-cols-3` grid and card styling):
  each describes a **shipped** capability — (1) log & categorize expenses, (2) the
  monthly dashboard (per-category chart, headline total, month-over-month), (3)
  per-user currency. Card icons may be swapped to fit the new topics; the existing
  inline-SVG pattern is retained.
- All copy is English, written as plain self-contained strings (eases later keying in
  S-11). No AI-assisted-entry messaging.
- No change to the `Welcome` usage site beyond what Phase 1 already did in
  `index.astro`.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run build`
- Linting passes: `npm run lint`
- Formatting is clean: `npm run format`

#### Manual Verification:

- `/` (logged out) shows a MyBudget hero with a clearly primary "Sign up" button and
  a secondary "Sign in" action; both link to the correct auth routes.
- The three feature cards describe only shipped capabilities (logging/categories,
  dashboard, currency) — no mention of AI/free-text entry.
- No remaining "10x Astro Starter" / generic-starter copy anywhere on the page.
- Layout is legible and correct on both mobile and desktop widths.
- The cosmic styling (orbs, star field, gradient hero) renders as before.

**Implementation Note**: After completing this phase and all automated verification
passes, pause for manual confirmation that the landing content and CTAs look correct.

---

## Testing Strategy

### Unit Tests:

- None — the changes are an Astro page/component (markup + a server-side redirect
  branch) with no extractable business logic. Existing unit tests must stay green.

### Integration Tests:

- Optional but recommended given the auth guardrail: an E2E check that (a) logged out
  `/` renders the landing and (b) logged in `/` redirects to `/dashboard`. If added,
  follow the `/10x-e2e` workflow and existing auth E2E patterns. Existing auth/nav E2E
  coverage must remain green.

### Manual Testing Steps:

1. `npm run dev`; while **logged out**, open `/` — confirm the MyBudget landing with a
   primary "Sign up" and secondary "Sign in".
2. Sign in, then navigate to `/` — confirm you land on `/dashboard` with no flash.
3. While logged in, hit `/dashboard`/`/expenses`/`/settings` directly — confirm normal
   access; sign out and confirm they redirect to `/auth/signin`.
4. Inspect the browser tab title on `/` — confirm MyBudget branding.
5. Resize to a mobile width — confirm the hero and cards remain legible.

## Performance Considerations

Negligible. The redirect is a server-side branch in already-rendered SSR; the landing
reuses existing static markup and CSS utilities (the `backdrop-blur`/gradient work is
already present). No new client-side JS.

## Migration Notes

None — no data or schema involved. No route is removed (`/` remains valid), so no
bookmarks break.

## References

- Roadmap slice: `context/foundation/roadmap.md` S-12 (lines 123–133)
- PRD requirement: `context/foundation/prd.md` FR-021 (line 202), FR-020 (line 200),
  FR-014 guardrail (line 182)
- Landing component to rewrite: `src/components/Welcome.astro`
- Landing page + redirect site: `src/pages/index.astro`
- Auth middleware (do not modify): `src/middleware.ts:4,18-22`
- Layout title/head: `src/layouts/Layout.astro:11,20`
- Topbar logged-out CTAs (reused): `src/components/Topbar.astro:37-49`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Auth-aware redirect + page metadata

#### Automated

- [x] 1.1 Type checking passes (`npm run build`)
- [x] 1.2 Linting passes (`npm run lint`)
- [x] 1.3 Formatting is clean (`npm run format`)

#### Manual

- [x] 1.4 Logged out, `/` renders the landing (no redirect)
- [x] 1.5 Logged in, `/` redirects to `/dashboard` with no content flash
- [x] 1.6 Unauthenticated `/dashboard`, `/expenses`, `/settings` still redirect to `/auth/signin`
- [x] 1.7 Browser tab title on `/` shows MyBudget branding, not "10x Astro Starter"

### Phase 2: Product landing content

#### Automated

- [x] 2.1 Type checking passes (`npm run build`)
- [x] 2.2 Linting passes (`npm run lint`)
- [x] 2.3 Formatting is clean (`npm run format`)

#### Manual

- [x] 2.4 `/` shows a MyBudget hero with primary "Sign up" + secondary "Sign in" linking to correct routes
- [x] 2.5 Three feature cards describe only shipped capabilities (no AI/free-text mention)
- [x] 2.6 No remaining "10x Astro Starter" / generic-starter copy on the page
- [x] 2.7 Layout is legible on both mobile and desktop
- [x] 2.8 Cosmic styling (orbs, star field, gradient hero) renders as before
