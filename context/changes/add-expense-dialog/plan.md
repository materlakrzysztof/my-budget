# Add-Expense Dialog (Global Entry Point) Implementation Plan

## Overview

Turn "Add Expense" from a page navigation into a **global, in-place dialog**
available from the Topbar on any authenticated page. Today the only way to add an
expense is to click the Topbar "Add Expense" link, navigate to `/expenses`, and
let the page auto-open a dialog. This slice unifies the entry point (PRD FR-025):
one always-available dialog, opened without leaving the current page, backed by a
shared create-expense hook and a lightweight refresh event so open pages reflect
the new expense in place.

## Current State Analysis

- **The dialog already exists, but only on `/expenses`.** `ExpenseFormDialog`
  (`src/components/expenses/ExpenseFormDialog.tsx`) is a self-contained structured
  form (add/edit modes) with client-side validation. Its submit logic — POST
  `/api/expenses`, status-based error mapping (422/409/404 → server message; other
  → generic failure) — lives inline in `ExpensesManager.handleFormSubmit`
  (`src/components/expenses/ExpensesManager.tsx:89`).
- **The Topbar "Add Expense" is a navigation link**, not a dialog trigger:
  `Topbar.astro:24` renders `<a href="/expenses?action=add">`. `expenses.astro`
  reads `?action=add` and passes `autoOpenAdd` to `ExpensesManager`, which opens
  the dialog on mount (`ExpensesManager.tsx:39`).
- **"Add Expense" is currently the ONLY nav path to `/expenses`.** The Topbar has
  Dashboard, Add Expense, Settings — no standalone "Expenses" link. Converting
  "Add Expense" to a dialog trigger would strand the expenses list with no nav
  route, so this plan adds an "Expenses" nav link.
- **The Topbar is Astro; the dialog is React.** Topbar lives in the global
  `Layout.astro` (`src/layouts/Layout.astro:39`). A React dialog opened from a
  global Astro trigger needs a client island + a decoupled open mechanism.
- **`GET /api/categories` exists** (`src/pages/api/categories.ts:17`) and returns
  `{ categories }` (`ListCategoriesResponse`); 401 when unauthenticated. Categories
  are otherwise loaded server-side per page.
- **`GET /api/expenses/summary`** already returns the dashboard payload
  (`MonthlySummaryEntry[]`) a refresh needs.
- **`DashboardView`** (`src/components/dashboard/DashboardView.tsx`) is a pure
  prop-driven island; its empty-state CTA links to `/expenses?action=add`.
- **Sibling slice S-10 (`dashboard-quick-add`) is planned but not implemented** —
  `src/components/hooks/` does not yet exist. S-10's plan extracts `useCreateExpense`
  and makes `DashboardView` stateful. Roadmap lists S-16 prereqs as "—", so this
  slice builds the shared hook itself and S-10 later reuses it.
- **Six e2e specs depend on the Topbar "Add Expense" link navigating to
  `/expenses`**: `expenses-add-and-summary`, `expenses-backdated-attribution`,
  `expenses-delete-updates-summary`, `expenses-edit-updates-summary`,
  `category-expense-drilldown`, and `nav-reachability` (2 tests). They will be
  migrated.

## Desired End State

A signed-in user, on any protected page (dashboard, settings, expenses), clicks
"Add Expense" in the Topbar and a structured add-expense dialog opens **in place**
— no navigation. On save, the dialog closes and any page showing expense data
updates in place (dashboard summary re-fetches; expenses list re-fetches); other
pages simply stay put. The Topbar also has a distinct "Expenses" link to the list.
The `/expenses` page and its add/edit/delete flows are unchanged, with its create
path now routed through the shared `useCreateExpense` hook. No AI/free-text code is
added, but the dialog is structured so S-17 can slot in a mode toggle.

**Verification:** From the dashboard, one click opens the dialog with no URL change;
saving updates the monthly summary in place. `GET /api/categories` populates the
category select; with zero categories the dialog shows a hint linking to Settings
and disables submit. Lint, build, unit tests (including the new hook test), and the
full e2e suite pass.

### Key Discoveries:

- Create logic to extract lives at `ExpensesManager.tsx:89-115` (status mapping is
  the contract to preserve).
- Topbar dual-purposes "Add Expense" as the only route to `/expenses`
  (`Topbar.astro:24`) — a nav "Expenses" link must be added to avoid a reachability
  regression (`nav-reachability.spec.ts` proves reach to every core area).
- `ExpenseFormDialog` owns its own `Dialog`/`DialogContent` and takes
  `open/onSubmit/onClose/categories/serverError` — it can be reused verbatim by a
  global island; no structural refactor needed for the S-17 seam (the `<form>` is
  already a discrete block a toggle can sit above).
