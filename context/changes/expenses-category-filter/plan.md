# Category Filter on Expenses List — Implementation Plan

## Overview

Add an **in-page category picker** to the expenses page so the user can filter
the expenses list by category without navigating away. The data path already
exists end-to-end — `GET /api/expenses?category=<id>` filters, the
`listExpenses` service takes a `{ categoryId }` filter, and
`ExpensesManager.refresh()` already refetches by category. What's missing is a
**client-side control** and the **filter state** behind it: today `categoryFilter`
is a fixed prop resolved once during SSR and never changes in the browser.

This plan converts that fixed prop into client-managed filter state driven by a
native `<select>`, refetches on change, and syncs `?category=` into the URL via
`history.replaceState` so the categories-page drill-down deep-links and
bookmarks keep working. The redundant "Filtered by / Clear filter" banner is
removed — the picker's value ("All categories" vs a category) is the single
source of truth for filter state.

## Current State Analysis

- **Filtering already works via URL only.** `src/pages/expenses.astro:12-17`
  reads `?category=`, resolves it against the user's own categories, and
  SSR-renders the filtered list. Entry is one-way: clicking a category on the
  categories page (`src/components/categories/CategoryList.tsx:37`) links to
  `/expenses?category=<id>`.
- **The API and service already filter.** `src/pages/api/expenses.ts:35-43`
  resolves `?category=` against owned categories (foreign/unknown id → no
  filter, full list); `src/lib/services/expenses.ts:119-135` (`listExpenses`)
  applies `{ categoryId }`. No backend work is needed.
- **`refresh()` already respects a filter** — `ExpensesManager.tsx:49-59` builds
  the fetch URL from `categoryFilter`. But `categoryFilter: Category | null`
  (`ExpensesManager.tsx:18`) is a fixed SSR prop; there is no control to change
  it in the browser, so filtering requires leaving for the categories page or
  hand-editing the URL, and clearing is a full-page navigation link
  (`ExpensesManager.tsx:143-152`).
- **The list already supports a filtered empty state** —
  `ExpenseList.tsx:18` accepts `emptyMessage`, and `ExpensesManager.tsx:158`
  already passes `"No expenses in this category."` when a filter is active.
- **The expense form's Category field is a native `<select>`**
  (`ExpenseFormDialog.tsx:106-120`), and the E2E suite drives selects with
  Playwright's `selectOption` (`tests/e2e/category-expense-drilldown.spec.ts`).
  The filter picker uses a native `<select>` for consistency and so the same
  `selectOption` interaction works in E2E.
- **No React component-test infrastructure exists.** `vitest.config.ts` includes
  only `src/**/*.test.ts` (not `.tsx`), with no jsdom/happy-dom env and no
  `@testing-library/react`. Interaction behavior in this repo is verified via
  Playwright E2E; this plan follows that convention rather than standing up a
  new component-test stack.

## Desired End State

On `/expenses`, above the list, a native `<select>` labelled for category
filtering offers "All categories" plus one option per category. Choosing a
category refetches and shows only that category's expenses **without a full page
reload**, and the URL updates to `/expenses?category=<id>`. Choosing "All
categories" shows every expense and resets the URL to `/expenses`. Loading
`/expenses?category=<id>` directly (the categories-page drill-down or a bookmark)
renders the filtered list SSR **and** preselects the picker to that category. An
empty filtered result shows "No expenses in this category."; an empty unfiltered
list shows "No expenses yet." The old "Filtered by / Clear filter" banner is
gone.

**Verification:** `npm run test:e2e` passes the new filter spec (filter → list
changes + URL syncs; clear → full list + URL resets; deep-link → picker
preselected). `npm run lint`, `npm run test:unit`, and `npm run build` stay
green.

### Key Discoveries:

- Data path is complete server-side — this is a **UI + client-state** change
  only (`api/expenses.ts:35-43`, `services/expenses.ts:119-135`).
- `refresh()` already parameterizes the fetch by filter
  (`ExpensesManager.tsx:49-59`) — it just needs to read from state instead of a
  fixed prop.
- SSR already resolves foreign/invalid `?category=` to "no filter"
  (`expenses.astro:13`, `api/expenses.ts:39-41`) — the picker seeded from that
  resolved value is automatically consistent (falls back to "All categories").
- Native `<select>` keeps parity with the expense form and with the E2E
  `selectOption` pattern; no new component dependency.

## What We're NOT Doing

- No changes to the API, the `listExpenses` service, or the database — filtering
  is already supported there.
- No keyword/full-text expense search (explicitly out of scope — PRD §Non-Goals,
  roadmap "No expense keyword/full-text search").
