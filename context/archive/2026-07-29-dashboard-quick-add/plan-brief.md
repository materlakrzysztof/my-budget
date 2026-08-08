# Dashboard Quick-Add Expense — Plan Brief

> Full plan: `context/changes/dashboard-quick-add/plan.md`

## What & Why

Let the user start adding an expense in one click from the dashboard — the primary
landing view — via an in-place dialog with no navigation. On save, the dashboard
summary refreshes so the new expense shows immediately. Roadmap S-10 / PRD FR-019.

## Starting Point

The add-expense dialog exists only on the Expenses page: `ExpenseFormDialog` is a
standalone component, but its submit logic is embedded in `ExpensesManager`. The
dashboard (`DashboardView`) is a pure prop-driven island with no add affordance
once the month has expenses; its empty-state CTA merely links to
`/expenses?action=add`. `GET /api/expenses/summary` already returns the exact
payload a refresh needs.

## Desired End State

The dashboard card header has an always-visible "Add expense" button that opens the
dialog in place; saving closes it and updates the total/donut/breakdown with no page
reload. The empty-state CTA opens the same dialog. With no categories, the button is
disabled with a hint to create one first. The Expenses page is unchanged, now
routed through a shared create-expense hook that S-16 will build on.

## Key Decisions Made

| Decision            | Choice                                                    | Why (1 sentence)                                                        | Source |
| ------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- | ------ |
| Depth               | In-place dialog (not navigate-to-existing-flow)          | Delivers the fuller FR-019 value; a navigate-only button duplicates the Topbar link. | Plan   |
| Refresh after add   | Re-fetch `GET /api/expenses/summary`, update in place    | Smooth, stays on the dashboard, reuses an existing endpoint; server stays source of truth. | Plan   |
| No-categories case  | Disable the button with a hint to category management    | The form can't be submitted without a category; prevents a dead-end dialog. | Plan   |
| Code reuse          | Extract a shared `useCreateExpense` hook now             | One create path for dashboard + Expenses page; sets up S-16 cleanly.   | Plan   |
| Placement           | Button in the dashboard card header (+ empty-state CTA)  | Always visible whether or not there's spend; mirrors ExpensesManager's pattern. | Plan   |
| Feedback            | Close dialog; refreshed numbers are the confirmation     | Matches the app's understated style; no new toast system needed.       | Plan   |
| Testing             | Extend a dashboard e2e; unit-test the extracted hook     | Covers the visible in-place refresh and the reused logic's error paths. | Plan   |

## Scope

**In scope:** extract `useCreateExpense` and repoint `ExpensesManager`; load
categories on the dashboard; make `DashboardView` stateful with a header "Add
expense" button (disabled-with-hint when no categories); in-place `ExpenseFormDialog`
via the hook; unify the empty-state CTA; post-save summary re-fetch; unit tests +
dashboard e2e.

**Out of scope:** full S-16 unification; optimistic updates; page reload; a new
toast/status system; multi-add dialog; new API/schema/migration; i18n (S-11).

## Architecture / Approach

Refactor-then-build. Phase 1 lifts the create-expense POST + error mapping out of
`ExpensesManager` into `src/components/hooks/useCreateExpense.ts` (behavior
unchanged). Phase 2 loads categories in `dashboard.astro`, makes `DashboardView`
hold `entries` in state, adds the header button + in-place dialog wired through the
hook, and re-fetches `GET /api/expenses/summary` on success to replace `entries` —
the documented refresh seam future dashboard data (e.g. month-comparison) can reuse.

## Phases at a Glance

| Phase                          | What it delivers                                          | Key risk                                                     |
| ------------------------------ | -------------------------------------------------------- | ----------------------------------------------------------- |
| 1. Extract create-expense hook | Shared `useCreateExpense`; ExpensesManager repointed     | Behavior-preserving refactor of a working, tested component. |
| 2. Dashboard in-place quick-add | Header button + in-place dialog + summary refresh + e2e  | `DashboardView` becomes stateful (was pure props); refresh consistency. |

**Prerequisites:** S-08 monthly-dashboard (shipped). **Estimated effort:** ~1–2
sessions across 2 phases.

## Open Risks & Assumptions

- `DashboardView` shifts from pure props to stateful — keep the refresh sourced from
  the summary endpoint so numbers can't drift from a server render.
- Phase 1 touches a working, tested component (`ExpensesManager`); the refactor must
  be strictly behavior-preserving (its existing add/edit/delete flows stay green).
- Extracting only the create path (not edit/delete) is deliberate — full unification
  is S-16's job.

## Success Criteria (Summary)

- From the dashboard, one click opens an in-place add dialog; saving updates the
  total/donut/breakdown with no navigation or reload.
- With no categories, the button is disabled with a path forward; the Expenses page
  is unchanged.
- Lint, build, unit tests, and the dashboard e2e all pass.
