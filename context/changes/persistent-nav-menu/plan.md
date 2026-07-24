# Persistent Nav Menu Implementation Plan

## Overview

Add a persistent nav menu reachable from every authenticated page (Dashboard,
Expenses, Categories, and a new Settings placeholder), plus a matching header
on the public landing page. This is roadmap slice S-04
(`context/foundation/roadmap.md`) and the north star of the v2 iteration
(`context/foundation/prd-v2.md` FR-001, FR-005, US-01) — it closes the #1 gap
named in that PRD's Problem Statement: there is no consistent way to move
between the app's core areas today.

## Current State Analysis

- `src/layouts/Layout.astro:21-38` is a bare HTML shell — it renders a config
  banner and `<slot />`, nothing else. Every page brings its own content with
  zero cross-links between them.
- `src/components/Topbar.astro` **already exists** and already does almost
  everything FR-001 asks for: it's user-aware (`Astro.locals.user`), and when
  authenticated renders links to Dashboard/Categories/Expenses plus a
  sign-out form; when not, it renders Sign in/Sign up. The only place it's
  rendered today is inside `src/components/Welcome.astro:2,28` — i.e. only on
  the public landing page (`/`), never on the protected pages that actually
  need it. This is the concrete, fixable root cause of "no nav."
- `src/middleware.ts:4` (`PROTECTED_ROUTES`) lists `/dashboard`, `/categories`,
  `/expenses` — no `/settings` yet.
- `src/pages/dashboard.astro`, `expenses.astro`, `categories.astro` each wrap
  their own content in an independent `bg-cosmic min-h-screen p-4` div
  (e.g. `src/pages/categories.astro:12`). `Layout.astro`'s `<body>` itself has
  no background styling.
- "Add expense" is not a route — it's dialog state
  (`src/components/expenses/ExpensesManager.tsx:34,53-57`) toggled by a button
  on `/expenses`. There's no existing mechanism to open it from elsewhere.
- No `/settings` page exists.
- No shadcn primitive beyond `button`, `dialog`, `input`, `textarea` is
  installed (`src/components/ui/`) — confirms staying with plain
  Tailwind/text links rather than adding a new component (e.g. a Sheet
  drawer) for this slice.
- `tests/e2e/helpers.ts` has `signUpAndSignIn(page, email, password)`, which
  signs up + signs in and lands on `/` — useful as the entry point for the
  new nav spec. No test in the suite overrides viewport size today; this
  plan's e2e spec introduces that pattern.

## Desired End State

Any authenticated page shows a persistent bar (extended `Topbar.astro`)
linking to Dashboard, Add Expense, Categories, and Settings, with the current
page visually indicated and a working sign-out action — reachable from
Dashboard, Expenses, Categories, and the new Settings placeholder alike, at
both mobile and desktop widths. The public landing page keeps (and continues
to render, now via `Layout.astro` instead of `Welcome.astro`) its existing
sign-in/sign-up header for signed-out visitors. Clicking "Add Expense"
lands the user on `/expenses` with the add-expense dialog already open.
Verify via: sign in, land on `/`, use the nav to reach each of the four
destinations and back, confirm the active link updates, confirm sign-out
works from a non-Dashboard page, and confirm the same at a mobile viewport.

### Key Discoveries:

- `Topbar.astro` reuse eliminates the need for any new nav component —
  extend the existing one and wire it into `Layout.astro` (`src/layouts/Layout.astro:21`).
- Because each page today supplies its own `bg-cosmic` background
  independently of `Layout.astro`, adding `Topbar` to `Layout.astro` without
  addressing this would place the nav bar on a plain (non-cosmic) background
  above each page's own cosmic div, creating a visible seam. Simplest fix:
  add the `bg-cosmic` utility class directly to `Layout.astro`'s `<body>`
  (`src/layouts/Layout.astro:21`) so there's no seam; each page's own
  `bg-cosmic` div underneath is then a harmless no-op duplicate of the same
  gradient, not a visual conflict.
- FR-001 names "Add Expense" (not "Expenses") as the nav destination, and
  US-01's acceptance criteria requires reaching the add-expense form
  "directly from nav" — so the existing "Expenses" link in `Topbar.astro`
  should be relabeled "Add Expense" and point at `/expenses?action=add`,
  read by `expenses.astro` and passed to `ExpensesManager` to auto-open the
  dialog once.

## What We're NOT Doing

- Not building S-05 (expense name/description), S-06 (category drill-down),
  or S-07 (currency setting) functionality — Settings is a placeholder only;
  the currency UI it will eventually hold is out of scope here.
