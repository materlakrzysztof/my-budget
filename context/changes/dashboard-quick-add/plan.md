# Dashboard Quick-Add Expense Implementation Plan

## Overview

Let the user start adding an expense in one click **from the dashboard**, in an
in-place dialog with no navigation. A prominent "Add expense" button in the
dashboard card header (and the existing empty-state CTA) opens the existing
`ExpenseFormDialog`; on a successful save the dialog closes and the dashboard
re-fetches its monthly summary so the total, donut, and per-category breakdown
update in place. The create-expense POST + error handling is first extracted from
`ExpensesManager` into a shared hook so the dashboard and the Expenses page share
one code path — the groundwork S-16 (`add-expense-dialog`) will build on. This is
roadmap S-10 / PRD FR-019. No schema, migration, or new dependency.

## Current State Analysis

- **The add flow exists but only on the Expenses page.** `ExpenseFormDialog`
  (`src/components/expenses/ExpenseFormDialog.tsx`) is a standalone controlled
  dialog. Its submit logic lives inside `ExpensesManager`
  (`src/components/expenses/ExpensesManager.tsx:89-115`): POST `/api/expenses`,
  handle `422/409/404` → `body.error`, other non-ok → generic message, then close
  + `refresh()`.
- **The dashboard is presentational.** `DashboardView`
  (`src/components/dashboard/DashboardView.tsx`) is a pure prop-driven island
  taking `{ entries: MonthlySummaryEntry[]; currency }`. It renders the headline
  total, `SpendingDonut`, and `MonthlySummary`, or an empty state whose CTA is a
  plain link to `/expenses?action=add` (`DashboardView.tsx:19`).
- **The dashboard page loads no categories.** `src/pages/dashboard.astro` loads
  the summary + currency only. The add dialog needs `categories`
  (`ExpenseFormDialog` requires a category; it defaults to `categories[0]`).
- **A summary endpoint already exists.** `GET /api/expenses/summary`
  (`src/pages/api/expenses/summary.ts`) returns `{ summary: MonthlySummaryEntry[] }`
  for the current month — exactly what a post-add refresh needs.
- **The gap FR-019 fills:** when the month already has expenses, the dashboard has
  **no add affordance** — the "Add an expense" link only shows in the empty state.
- **Hook convention exists.** CLAUDE.md: extract React hooks to
  `src/components/hooks/`. There is currently no shared create-expense hook.
- **Existing e2e to extend.** `tests/e2e/expenses-add-and-summary.spec.ts` already
  exercises add → summary update on the Expenses page; the dashboard flow mirrors
  it.

## Desired End State

On `/dashboard`:

- An "Add expense" button sits in the card header, always visible. Clicking it
  opens the `ExpenseFormDialog` in place. On save, the dialog closes and the
  dashboard's total/donut/breakdown update to include the new expense **without a
  page reload**.
- The empty-state CTA opens the **same** in-place dialog (no longer a navigate
  link).
- When the user has **no categories**, the "Add expense" button is disabled with a
  hint pointing to category management (so the form is never shown in an
  unsubmittable state).
- The Expenses page behaves exactly as before, now routed through a shared
  create-expense hook.

Verify via `npm run lint`, `npm run build`, `npm run test:unit`, an extended
dashboard e2e, and the manual steps below.

### Key Discoveries:

- Reuse `ExpenseFormDialog` as-is; only the submit wiring + a stateful host are new
  (`src/components/expenses/ExpenseFormDialog.tsx`).
- `GET /api/expenses/summary` already returns the exact refresh payload
  (`src/pages/api/expenses/summary.ts`).
- Submit logic to extract lives at `ExpensesManager.tsx:89-115`.
- `DashboardView` must become stateful (hold `entries` in state) to refresh in
  place — today it is pure props.
- `dashboard.astro` must additionally load categories (mirror `expenses.astro:11`
  `listCategories`).

## What We're NOT Doing

- **No full S-16 unification** — we extract a shared submit hook, not the complete
  unified add-expense entry component S-16 will build. Edit/delete flows stay in
  `ExpensesManager`.
- **No optimistic updates** — the dashboard re-fetches the authoritative summary
  after save rather than reproducing server aggregation client-side.
- **No page reload** — refresh is an in-place re-fetch.
- **No new success toast/notification system** — the refreshed numbers are the
  confirmation; no inline status line is added.
- **No multi-add / keep-open dialog** — the dialog closes on save, matching
  `ExpensesManager`.
- **No new API endpoint, schema, or migration** — reuses `POST /api/expenses` and
  `GET /api/expenses/summary`.
- **No Polish translation beyond current app copy** — i18n is roadmap S-11.

## Implementation Approach

