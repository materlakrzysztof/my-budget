# Persistent Nav Menu — Plan Brief

> Full plan: `context/changes/persistent-nav-menu/plan.md`

## What & Why

Add a persistent nav menu reachable from every authenticated page
(Dashboard, Add Expense, Categories, Settings), so users can move between
the app's core areas without knowing/guessing URLs. This is roadmap slice
S-04, the north star of the v2 iteration (`prd-v2.md` FR-001, FR-005, US-01)
— it closes the #1 gap in that PRD's Problem Statement.

## Starting Point

`src/components/Topbar.astro` already exists and is already user-aware
(shows Dashboard/Categories/Expenses + sign-out when authenticated,
Sign in/Sign up otherwise) — but it's only ever rendered on the public
landing page (`Welcome.astro`), never on the protected pages. That mismatch
is the actual cause of "no nav" today.

## Desired End State

Every authenticated page shows the same nav bar, with the current page
visually indicated, working sign-out from anywhere, and an "Add Expense"
link that lands directly on the add-expense dialog already open. The public
landing page's existing sign-in/sign-up header is unchanged. Works at both
mobile and desktop widths.

## Key Decisions Made

| Decision                          | Choice                                                        | Why (1 sentence)                                                                        |
| ---------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Nav component                      | Extend existing `Topbar.astro`, don't build new                | It already implements 90% of what's needed; discovered mid-planning.                    |
| Where it renders                   | `Layout.astro`, globally                                        | One change applies to every current and future page automatically.                       |
| Mobile pattern                     | Responsive text-link bar (wrap + hide email), no new dependency | Only 5 items; adding a Sheet/drawer primitive would be disproportionate.                  |
| "Add Expense" target               | `/expenses?action=add`, auto-opens the dialog                   | US-01's acceptance criteria requires reaching the form "directly," not via an extra click. |
| Settings placeholder                | Minimal real page, not a redirect or disabled link              | FR-001 (must-have, this slice) wants all four destinations linked now.                    |
| Sign-out                           | Move into nav (available on every page)                        | Once nav is everywhere, Dashboard-only sign-out becomes an odd asymmetry.                |
| Active-link highlight              | Yes                                                              | Cheap (server-side pathname compare), standard nav UX expectation.                        |
| Public landing page (`/`)          | No new work — its existing Topbar-based header already qualifies | User asked for a "lightweight header" there; it already exists via `Topbar`.              |

## Scope

**In scope:**
- Extending `Topbar.astro` (Settings link, Add Expense relabel/retarget, active state, responsive classes)
- Rendering it from `Layout.astro` instead of only `Welcome.astro`
- New `/settings` placeholder route + middleware protection
- Removing the now-duplicate Topbar call on `/` and the duplicate sign-out button on Dashboard
- `?action=add` deep link auto-opening the expense dialog
- New e2e spec covering nav reachability at mobile + desktop viewports

**Out of scope:**
- S-05 (expense name/description), S-06 (category drill-down), S-07 (currency) — Settings is a placeholder only
- Any new shadcn primitive (Sheet/drawer/navigation-menu)
- Auth flow / session handling changes

## Architecture / Approach

`Topbar.astro` is a plain server-rendered Astro component (no client JS) —
extending it in place and rendering it once from `Layout.astro` gets every
page the nav "for free." The one wrinkle: each page today supplies its own
`bg-cosmic` background independently of `Layout.astro`, so `Layout.astro`'s
`<body>` also gets `bg-cosmic` to avoid a visual seam above each page's own
cosmic div. The "Add Expense" deep link is a query param read server-side by
`expenses.astro` and passed as a prop to the existing `ExpensesManager`
React island, which opens its already-existing dialog state on mount.

## Phases at a Glance

| Phase                             | What it delivers                                                          | Key risk                                                                 |
| ---------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 1. Wire the nav into every page    | Extended Topbar rendered globally, `/settings` placeholder, cleanup of duplicates | Layout.astro is shared by every page — regressions here are wide, not deep |
| 2. Add Expense deep link           | `?action=add` auto-opens the dialog, cleans up the URL after                | Reopening the dialog on refresh if the URL isn't cleared                  |
| 3. E2E coverage for nav             | New spec at desktop + mobile viewports                                       | First test in this suite to override viewport — verify the pattern reads cleanly |

**Prerequisites:** none — no other roadmap slice blocks this.
**Estimated effort:** small; no schema or backend changes, one shared-component extension plus a small React prop addition and one new test file.

## Open Risks & Assumptions

- Assumes `Layout.astro`'s `bg-cosmic` addition doesn't visually clash with
  any page that doesn't already use the cosmic background — confirmed all
  four protected pages plus the landing page already use it.
- Assumes hiding the user's email on narrow viewports is an acceptable
  tradeoff for fitting five nav items — flagged in manual verification.

## Success Criteria (Summary)

- From Dashboard, Expenses, Categories, or Settings, a user can reach any of
  the other three plus sign out, at both mobile and desktop widths.
- "Add Expense" from nav opens the add-expense form directly, no extra click.
- No existing bookmarked route or e2e test regresses.