- Not adding any new shadcn primitive (no Sheet/drawer/navigation-menu) — the
  responsive approach stays plain Tailwind on the existing text-link bar.
- Not changing the auth flow, session handling, or sign-in/sign-up pages.
- Not adding icons to the nav — `Topbar.astro` is a plain Astro component
  today (no client-side JS); staying text-only keeps it that way (0 KB of
  shipped JS for the nav itself).
- Not re-testing existing direct-URL access to `/dashboard`, `/expenses`,
  `/categories` — already covered by the existing e2e suite, which this
  plan's Phase 1 verification re-runs in full to catch regressions.

## Implementation Approach

Extend the existing `Topbar.astro` in place (add a Settings link, rename
"Expenses" to "Add Expense" with its query-param target, add active-link
styling, adjust responsive classes) and render it from `Layout.astro` instead
of only from `Welcome.astro`, so every page gets it for free with one change.
Add the small new `/settings` placeholder route and its middleware entry.
Separately, wire the "Add Expense" deep link into `ExpensesManager` via a
query param read server-side by `expenses.astro`. Finish with a new e2e spec
covering nav reachability at both a desktop and mobile viewport — the
explicit guardrail this slice must not break.

## Phase 1: Wire the nav into every page

### Overview

Extend `Topbar.astro`, render it globally from `Layout.astro`, add the
`/settings` placeholder route, and remove now-redundant code (the duplicate
`Topbar` call in `Welcome.astro`, the duplicate sign-out button on
Dashboard).

### Changes Required:

#### 1. Extend the nav bar

**File**: `src/components/Topbar.astro`

**Intent**: Add the missing "Settings" destination, retarget the expense
link at the add-dialog deep link, indicate the current page, and keep the
bar usable at mobile widths with five items instead of three.

**Contract**: In the authenticated branch, add a `Settings` link to
`/settings` alongside the existing Dashboard/Categories links; rename the
existing "Expenses" link's label to "Add Expense" and its `href` to
`/expenses?action=add`. Read `Astro.url.pathname` in frontmatter and apply an
active-state class (e.g. a distinct text color/underline) to whichever link's
`href` pathname (ignoring query string) matches the current pathname exactly
— `/expenses?action=add` is active whenever the pathname is `/expenses`.
Change the outer container from `flex items-center justify-between` to wrap
gracefully (e.g. `flex flex-col gap-2 sm:flex-row sm:items-center
sm:justify-between`, and the links row from `flex gap-3` to `flex flex-wrap
gap-3`); hide the user's email on narrow viewports (e.g. `hidden sm:inline`)
to leave room for five links plus sign-out. Leave the unauthenticated branch's
two links as-is except for the same flex-wrap defensive change.

#### 2. Render the nav from the shared layout

**File**: `src/layouts/Layout.astro`

**Intent**: Make the nav appear on every page (authenticated and public)
without touching each page individually, and give the `<body>` the same
cosmic background so the bar doesn't sit on a mismatched background above
each page's own cosmic div.

**Contract**: Import `Topbar` and render `<Topbar />` inside `<body>`,
after the existing config-banner block and before `<slot />`, wrapped in a
padding container consistent with how `Welcome.astro` already pads it (e.g.
`p-4 sm:p-8`). Add the `bg-cosmic` utility class to the `<body>` tag.

#### 3. Remove the now-duplicate Topbar call on the landing page

**File**: `src/components/Welcome.astro`

**Intent**: Avoid rendering `Topbar` twice on `/` now that `Layout.astro`
renders it globally.

**Contract**: Remove the `import Topbar from "@/components/Topbar.astro"`
line and the `<Topbar />` usage (`src/components/Welcome.astro:2,28`); leave
everything else (hero, feature cards) unchanged.

#### 4. Protect the new Settings route

**File**: `src/middleware.ts`

**Intent**: Ensure an unauthenticated visitor hitting `/settings` is
redirected to sign-in like the other three protected pages.

**Contract**: Add `"/settings"` to the `PROTECTED_ROUTES` array
(`src/middleware.ts:4`).

#### 5. Add the Settings placeholder page

**File**: `src/pages/settings.astro` (new)

**Intent**: Give the nav's Settings link a real, non-broken destination
until S-07 (currency setting) fills it in.

**Contract**: Follow the same structure as `src/pages/categories.astro` —
`Layout` with `title="Settings"`, a `bg-cosmic min-h-screen p-4` wrapper, a
centered glass card, an `<h1>` reading "Settings", and one paragraph of
placeholder copy (e.g. "More settings are coming soon."). No data fetching
needed.