- `ExpensesManager` already has a `refresh()` method (`ExpensesManager.tsx:49`) —
  the `expense-created` listener reuses it.
- Retaining the `?action=add` deep-link (via `autoOpenAdd`) lets the 6 affected
  specs migrate to a simple `page.goto("/expenses?action=add")`.

## What We're NOT Doing

- **Not building the AI/free-text mode (S-17).** No toggle UI, no parsing, no new
  endpoint. Only a clean structural seam.
- **Not adding the dashboard header "Add expense" button** — that in-place trigger
  affordance is S-10's deliverable. This slice adds only the dashboard's
  `expense-created` refresh listener (the seam S-10 builds its button on).
- **Not unifying the dashboard empty-state CTA** — it keeps its existing
  `/expenses?action=add` link; S-10 unifies it.
- **Not removing the `/expenses?action=add` deep-link** — retained so direct URLs,
  bookmarks, and migrated e2e specs keep working.
- **Not changing the Expenses page's own add/edit/delete UI** — only its create
  path is rerouted through the shared hook.
- No new API endpoints, DB schema, migrations, optimistic updates, toast system, or
  i18n (S-11).

## Implementation Approach

Refactor-then-build-then-wire, in three phases:

1. **Extract `useCreateExpense`** so there is exactly one create path (POST + error
   mapping), reused by the Expenses page now and the global dialog next. Strictly
   behavior-preserving.
2. **Build the global island + Topbar unification.** A single `client:load` island
   mounted in the Topbar owns the trigger button and an `ExpenseFormDialog` (add
   mode). It lazy-loads categories on first open, submits via the hook, and
   communicates through two `window` CustomEvents defined in a small typed module:
   it **dispatches** `expense-created` on success and **listens** for
   `open-add-expense` so any page CTA can open it. The Topbar gains a separate
   "Expenses" nav link.
3. **Consume the refresh event + migrate tests.** `ExpensesManager` and
   `DashboardView` subscribe to `expense-created` and re-fetch their own data.
   Migrate the 6 e2e specs off the navigating "Add Expense" link, and add one new
   e2e proving the global in-place flow end-to-end.

## Critical Implementation Details

- **Event contract (load-bearing across phases).** `expense-created` is dispatched
  on `window` by the global dialog after a successful POST; `open-add-expense`
  requests the global dialog to open. Both are defined once in
  `src/lib/expense-events.ts` (names + typed dispatch/subscribe helpers) so no
  component uses raw event strings. Every listener must remove itself on unmount.
- **No-categories timing.** The global trigger button is always enabled (its enabled
  state can't depend on an async fetch that hasn't run). Categories are fetched on
  first open; if the response is empty, the dialog renders a hint linking to
  `/settings` and disables the submit — rather than disabling the always-present
  Topbar button.
- **DashboardView statefulness overlaps S-10.** This slice makes `DashboardView`
  minimally stateful (holds `entries`, re-fetches summary on `expense-created`). S-10
  builds its header add-button and empty-state unification on top of this seam;
  whichever lands first performs the stateful conversion and the other adapts.

## Phase 1: Extract shared `useCreateExpense` hook

### Overview

Lift the create-expense POST and error mapping out of `ExpensesManager` into a
reusable hook under `src/components/hooks/`, and repoint the Expenses page's create
path through it. No behavior change.

### Changes Required:

#### 1. New create-expense hook

**File**: `src/components/hooks/useCreateExpense.ts`

**Intent**: Own the single client-side create path so the Expenses page and the new
global dialog share identical POST + error-mapping behavior. Sets up S-10 reuse.

**Contract**: Exports `useCreateExpense()` returning `{ createExpense, serverError,
resetError }` where `createExpense(input: CreateExpenseRequest): Promise<boolean>`
POSTs to `/api/expenses`, returns `true` on success, and on failure sets
`serverError` and returns `false`. Error mapping preserved verbatim from
`ExpensesManager.tsx:100-111`: 422/409/404 → parsed `{ error }` body message; any
other non-ok → `"Failed to create expense. Please try again."`. `resetError()`
clears the message (used when opening the dialog).

#### 2. Repoint ExpensesManager's create path

**File**: `src/components/expenses/ExpensesManager.tsx`

**Intent**: Use the hook for the add case while leaving edit (PATCH) and delete
(DELETE) exactly as they are. Keep the visible add/edit/delete behavior identical.