- No multi-select / multi-category filtering — single category or "All".
- No shadcn Radix Select component and no new component-test stack
  (`@testing-library/react` / jsdom) — behavior is covered by E2E per repo
  convention.
- No loading spinner during refetch — the existing `refresh()` has none and
  datasets are small; a brief in-place swap is acceptable within the <1s
  perceived-acknowledgement goal.

## Implementation Approach

Keep the SSR entry point exactly as-is (it already renders the correct initial
filtered list and is the deep-link/bookmark contract). Change `ExpensesManager`
so the filter becomes **client state seeded from the server-resolved filter**:

1. Replace the `categoryFilter: Category | null` prop with an initial category id
   (`initialCategoryId: string | null`) derived from the same resolved value in
   `expenses.astro`. Hold `selectedCategoryId` in `useState` seeded from it.
2. Render a native `<select>` bound to `selectedCategoryId` (empty value = "All
   categories") with an option per category.
3. On change: set state, call `refresh()` (which reads `selectedCategoryId`), and
   `history.replaceState` to `/expenses` or `/expenses?category=<id>`.
4. Derive the empty message from whether `selectedCategoryId` is set, and delete
   the banner block.

E2E then locks in the three behaviors (filter, clear, deep-link preselect).

## Phase 1: In-page category picker + client filter state

### Overview

Add the picker and convert the fixed SSR filter into client state with URL sync,
in `ExpensesManager` (and a one-line prop adjustment in `expenses.astro`).

### Changes Required:

#### 1. Expenses page — pass an initial category id instead of a resolved object

**File**: `src/pages/expenses.astro`

**Intent**: Keep the existing SSR resolution of `?category=` (it still produces
the correct initial filtered `expenses` list), but hand `ExpensesManager` the
resolved category **id** to seed client state rather than the full
`categoryFilter` object. Preserves drill-down/bookmark SSR behavior unchanged.

**Contract**: Continue computing `categoryFilter` locally for the `listExpenses`
call; pass `initialCategoryId={categoryFilter?.id ?? null}` to `ExpensesManager`
in place of the `categoryFilter={categoryFilter}` prop. `categories`,
`initialExpenses`, `currency`, and `autoOpenAdd` props are unchanged.

#### 2. ExpensesManager — filter state, native `<select>`, URL sync, remove banner

**File**: `src/components/expenses/ExpensesManager.tsx`

**Intent**: Turn the filter into interactive client state. Add
`selectedCategoryId` state seeded from `initialCategoryId`; render a native
`<select>` ("All categories" + one option per category) that, on change,
updates state, refetches, and rewrites the URL. Drive the empty message from the
active-filter state and remove the "Filtered by / Clear filter" banner.

**Contract**:
- Props: replace `categoryFilter: Category | null` with
  `initialCategoryId: string | null`.
- State: `const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(initialCategoryId)`.
- `refresh()` builds its URL from `selectedCategoryId` (was `categoryFilter`):
  `selectedCategoryId ? /api/expenses?category=<encoded> : /api/expenses`.
- New handler on the select's `onChange`: set `selectedCategoryId` (empty string
  → `null`), then refetch, then
  `history.replaceState(null, "", nextId ? \`/expenses?category=${nextId}\` : "/expenses")`.
  Refetch must read the new id (pass it in or refetch off the derived value — do
  not rely on the just-set state being current within the same tick).
- The `<select>` is a labelled control (associated `<label>` or `aria-label`
  such as "Filter by category") so it's reachable by `getByLabel`; value is
  `selectedCategoryId ?? ""`, with an `""`-valued "All categories" option first.
- `ExpenseList` `emptyMessage` derives from `selectedCategoryId != null`
  ("No expenses in this category." else "No expenses yet.").
- Delete the `categoryFilter && (…banner…)` block
  (`ExpensesManager.tsx:143-152`).