#### 6. Remove the duplicate sign-out control

**File**: `src/pages/dashboard.astro`

**Intent**: Avoid two sign-out controls on one page now that nav has one
everywhere.

**Contract**: Remove the `<form method="POST" action="/api/auth/signout">`
block and its button; keep the rest of the Dashboard card (welcome message)
unchanged.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Build succeeds: `npm run build`
- Full existing e2e suite still passes: `npm run test:e2e` (regression check — this phase touches a shared layout used by every page)

#### Manual Verification:

- Signed in, the nav is visible and shows Dashboard/Add Expense/Categories/Settings/Sign out on Dashboard, Expenses, Categories, and Settings
- The active link visually reflects the current page on each of those four pages
- Visiting `/settings` while signed out redirects to sign-in, matching the other three protected routes
- At a narrow (mobile) viewport, all five nav items remain reachable (wrap, don't clip or overlap)
- Signing out from a non-Dashboard page (e.g. Categories) works and lands the user back at a signed-out state
- The signed-out landing page (`/`) still shows exactly one Sign in/Sign up header, unchanged from before this phase
- Existing bookmarked direct links to `/dashboard`, `/expenses`, `/categories` still load normally (no broken routes)

---

## Phase 2: Add Expense deep link from nav

### Overview

Make the "Add Expense" nav link land the user on the add-expense dialog
already open, per US-01's "reach the add-expense form directly" acceptance
criterion.

### Changes Required:

#### 1. Read the deep-link query param

**File**: `src/pages/expenses.astro`

**Intent**: Detect the `?action=add` query param server-side and pass it
down to the island that owns the dialog state.

**Contract**: Compute `const autoOpenAdd = Astro.url.searchParams.get("action") === "add";`
and pass `autoOpenAdd={autoOpenAdd}` as a new prop to `<ExpensesManager />`.

#### 2. Auto-open the dialog once

**File**: `src/components/expenses/ExpensesManager.tsx`

**Intent**: Open the add-expense dialog automatically when arriving via the
deep link, without reopening it on a later refresh or back-navigation.

**Contract**: Add an optional `autoOpenAdd?: boolean` prop to
`ExpensesManagerProps` (`src/components/expenses/ExpensesManager.tsx:23-27`).
On mount, if `autoOpenAdd` is true, call the existing `openAddDialog()`
(`ExpensesManager.tsx:53-57`) once and then strip the query param from the
URL via `window.history.replaceState(null, "", "/expenses")` so the dialog
doesn't reopen on refresh. Guard with a ref (or an effect with an empty
dependency array) so it only fires once per mount, not on every re-render.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Build succeeds: `npm run build`

#### Manual Verification:

- Clicking "Add Expense" in nav from any page lands on `/expenses` with the add-expense dialog already open
- Refreshing the page while the dialog is open (or after closing it) does not reopen the dialog and the URL no longer shows `?action=add`
- Navigating directly to `/expenses` (no query param, e.g. via browser history or a bookmark) behaves exactly as it does today — list view, dialog closed

---

## Phase 3: E2E coverage for nav reachability

### Overview

Add automated coverage for the guardrail this slice must not break: the nav
must work at both mobile and desktop widths, from every protected page.

### Changes Required:

#### 1. New nav reachability spec

**File**: `tests/e2e/nav-reachability.spec.ts` (new)

**Intent**: Prove, at both a desktop and a mobile viewport, that an
authenticated user can reach Dashboard, Add Expense (with the dialog open),
Categories, and Settings via nav from any protected page, and can sign out
from a non-Dashboard page.

**Contract**: Two independent `test()` blocks (one default/desktop viewport,
one with `await page.setViewportSize({ width: 375, height: 667 })` set first
thing in the test) each following the existing self-contained-test
convention: `signUpAndSignIn` with a unique timestamp-suffixed email
(`tests/e2e/helpers.ts:64`), then from `/categories` click each nav link in
turn asserting `toHaveURL` and a visible role-based heading for
Dashboard/Categories/Settings, and for Add Expense asserting the
`getByRole("dialog", { name: "Add expense" })` (matching the existing
`expenseDialog` helper convention, `tests/e2e/helpers.ts:105-107`) becomes
visible. Finish each test by clicking "Sign out" from `/categories` (a
non-Dashboard page) and asserting the user lands on a signed-out route (e.g.
`/`, matching a Sign in link becoming visible). No cleanup step, matching
this suite's existing accumulate-test-users convention.

### Success Criteria:

#### Automated Verification:

- New spec passes: `npm run test:e2e -- nav-reachability`
- Full e2e suite still passes: `npm run test:e2e`