**Contract**: `handleFormSubmit` delegates the create branch (`dialogMode !== "edit"`)
to `useCreateExpense.createExpense`; on `true` it calls `closeFormDialog()` +
`refresh()`, on `false` the hook's `serverError` drives the existing error banner.
The edit branch keeps its inline PATCH + current mapping. `serverError` shown in the
dialog now sources from the hook for the add case (unify state or bridge it — keep a
single error surface).

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run build` (astro check + build)
- Linting passes: `npm run lint`
- Unit tests pass, including the new hook test: `npm run test`

#### Manual Verification:

- On `/expenses`, adding an expense still works; a server-side duplicate/validation
  error still surfaces the server message in the dialog.
- Edit and delete on `/expenses` are unaffected.

**Implementation Note**: After this phase and all automated verification passes,
pause for manual confirmation before proceeding.

---

## Phase 2: Global add-expense island + Topbar unification

### Overview

Introduce a single app-wide island that renders the "Add Expense" trigger and the
add-expense dialog, opened in place from the Topbar. Add a distinct "Expenses" nav
link so the list stays reachable. Establish the typed event contract.

### Changes Required:

#### 1. Event-contract module

**File**: `src/lib/expense-events.ts`

**Intent**: Define the two window events once, typed, so no component hardcodes
event-name strings and listeners are symmetric.

**Contract**: Exports event-name constants `EXPENSE_CREATED` (`"expense-created"`)
and `OPEN_ADD_EXPENSE` (`"open-add-expense"`), plus helpers
`dispatchExpenseCreated(detail?)`, `onExpenseCreated(handler): () => void`,
`dispatchOpenAddExpense()`, and `onOpenAddExpense(handler): () => void`. The `on*`
helpers attach a `window` listener and return an unsubscribe function. `detail`
carries the created `Expense` (optional; listeners re-fetch rather than trust it).

#### 2. Global add-expense island

**File**: `src/components/expenses/GlobalAddExpense.tsx`

**Intent**: The app-wide trigger + dialog. Owns open state, lazy category loading,
no-category handling, submission via the shared hook, and the success event. Reuses
`ExpenseFormDialog` in add mode unchanged.

**Contract**: Default-exported React component (no props) intended for `client:load`.
Renders a trigger `<button>` labeled "Add Expense" (styled to match the Topbar nav
items). On first open, fetches `GET /api/categories`; caches the result for the
session. Renders `ExpenseFormDialog` with `mode="add"`, the fetched `categories`,
`onSubmit` wired to `useCreateExpense`, and `serverError` from the hook. On
successful create: close the dialog and call `dispatchExpenseCreated(expense)`. Also
subscribes via `onOpenAddExpense` so external CTAs can open it; unsubscribes on
unmount. When the fetched category list is empty, the dialog body shows a hint
("Create a category first") linking to `/settings` and disables submit; the trigger
button itself stays enabled.

**Note (S-17 seam)**: no mode toggle is added; `ExpenseFormDialog`'s `<form>` remains
a discrete block so S-17 can insert a Form/Free-text toggle above it and an alternate
body without reworking this island.

#### 3. Topbar: Expenses link + Add Expense trigger

**File**: `src/components/Topbar.astro`

**Intent**: Replace the navigating "Add Expense" `<a>` with the global island's
in-place trigger, and add a separate "Expenses" nav link so the list view stays
reachable from nav.

**Contract**: In the authenticated nav block, add `<a href="/expenses">Expenses</a>`
(active when `pathname === "/expenses"`, matching `linkClass`), and replace the
`<a href="/expenses?action=add">Add Expense</a>` with `<GlobalAddExpense
client:load />`. Keep Dashboard, Settings, and Sign out. The island's trigger keeps
the accessible name "Add Expense".

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run build`
- Linting passes: `npm run lint`
- Unit tests pass: `npm run test`

#### Manual Verification:

- From the dashboard, clicking Topbar "Add Expense" opens the dialog with no URL
  change; Escape/close dismisses it.
- The category select is populated from `GET /api/categories`.
- A brand-new account (zero categories) sees the "create a category first" hint
  linking to Settings, with submit disabled.
- The new "Expenses" nav link reaches `/expenses`; nav still reaches Dashboard,
  Settings, and Sign out from any page.

**Implementation Note**: After this phase and all automated verification passes,
pause for manual confirmation before proceeding.

---

## Phase 3: Reflect on current page + tests

### Overview

Wire pages that show expense data to refresh on `expense-created`, migrate the six
e2e specs off the navigating "Add Expense" link, and add one e2e proving the global
in-place flow.

### Changes Required:

#### 1. ExpensesManager refresh listener

**File**: `src/components/expenses/ExpensesManager.tsx`