Refactor first, then build. Phase 1 extracts the create-expense POST + error
handling from `ExpensesManager` into a reusable hook and repoints `ExpensesManager`
at it — a behavior-preserving refactor that keeps the Expenses page green and gives
Phase 2 (and later S-16) a single code path. Phase 2 loads categories on the
dashboard, makes `DashboardView` stateful, adds the header button (disabled-with-
hint when no categories), opens `ExpenseFormDialog` via the shared hook, unifies the
empty-state CTA, and re-fetches the summary on success.

## Critical Implementation Details

- **Post-add refresh source of truth.** After a successful POST, re-fetch `GET
  /api/expenses/summary` and replace the `entries` state — do not mutate a local
  copy — so the dashboard's total/donut/breakdown stay identical to a server render
  and cannot drift. This also means any future dashboard data (e.g. month-
  comparison) has a single documented refresh seam to extend.
- **No-categories guard.** The dashboard button is disabled when `categories.length
  === 0`, with a hint linking to category management, because `ExpenseFormDialog`
  cannot produce a submittable form without at least one category.

## Phase 1: Extract shared create-expense hook

### Overview

Move the create-expense POST + error handling out of `ExpensesManager` into a
reusable hook under `src/components/hooks/`, and repoint `ExpensesManager` at it
with no behavior change. This is the shared code path the dashboard (and later
S-16) will use.

### Changes Required:

#### 1. Create-expense hook

**File**: `src/components/hooks/useCreateExpense.ts` (new)

**Intent**: Encapsulate the "POST a new expense, translate the response into either
success or a user-facing error string" logic so multiple callers share it.

**Contract**: Exposes a `createExpense(input: CreateExpenseRequest)` that POSTs to
`/api/expenses`, and surfaces the same outcomes `ExpensesManager` produces today:
on `422/409/404` return the server `body.error`; on other non-ok return a generic
"Failed to create expense…" message; on ok signal success. The exact shape
(returned result object vs. callback params) is the implementer's call, but it must
carry enough for a caller to (a) show the error string and (b) know success to
close + refresh. No edit/delete logic moves — create only.

#### 2. Repoint ExpensesManager at the hook

**File**: `src/components/expenses/ExpensesManager.tsx`

**Intent**: Use the shared hook for the add path; leave edit, delete, and refresh
behavior exactly as-is.

**Contract**: Replace the create branch of `handleFormSubmit`
(`ExpensesManager.tsx:89-115`, the `method === "POST"` path) with the hook, keeping
the existing edit branch, `setServerError`, `closeFormDialog`, and `refresh()`
behavior identical. No user-visible change on the Expenses page.

#### 3. Hook unit tests

**File**: `src/components/hooks/useCreateExpense.test.ts` (new)

**Intent**: Lock the success and error-mapping behavior of the shared hook.

**Contract**: With `fetch` mocked, cover: success (ok) path; `422`/`409`/`404`
returning the server `error`; a generic non-ok (e.g. `500`) returning the fallback
message. Follow the existing service-test style under `src/lib/services/*.test.ts`.

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Type check + production build succeeds: `npm run build`
- Unit tests pass: `npm run test:unit`

#### Manual Verification:

- On the Expenses page, adding an expense (valid, and a validation-failing case)
  behaves exactly as before — dialog closes on success, error shows on failure.

**Implementation Note**: After completing this phase and all automated
verification passes, pause here for manual confirmation before proceeding to
Phase 2.

---

## Phase 2: Dashboard in-place quick-add

### Overview

Add the in-place quick-add to the dashboard: header button (disabled-with-hint when
no categories), in-place `ExpenseFormDialog` via the shared hook, empty-state CTA
unified to the same dialog, and a post-save summary re-fetch that updates the view.

### Changes Required:

#### 1. Load categories on the dashboard page

**File**: `src/pages/dashboard.astro`

**Intent**: Provide the categories the add dialog needs, mirroring the Expenses
page.

**Contract**: Add `listCategories(supabase, user.id)` (guarded like the existing
calls) and pass `categories` into `<DashboardView … />` alongside `entries` and
`currency`. No middleware/route change.

#### 2. Make DashboardView stateful with quick-add

**File**: `src/components/dashboard/DashboardView.tsx`

**Intent**: Hold the summary in state, render the header "Add expense" button, host
the in-place dialog, and refresh on success.