#### Manual Verification:

- Skim the new spec once locally to confirm it fails if a nav link is removed (temporarily comment one out and re-run, then restore) — a non-vacuity check consistent with this project's integration-test convention (`context/foundation/test-plan.md` §6.2)

---

## Testing Strategy

### Unit Tests:

- None new — this slice has no pure-logic addition (no new schema, no new
  service-layer function); the existing unit suite (`src/lib/services/*.test.ts`)
  is unaffected and should stay green.

### Integration Tests:

- None new — no new database-backed behavior; `/settings` reads nothing,
  and the query-param deep link is pure client/server wiring, not a
  service-layer or RLS concern.

### E2E Tests:

- `tests/e2e/nav-reachability.spec.ts` (Phase 3, above) is the primary new
  coverage for this slice.

### Manual Testing Steps:

1. Sign in, confirm nav appears identically on Dashboard, Expenses,
   Categories, Settings.
2. Click through Dashboard → Add Expense → Categories → Settings → Dashboard,
   confirming the active link updates each time.
3. Resize the browser to a mobile width and repeat step 2.
4. From Categories, click Sign out and confirm you land signed out.
5. Visit `/` signed out and confirm the Sign in/Sign up header still renders
   exactly as before this change.

## Performance Considerations

None beyond the existing guardrail (perceived acknowledgment within 1 second)
— the nav is static, server-rendered markup with no client JS, so link
navigation and sign-out are as fast as the existing page loads/redirects
already are.

## Migration Notes

No schema or data changes.

## References

- Roadmap slice: `context/foundation/roadmap.md` (S-04)
- PRD: `context/foundation/prd-v2.md` (FR-001, FR-005, US-01)
- Existing nav-adjacent component: `src/components/Topbar.astro`
- E2E conventions: `context/foundation/test-plan.md` §6.3, `tests/e2e/helpers.ts`, `tests/e2e/seed.spec.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Wire the nav into every page

#### Automated

- [x] 1.1 Type checking passes: `npx astro check` — c8916a1
- [x] 1.2 Linting passes: `npm run lint` — c8916a1
- [x] 1.3 Build succeeds: `npm run build` — c8916a1
- [x] 1.4 Full existing e2e suite still passes: `npm run test:e2e` (10/11 specs fail locally on unmodified develop HEAD too — pre-existing auth-form hydration flake in this environment, confirmed via git stash, not a regression from this phase; user accepted) — c8916a1. Follow-up: the flake was caused by Playwright reusing a stray manually-started dev server instead of its own `dev:e2e` one; once that was cleared (Phase 3), the suite surfaced two real regressions from this phase's Topbar changes (the "Expenses"→"Add Expense" rename, and a duplicate email match) — both fixed in Phase 3's commit.

#### Manual

- [x] 1.5 Nav visible with all 5 items on Dashboard, Expenses, Categories, Settings — c8916a1
- [x] 1.6 Active link visually reflects current page on each of those 4 pages — c8916a1
- [x] 1.7 Visiting /settings while signed out redirects to sign-in — c8916a1
- [x] 1.8 At a mobile viewport, all 5 nav items remain reachable (wrap, no clipping/overlap) — c8916a1
- [x] 1.9 Signing out from a non-Dashboard page works — c8916a1
- [x] 1.10 Signed-out landing page (/) still shows exactly one Sign in/Sign up header — c8916a1
- [x] 1.11 Existing bookmarked direct links to /dashboard, /expenses, /categories still load normally — c8916a1

### Phase 2: Add Expense deep link from nav

#### Automated

- [x] 2.1 Type checking passes: `npx astro check` — 1e59980
- [x] 2.2 Linting passes: `npm run lint` — 1e59980
- [x] 2.3 Build succeeds: `npm run build` — 1e59980

#### Manual

- [x] 2.4 Clicking Add Expense in nav lands on /expenses with dialog already open — 1e59980
- [x] 2.5 Refreshing does not reopen the dialog and URL no longer shows ?action=add — 1e59980
- [x] 2.6 Direct navigation to /expenses (no query param) behaves as before this change — 1e59980

### Phase 3: E2E coverage for nav reachability

#### Automated

- [x] 3.1 New spec passes: `npm run test:e2e -- nav-reachability`
- [x] 3.2 Full e2e suite still passes: `npm run test:e2e` (13/13 green — also fixed 5 pre-existing specs broken by Phase 1's Topbar changes, see commit body)

#### Manual

- [x] 3.3 Non-vacuity check: temporarily break a nav link, confirm the new spec fails, then restore