- The existing `autoOpenAdd` effect already `replaceState`s to `/expenses`; when
  it runs there is no category param, so no conflict — leave it as-is.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run build` (Astro `astro check` / tsc via build)
- Linting passes: `npm run lint`
- Existing unit tests pass: `npm run test:unit`

#### Manual Verification:

- Selecting a category shows only its expenses with no full-page reload, and the
  URL becomes `/expenses?category=<id>`.
- Selecting "All categories" shows all expenses and the URL resets to
  `/expenses`.
- Visiting `/expenses?category=<id>` directly renders the filtered list and the
  picker is preselected to that category.
- An empty filtered category shows "No expenses in this category."; an empty
  unfiltered list shows "No expenses yet."
- The old "Filtered by / Clear filter" banner is gone; add/edit/delete still
  refresh the currently filtered list correctly.

**Implementation Note**: After completing this phase and all automated
verification passes, pause here for manual confirmation from the human that the
manual testing was successful before proceeding to Phase 2.

---

## Phase 2: E2E coverage

### Overview

Lock in the three user-visible behaviors with a Playwright spec, following the
existing e2e patterns and helpers.

### Changes Required:

#### 1. Filter E2E spec

**File**: `tests/e2e/expenses-category-filter.spec.ts` (new)

**Intent**: Verify the picker filters the list and syncs the URL, that "All
categories" clears both, and that a deep-linked `?category=` preselects the
picker — the drill-down parity contract.

**Contract**: One authenticated flow using the existing helpers
(`signUpAndSignIn`, `expenseDialog`, `expenseRowFor` from `tests/e2e/helpers`),
mirroring `tests/e2e/category-expense-drilldown.spec.ts`. Seed at least two
categories with a known split of expenses. Assertions:
- Selecting a category via `getByLabel("Filter by category").selectOption({ label })`
  shows only that category's rows and `await expect(page).toHaveURL(/\/expenses\?category=/)`.
- Selecting "All categories" restores all rows and
  `await expect(page).toHaveURL(/\/expenses$/)`.
- Navigating to `/expenses?category=<id>` leaves the picker preselected
  (assert the select's value / that only that category's rows show).
- Unique email per run (`\`e2e-catfilter-${Date.now()}@example.com\``); wait on
  state (`toBeVisible`, `toHaveURL`, `toHaveCount`) — never `waitForTimeout`.

### Success Criteria:

#### Automated Verification:

- New spec passes: `npm run test:e2e`
- Full lint stays green: `npm run lint`

#### Manual Verification:

- The spec is not flaky across repeated local runs (state-based waits, unique
  ids).

**Implementation Note**: After Phase 2 automated verification passes, pause for
human confirmation before considering the slice complete.

---

## Testing Strategy

### Unit Tests:

- No new unit tests. Service-layer filtering (`listExpenses` with `{ categoryId }`)
  is already covered by `src/lib/services/expenses.test.ts` and the integration
  suite; this slice adds no service/API logic.

### Integration Tests:

- None new — the API filter path is unchanged and already exercised by
  `tests/integration/expense-category-validation.test.ts`.

### Manual Testing Steps:

1. Load `/expenses`; confirm the picker defaults to "All categories" and shows
   all expenses.
2. Pick a category; confirm only its expenses show, no reload, URL has
   `?category=<id>`.
3. Pick "All categories"; confirm full list and URL back to `/expenses`.
4. Deep-link `/expenses?category=<id>`; confirm filtered list + preselected
   picker.
5. From the categories page, click a category; confirm it lands filtered with
   the picker preselected (drill-down parity).
6. With a filter active, add/edit/delete an expense; confirm the filtered list
   refreshes correctly.
7. Pass a bogus `?category=nonsense`; confirm it falls back to "All categories"
   and the full list (SSR already resolves foreign ids to no filter).

## Performance Considerations

Filter changes refetch a small per-user list over the existing endpoint and swap
the list in place — well within the <1s perceived-acknowledgement target (PRD).
No pagination or virtualization needed at current data volumes.

## Migration Notes

None — no schema, API, or data changes. Existing `/expenses?category=<id>`
deep-links and bookmarks continue to work unchanged.

## References

- Roadmap slice: `context/foundation/roadmap.md` S-15 (lines 159-169)
- PRD requirement: `context/foundation/prd.md` FR-024 (line 207)
- Existing filter data path: `src/pages/api/expenses.ts:35-43`,
  `src/lib/services/expenses.ts:119-135`
- Component to change: `src/components/expenses/ExpensesManager.tsx:18,49-59,143-152`
- SSR entry: `src/pages/expenses.astro:12-17,29-36`
- E2E pattern reference: `tests/e2e/category-expense-drilldown.spec.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: In-page category picker + client filter state

#### Automated

- [ ] 1.1 Type checking passes: `npm run build`
- [ ] 1.2 Linting passes: `npm run lint`
- [ ] 1.3 Existing unit tests pass: `npm run test:unit`

#### Manual

- [ ] 1.4 Selecting a category filters in place and URL becomes `?category=<id>`
- [ ] 1.5 Selecting "All categories" shows all and URL resets to `/expenses`
- [ ] 1.6 Deep-link `/expenses?category=<id>` renders filtered list with picker preselected
- [ ] 1.7 Empty states show correct message; banner removed; CRUD refreshes filtered list

### Phase 2: E2E coverage

#### Automated

- [ ] 2.1 New spec passes: `npm run test:e2e`
- [ ] 2.2 Lint stays green: `npm run lint`

#### Manual

- [ ] 2.3 Spec is stable across repeated local runs (state-based waits, unique ids)