**Contract**: Props gain `categories: Category[]`. `entries` moves into local state
seeded from the prop. Render an "Add expense" button in the card header
(mirroring `ExpensesManager`'s header-button styling); disable it with a hint
linking to category management when `categories.length === 0`. Clicking opens
`ExpenseFormDialog` (add mode) using `useCreateExpense` for submit; on success,
close the dialog and re-fetch `GET /api/expenses/summary`, replacing the `entries`
state (recomputing total/donut/breakdown). Keep the donut fed by `total > 0` as
today. Reuse the same `serverError` display contract the dialog already expects.

#### 3. Unify the empty-state CTA

**File**: `src/components/dashboard/DashboardView.tsx` (same file)

**Intent**: The empty-state "Add an expense" action opens the in-place dialog
instead of navigating.

**Contract**: Replace the `/expenses?action=add` link (`DashboardView.tsx:19`) with
the same open-dialog handler used by the header button (subject to the same
no-categories guard). Behavior when categories exist: opens the in-place add dialog.

#### 4. Extend dashboard e2e

**File**: `tests/e2e/` (extend `expenses-add-and-summary.spec.ts` or add a focused
`dashboard-quick-add.spec.ts`)

**Intent**: Verify the in-place add updates the dashboard, and the no-categories
guard.

**Contract**: Using unique per-run identifiers and role/text locators (project E2E
rules — no `waitForTimeout`; wait on visible state / `waitForResponse`): from
`/dashboard`, open quick-add, submit a valid expense, and assert the dashboard total
/breakdown reflects it without navigation. Cover the disabled/hinted button when the
account has no categories. Follow `/10x-e2e` conventions and `tests/e2e/helpers.ts`.

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Type check + production build succeeds: `npm run build`
- Unit tests pass: `npm run test:unit`
- E2E passes: `npm run test:e2e` (dashboard quick-add spec)

#### Manual Verification:

- On `/dashboard` with categories, the header "Add expense" button opens the dialog
  in place; saving closes it and the total/donut/breakdown update without a reload.
- The empty-state CTA opens the same in-place dialog.
- With no categories, the button is disabled and its hint links to category
  management; the unsubmittable form is never shown.
- A validation failure in the dialog shows the error inline (dialog stays open).
- The Expenses page add flow is unchanged.

**Implementation Note**: Final phase — after automated + manual verification, the
change is ready for `/10x-impl-review`.

---

## Testing Strategy

### Unit Tests:

- `useCreateExpense`: success; `422/409/404` → server error; generic non-ok →
  fallback message.

### Integration Tests:

- None required — reuses existing `POST /api/expenses` and `GET
  /api/expenses/summary`; their behavior is unchanged and already covered.

### Manual Testing Steps:

1. Sign in with at least one category and some expenses this month.
2. On `/dashboard`, click the header "Add expense" → dialog opens in place.
3. Submit a valid expense → dialog closes, dashboard total/donut/breakdown update
   without a page reload.
4. Trigger a validation error in the dialog → error shows inline, dialog stays open.
5. From the empty state (no expenses this month) → CTA opens the same dialog.
6. With a fresh account that has no categories → button is disabled with a hint
   linking to category management.
7. Confirm the Expenses page add/edit/delete still work unchanged.

## Performance Considerations

Negligible — one extra `listCategories` read on the dashboard load and one
`GET /api/expenses/summary` re-fetch per successful add (both already-indexed
queries). No new client round-trips otherwise.

## Migration Notes

None — no schema or data changes.

## References

- Roadmap slice: `context/foundation/roadmap.md` → S-10 `dashboard-quick-add`
- PRD: `context/foundation/prd.md` → FR-019
- Submit logic to extract: `src/components/expenses/ExpensesManager.tsx:89-115`
- Reused dialog: `src/components/expenses/ExpenseFormDialog.tsx`
- Refresh endpoint: `src/pages/api/expenses/summary.ts`
- Dashboard host: `src/components/dashboard/DashboardView.tsx`, `src/pages/dashboard.astro`
- Hook convention: CLAUDE.md (`src/components/hooks/`)
- Similar e2e: `tests/e2e/expenses-add-and-summary.spec.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Extract shared create-expense hook

#### Automated

- [x] 1.1 Linting passes: `npm run lint` — 9d58554
- [x] 1.2 Type check + production build succeeds: `npm run build` — 9d58554
- [x] 1.3 Unit tests pass: `npm run test:unit` — 9d58554

#### Manual

- [x] 1.4 Expenses page add flow (success + validation failure) behaves exactly as before — 9d58554

### Phase 2: Dashboard in-place quick-add

#### Automated

- [x] 2.1 Linting passes: `npm run lint` — a2293ff
- [x] 2.2 Type check + production build succeeds: `npm run build` — a2293ff
- [x] 2.3 Unit tests pass: `npm run test:unit` — a2293ff
- [x] 2.4 E2E passes: `npm run test:e2e` (dashboard quick-add spec) — a2293ff

#### Manual

- [x] 2.5 Header "Add expense" opens the dialog in place; save updates dashboard without reload — a2293ff
- [x] 2.6 Empty-state CTA opens the same in-place dialog — a2293ff
- [x] 2.7 No categories → button disabled with a hint linking to category management — N/A: unreachable in current product (listCategories re-seeds the 8 defaults whenever a user has none); guard removed as dead code, not implemented — a2293ff
- [x] 2.8 Validation failure shows inline; dialog stays open — a2293ff
- [x] 2.9 Expenses page add/edit/delete unchanged — a2293ff
