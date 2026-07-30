# Add-Expense Dialog (Global Entry Point) — Plan Brief

> Full plan: `context/changes/add-expense-dialog/plan.md`

## What & Why

Unify expense entry behind a single, app-wide **in-place dialog** (PRD FR-025).
Today "Add Expense" navigates to `/expenses` and auto-opens a dialog there; this
slice makes the Topbar "Add Expense" open the same dialog on any page without
leaving it, and lays the shared hook + refresh event that S-10 and S-17 build on.

## Starting Point

The add-expense dialog (`ExpenseFormDialog`) already exists but is scoped to
`/expenses`, and its create logic is inline in `ExpensesManager`. The Topbar "Add
Expense" is a plain link to `/expenses?action=add` — and the *only* nav route to the
expenses list. `GET /api/categories` and `GET /api/expenses/summary` already return
what a global dialog and dashboard refresh need. S-10 (`dashboard-quick-add`) is
planned but unimplemented, so `useCreateExpense` and `src/components/hooks/` don't
exist yet.

## Desired End State

From any protected page, one click on the Topbar "Add Expense" opens the structured
dialog in place (no navigation); saving closes it and any expense-data page
(dashboard summary, expenses list) refreshes in place while other pages stay put. A
new "Expenses" nav link reaches the list. Zero-category accounts get a hint to
Settings with submit disabled. `/expenses` add/edit/delete is unchanged, its create
path now routed through a shared `useCreateExpense` hook. No AI code — just a clean
seam for S-17's future free-text toggle.

## Key Decisions Made

| Decision          | Choice                                                        | Why (1 sentence)                                                                 | Source |
| ----------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------- | ------ |
| Shared create path | Build `useCreateExpense` now                                 | S-16 is "ready" with no prereqs; one create path S-10 later reuses.              | Plan   |
| Global trigger     | Single React island in Topbar + typed `window` events        | True app-wide entry point; decoupled so any page CTA can open it.                | Plan   |
| Scope              | Topbar global dialog; Expenses page keeps its manager         | Delivers FR-025 without absorbing S-10 or destabilizing ExpensesManager.         | Plan   |
| Post-save refresh  | Dispatch `expense-created`; pages self-refresh, else nothing | In-place, reuses existing GET endpoints, no reload.                              | Plan   |
| S-17 prep          | Clean seam, no AI code                                        | S-17 adds a toggle above the existing `<form>` without reworking the shell.      | Plan   |
| Deep-link          | Retire the nav link; keep `?action=add` working              | No navigation from nav; existing deep-links and migrated e2e specs stay green.   | Plan   |
| Nav reachability   | Add a distinct "Expenses" nav link                           | "Add Expense" was the only route to the list; a dialog trigger would strand it.  | Plan   |
| Testing            | Unit-test the hook; new global-flow e2e; migrate 6 specs      | Locks shared logic, proves the app-wide flow, keeps existing coverage green.     | Plan   |

## Scope

**In scope:** extract `useCreateExpense` + repoint ExpensesManager's create path; a
global `client:load` island (trigger + dialog, lazy category load, no-category hint,
success event); Topbar "Expenses" link + "Add Expense" trigger; typed event module;
`ExpensesManager` + `DashboardView` refresh listeners; unit test; new e2e; migrate 6
e2e specs.

**Out of scope:** the AI/free-text mode (S-17); the dashboard header add-button and
empty-state CTA unification (S-10); removing `?action=add`; optimistic updates;
toast system; new API/schema/migration; i18n (S-11).

## Architecture / Approach

Refactor → build → wire. Phase 1 lifts create-POST + error mapping into
`src/components/hooks/useCreateExpense.ts` (behavior unchanged). Phase 2 mounts a
single island in the Astro Topbar that owns the trigger and `ExpenseFormDialog`
(reused verbatim), lazy-loads categories, submits via the hook, and communicates via
two typed `window` CustomEvents (`expense-created`, `open-add-expense`) defined in
`src/lib/expense-events.ts`; the Topbar also gains an "Expenses" link. Phase 3 has
`ExpensesManager` and a minimally-stateful `DashboardView` subscribe to
`expense-created` and re-fetch their own data, migrates the 6 specs off the
navigating link, and adds the global-flow e2e.

## Phases at a Glance

| Phase                              | What it delivers                                              | Key risk                                                          |
| ---------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------- |
| 1. Extract `useCreateExpense`      | Shared create hook; ExpensesManager repointed                | Behavior-preserving refactor of a working, tested component.     |
| 2. Global island + Topbar unify    | App-wide in-place dialog; "Expenses" + "Add Expense" nav     | Cross-framework Astro→React global trigger; category-load timing. |
| 3. Refresh wiring + tests          | Page self-refresh; 6 specs migrated; new global-flow e2e     | Test migration surface; DashboardView statefulness overlaps S-10. |

**Prerequisites:** none (roadmap S-16 prereqs "—"; builds its own hook).
**Estimated effort:** ~2 sessions across 3 phases.

## Open Risks & Assumptions

- `DashboardView` becomes minimally stateful here — overlaps S-10 Phase 2; whichever
  slice lands first does the conversion, the other adapts. Refresh stays sourced from
  the summary endpoint so numbers can't drift from server render.
- Phase 1 touches a working, tested component (`ExpensesManager`); the create-path
  refactor must keep its add/edit/delete flows green.
- Six e2e specs depend on the navigating "Add Expense" link; migration is mechanical
  (deep-link `goto`) but must be complete or the suite breaks.
- Assumes seeded default categories exist for the new e2e (as other expense specs do).

## Success Criteria (Summary)

- From any page, one Topbar click opens the add dialog in place; saving updates the
  dashboard/expenses view with no navigation or reload.
- The expenses list stays reachable via a distinct "Expenses" nav link; zero-category
  accounts get a path forward.
- Lint, build, unit tests (incl. the hook), and the full e2e suite pass.