**Intent**: When an expense is added via the global dialog while the user is on
`/expenses`, refresh the list.

**Contract**: On mount, subscribe with `onExpenseCreated(() => refresh())`;
unsubscribe on unmount. `refresh()` already re-fetches respecting the active
category filter (`ExpensesManager.tsx:49`).

#### 2. DashboardView refresh listener (minimal stateful conversion)

**File**: `src/components/dashboard/DashboardView.tsx`

**Intent**: When an expense is added via the global dialog while on the dashboard,
re-fetch the monthly summary and update the total/donut/breakdown in place. Add the
refresh seam only — no add-button (S-10 owns that).

**Contract**: Hold `entries` in state initialized from the `entries` prop. On mount,
subscribe with `onExpenseCreated` to re-fetch `GET /api/expenses/summary` and replace
`entries` (unsubscribe on unmount). Render from state; empty-state vs populated logic
unchanged. `currency` stays a prop.

#### 3. Migrate specs that used the navigating "Add Expense" link

**File**: `tests/e2e/expenses-add-and-summary.spec.ts`, `expenses-backdated-attribution.spec.ts`, `expenses-delete-updates-summary.spec.ts`, `expenses-edit-updates-summary.spec.ts`, `category-expense-drilldown.spec.ts`

**Intent**: These specs used the Topbar link to reach `/expenses` and auto-open the
add dialog. Since the link no longer navigates, route them via the retained deep-link.

**Contract**: Replace `getByRole("link", { name: "Add Expense" }).click()` +
`expect(page).toHaveURL(/\/expenses$/)` with `page.goto("/expenses?action=add")`,
then keep the existing `expect(getByRole("dialog", { name: "Add expense" }))
.toBeVisible()` assertion and the rest of each flow unchanged. (Later "Add expense"
button clicks inside these specs are the page-local button and remain valid.)

#### 4. Update nav-reachability for the in-place dialog + Expenses link

**File**: `tests/e2e/nav-reachability.spec.ts`

**Intent**: Reflect that "Add Expense" now opens an in-place dialog (no navigation)
and that the list is reached via the new "Expenses" link.

**Contract**: In both desktop and mobile tests, change the "Add Expense" step to
assert the dialog opens **without** a URL change (drop `toHaveURL(/\/expenses$/)`;
the current page stays), keeping the Escape-to-close assertion. Add a step clicking
`getByRole("link", { name: "Expenses" })` and asserting `toHaveURL(/\/expenses$/)`.

#### 5. New e2e: global in-place add flow

**File**: `tests/e2e/expenses-global-dialog-add.spec.ts`

**Intent**: Prove the headline behavior: from the dashboard, open the dialog from the
Topbar, add an expense, and see the dashboard summary update in place with no
navigation.

**Contract**: New independent spec (own signup with timestamped email; seeded default
categories). From `/dashboard`: click Topbar "Add Expense" → dialog visible, URL
still `/dashboard`; fill category + amount via existing `expenseDialog(page,"add")`
helper; submit; assert the dialog closes and the dashboard summary shows that
category's total in place (via `summaryRowFor`). No `waitForTimeout`; wait on
`toBeVisible`/`toHaveText`/`waitForResponse`. Follows the `/10x-e2e` anti-pattern
rules and reuses `tests/e2e/helpers.ts`.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run build`
- Linting passes: `npm run lint`
- Unit tests pass: `npm run test`
- Full e2e suite passes, including migrated specs and the new global-dialog spec:
  `npm run test:e2e`

#### Manual Verification:

- Add from the dashboard via Topbar → summary updates in place, no reload.
- Add from `/expenses` via Topbar → the list updates in place.
- Add from `/settings` via Topbar → dialog closes, page stays (no error, nothing to
  refresh).

**Implementation Note**: After this phase and all automated verification passes,
pause for manual confirmation.

---

## Testing Strategy

### Unit Tests:

- `useCreateExpense`: success (returns `true`, no error); 422/409/404 map the parsed
  server message; other non-ok maps the generic failure; `resetError` clears state.

### Integration / E2E Tests:

- Global in-place add from the dashboard updates the summary (new spec).
- Migrated specs continue to prove category attribution, backdating, edit, delete,
  and drilldown on `/expenses`.
- `nav-reachability` proves every core area (Dashboard, Expenses, Add Expense dialog,
  Settings, Sign out) is reachable at desktop and mobile widths.

### Manual Testing Steps:

1. Sign in; from the dashboard click Topbar "Add Expense" — dialog opens, URL stays
   `/dashboard`. Add an expense; summary updates in place.
2. Repeat from `/settings` and `/expenses`; confirm per-page refresh behavior.
3. New account with no categories: dialog shows the Settings hint, submit disabled.
4. Use the "Expenses" nav link; confirm the list loads. Confirm
   `/expenses?action=add` still auto-opens the dialog.

## Performance Considerations

Categories are fetched lazily on first dialog open and cached for the session — no
cost on pages where the dialog is never opened. The always-mounted island is a small
trigger with no data fetching until interaction.

## Migration Notes

- The `?action=add` deep-link and `autoOpenAdd` path are retained; no data or route
  migration.
- Six existing e2e specs are migrated in Phase 3 (mechanical: deep-link `goto`
  instead of clicking the navigating link).

## References

- Roadmap: `context/foundation/roadmap.md` S-16 (lines 171-181); FR-025 in
  `context/foundation/prd.md:212`.
- Sibling slice that reuses this hook/seam: `context/changes/dashboard-quick-add/plan-brief.md`.
- Create logic to extract: `src/components/expenses/ExpensesManager.tsx:89-115`.
- Reused dialog: `src/components/expenses/ExpenseFormDialog.tsx`.
- Categories endpoint: `src/pages/api/categories.ts:17`; summary endpoint:
  `src/pages/api/expenses/summary.ts`.
- E2E rules: `/10x-e2e` skill and `tests/e2e/helpers.ts`.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Extract shared `useCreateExpense` hook

#### Automated

- [x] 1.1 Type checking passes: `npm run build` — N/A: already shipped via `dashboard-quick-add` (merged before this plan's implementation started); re-verified green on current tree, no changes needed — ca6b4a9
- [x] 1.2 Linting passes: `npm run lint` — N/A: same as 1.1, re-verified green — ca6b4a9
- [x] 1.3 Unit tests pass, including the new hook test: `npm run test:unit` — N/A: `src/components/hooks/useCreateExpense.ts` + `.test.ts` already exist and pass; contract is `createExpense(input): Promise<{ok:true,expense}|{ok:false,error}>` rather than the plan's `{createExpense, serverError, resetError}` shape, and `ExpensesManager.tsx` is already repointed to it — accepted as the shared-hook goal being already met (see plan mismatch resolved at implementation start) — ca6b4a9

#### Manual

- [x] 1.4 Adding an expense on `/expenses` still works; server error surfaces in the dialog — ca6b4a9
- [x] 1.5 Edit and delete on `/expenses` are unaffected — ca6b4a9

### Phase 2: Global add-expense island + Topbar unification

#### Automated

- [x] 2.1 Type checking passes: `npm run build` — 9d2ce96
- [x] 2.2 Linting passes: `npm run lint` — 9d2ce96
- [x] 2.3 Unit tests pass: `npm run test:unit` — 9d2ce96

#### Manual

- [x] 2.4 Topbar "Add Expense" opens the dialog in place from the dashboard (no URL change); Escape closes it — 9d2ce96
- [x] 2.5 Category select populated from `GET /api/categories` — 9d2ce96
- [x] 2.6 Zero-category account sees the Settings hint with submit disabled — 9d2ce96 — DEVIATION: implemented as a separate minimal `Dialog` (title + hint + "Go to Settings" link) rather than `ExpenseFormDialog` with a disabled submit button — `ExpenseFormDialog` isn't rendered in this branch at all, so there's no form/submit to disable. Functionally equivalent (no path to submit either way). See impl-review F3.
- [x] 2.7 New "Expenses" nav link reaches `/expenses`; nav still reaches Dashboard, Settings, Sign out — 9d2ce96

### Phase 3: Reflect on current page + tests

#### Automated

- [x] 3.1 Type checking passes: `npm run build` — 30ff7b4
- [x] 3.2 Linting passes: `npm run lint` — 30ff7b4
- [x] 3.3 Unit tests pass: `npm run test:unit` — 30ff7b4
- [x] 3.4 Full e2e suite passes, including migrated specs and the new global-dialog spec: `npm run test:e2e` — also required fixing a Topbar "Add Expense"/page-local "Add expense" name collision (case-insensitive substring match) across specs from sibling changes that landed after this plan was authored (dashboard-quick-add, dashboard-month-comparison, expenses-category-filter, category-expense-drilldown) plus the shared `helpers.ts` — added `exact: true` to page-local button locators — 30ff7b4

#### Manual

- [x] 3.5 Add from dashboard via Topbar → summary updates in place, no reload — 30ff7b4
- [x] 3.6 Add from `/expenses` via Topbar → list updates in place — 30ff7b4
- [x] 3.7 Add from `/settings` via Topbar → dialog closes, page stays with no error — 30ff7b4
