# Category Expense Drilldown Implementation Plan

## Overview

Let a user click a category — from the monthly summary or the categories page — and see the filtered list of expenses belonging to it, closing the "category drill-down" gap named in `prd-v2.md` (FR-003, US-01) and roadmap slice S-06. Implemented as a query-param filter on the existing `/expenses` page (`?category=<id>`), reusing the one existing URL-driven deep-link pattern in this codebase rather than introducing a new route type.

## Current State Analysis

- `MonthlySummary.tsx:27-36` and `CategoryList.tsx:15-18` render every row as fully static markup — no `<a>`/`<button>`/`onClick` anywhere in either file today.
- `listExpenses` (`src/lib/services/expenses.ts:106-116`) takes only `userId`, no filter parameter; its query is `.eq("user_id", userId)` with no `category_id` clause anywhere in the file.
- `GET /api/expenses` (`src/pages/api/expenses.ts:19-31`) always returns the full unfiltered list; no query-string reading exists in this file.
- `expenses.astro:8-13` already has the one existing URL-driven deep-link precedent: `Astro.url.searchParams.get("action") === "add"` → `autoOpenAdd` prop → one-shot `useEffect` in `ExpensesManager.tsx:46-54` that opens the add dialog then strips the param via `history.replaceState`. No React-side `useSearchParams` exists anywhere in the codebase — this Astro-frontmatter-reads-the-param pattern is the only precedent.
- No page-level dynamic route (`[id].astro`) exists anywhere in `src/pages/` — the only bracket-param route in the repo is the API-only `src/pages/api/expenses/[id].ts`.
- `Expense` (`src/types.ts:21-28`) and `MonthlySummaryEntry` (`src/types.ts:46-51`) both already carry `categoryId`, so both entry points can link directly with no new type needed.
- `ExpenseList.tsx:12-17`'s empty state is a single hardcoded `"No expenses yet."` string with no variant.

## Desired End State

Clicking a category row in the monthly summary, or a category row on the categories page, navigates to `/expenses?category=<id>` and shows only that category's expenses, with a "Filtered by: <name>" banner and a "Clear filter" link back to the unfiltered `/expenses`. A category with zero matching expenses shows "No expenses in this category." instead of the generic empty state. The filtered list's sum reconciles exactly with that category's total already shown in the monthly summary. The full (unfiltered) `/expenses` view, the monthly summary itself, and category management are all unchanged when no filter is present.

### Key Discoveries:

- Reusing `listExpenses`'s existing `EXPENSE_SELECT`/`toExpense` (`expenses.ts:73-92`) means the filter only needs one extra conditional `.eq("category_id", ...)` — no new query-building path.
- Because `expenses` rows are already scoped `.eq("user_id", userId)`, passing another user's `categoryId` as the filter simply yields zero matching rows (RLS + the existing user_id clause already prevent cross-user leakage) — no extra ownership check is needed in the filter itself.
- `expenses.astro` already fetches the full `categories` list before rendering (`expenses.astro:10`), so the requested `category` param can be validated against it (resolve to a real `Category` object or `null`) in the same frontmatter block, with no extra query.

## What We're NOT Doing

- No new page route (`/categories/[id].astro`) — filtering happens on the existing `/expenses` page via query param.
- No modal/inline expansion — clicking navigates (full page load), consistent with the existing `<a href>` idiom already used in `Topbar.astro`.
- No redesign of the monthly summary's own totals/ranking logic (`prd-v2.md` Non-Goals) — only its rows become clickable.
- No keyword/full-text search (`prd-v2.md` Non-Goals) — this is category-filtered browsing only.
- No hiding of the category text within filtered `ExpenseList` rows — left exactly as-is per the confirmed design decision.

## Implementation Approach

Bottom-up: extend the service/API filter first (Phase 1), then wire the two click entry points and the filtered-view UI on top of it (Phase 2), then cover the new behavior and the reconciliation guardrail with tests (Phase 3).

## Critical Implementation Details

**Param validation & the "clear" affordance.** `expenses.astro` must resolve `?category=<id>` against the already-fetched `categories` array (`categories.find((c) => c.id === requestedId) ?? null`) rather than trusting the raw id — an unrecognized or missing id must behave identically to no filter (full list, no banner), not an error state. This resolved `Category | null` (not just the raw id string) should be the one value threaded through to `ExpensesManager`, so the banner can render `categoryFilter.name` without a second lookup, and the "Clear filter" link is simply `<a href="/expenses">` (a full navigation, not client-side state) since this filter is meant to persist across reloads/shares — unlike `autoOpenAdd`, do not strip the query param via `history.replaceState`.

## Phase 1: Service & API Filter

### Overview

Add the optional category filter at the data-access layer and expose it through the existing expenses endpoint.

### Changes Required:

#### 1. Service layer filter

**File**: `src/lib/services/expenses.ts`

**Intent**: Let callers optionally scope `listExpenses` to a single category, reusing the existing select/mapping path.

**Contract**: Change `listExpenses`'s signature (`expenses.ts:106`) to accept an optional third parameter, e.g. `filter?: { categoryId?: string }`, and conditionally chain `.eq("category_id", filter.categoryId)` onto the existing query (`expenses.ts:107-111`) only when provided — omitting the filter must produce the exact same query as today.

#### 2. API route query param

**File**: `src/pages/api/expenses.ts`

**Intent**: Let the client request a category-filtered list via the URL, so `ExpensesManager`'s `refresh()` can re-fetch the filtered view after add/edit/delete.

**Contract**: In the `GET` handler (`expenses.ts:19-31`), read `context.url.searchParams.get("category")` and pass it through to `listExpenses` as the filter when present.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Unit tests pass: `npm run test:unit`
- Integration tests pass: `npm run test:integration`

#### Manual Verification:

- N/A for this phase (no UI yet) — covered by Phase 2.

---

## Phase 2: UI — Entry Points & Filtered View

### Overview

Make category rows clickable in both entry points, and make `/expenses` render the filtered view with a banner and a distinct empty state.

### Changes Required:

#### 1. Monthly summary rows become links

**File**: `src/components/expenses/MonthlySummary.tsx`

**Intent**: Let a user click a category's summary row to drill into its expenses.

**Contract**: Wrap each row's content (`MonthlySummary.tsx:27-35`) in an `<a href={`/expenses?category=${entry.categoryId}`}>`, preserving the existing visual structure (name, total, progress bar).

#### 2. Category list rows become links

**File**: `src/components/categories/CategoryList.tsx`

**Intent**: Let a user click a category on the categories page to see its expenses.

**Contract**: Wrap each row's content (`CategoryList.tsx:15-18`) in an `<a href={`/expenses?category=${category.id}`}>`, preserving the existing name/description markup.

#### 3. Page-level param resolution

**File**: `src/pages/expenses.astro`

**Intent**: Resolve the `?category=` param against the user's own categories, and fetch the (optionally filtered) initial expense list server-side.

**Contract**: Read `Astro.url.searchParams.get("category")`, resolve it against the already-fetched `categories` array to a `Category | null` (see Critical Implementation Details), and pass that resolved object as a new `categoryFilter` prop to `ExpensesManager` (`expenses.astro:23-29`). Pass the resolved filter's id into the `listExpenses` call (`expenses.astro:11`) so the server-rendered initial list is already scoped.

#### 4. Filtered view banner, clear-filter link, refresh, and empty state

**File**: `src/components/expenses/ExpensesManager.tsx`

**Intent**: Show the user they're viewing a filtered subset, let them return to the full list, keep client-side refreshes scoped to the same filter, and distinguish "no expenses in this category" from "no expenses at all."

**Contract**: Add a `categoryFilter: Category | null` prop (`ExpensesManager.tsx:23-28`). Render a banner ("Filtered by: `{categoryFilter.name}`" + a `<a href="/expenses">Clear filter</a>") above `ExpenseList` when `categoryFilter` is set. Update `refresh()` (`ExpensesManager.tsx:56-68`) to fetch `/api/expenses?category=${categoryFilter.id}` instead of the unfiltered URL when a filter is active. Pass an `emptyMessage` prop to `ExpenseList` — `"No expenses in this category."` when filtered, the existing `"No expenses yet."` otherwise.

#### 5. Configurable empty message

**File**: `src/components/expenses/ExpenseList.tsx`

**Intent**: Support the two empty-state variants without hardcoding either.

**Contract**: Add an `emptyMessage?: string` prop (default `"No expenses yet."`) and use it in place of the current hardcoded string (`ExpenseList.tsx:15-17`).

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Build succeeds: `npm run build`

#### Manual Verification:

- Clicking a category in the monthly summary navigates to `/expenses?category=<id>` and shows only that category's expenses
- Clicking a category on the categories page does the same
- The "Filtered by: <name>" banner shows the correct category name; "Clear filter" returns to the full unfiltered list
- A category with zero expenses shows "No expenses in this category." with the banner still visible
- Adding/editing/deleting an expense while filtered keeps the view correctly scoped after refresh
- Visiting `/expenses` with no `category` param, or an unrecognized one, shows the full list with no banner (no regression)

---

## Phase 3: Testing

### Overview

Cover the new filter logic, its cross-user safety, and the end-to-end click-through + reconciliation guardrail from `prd-v2.md`.

### Changes Required:

#### 1. Unit test for the filter

**File**: `src/lib/services/expenses.test.ts` (create if not already present from a parallel change; extend otherwise)

**Intent**: Lock in that `listExpenses` only applies the category clause when a filter is given.

**Contract**: Cover: no filter → unchanged query behavior; a `categoryId` filter present → the query includes the category clause.

#### 2. Integration test for filtering & safety

**File**: `tests/integration/expense-category-validation.test.ts` (extend)

**Intent**: Confirm the filter works against a real Supabase instance and that requesting another user's `categoryId` yields an empty result rather than an error or leaked data.

**Contract**: `listExpenses(supabase, userId, { categoryId })` returns only that category's expenses for the owning user; the same call with a `categoryId` belonging to a different user returns an empty array (not an error).

#### 3. New e2e spec: click-through + reconciliation

**File**: `tests/e2e/category-expense-drilldown.spec.ts` (new)

**Intent**: Prove the full user-facing flow named in `prd-v2.md` US-01/Guardrails: navigate from the summary to a category's filtered list, and confirm the filtered list's sum reconciles exactly with that category's total in the summary.

**Contract**: Sign up, add 2+ expenses across 2+ categories, click a category row in the monthly summary, land on `/expenses?category=<id>` with the banner visible, assert the filtered `ExpenseList` shows only that category's rows, and assert their sum equals the summary's total for that category (reusing the `signUpAndSignIn`/`summaryRowFor`/`expenseRowFor` helpers in `tests/e2e/helpers.ts`).

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm run test:unit`
- Integration tests pass: `npm run test:integration`
- Full e2e suite passes: `npm run test:e2e`

#### Manual Verification:

- N/A — this phase is test-only.

---

## Testing Strategy

### Unit Tests:

- `listExpenses` query construction with and without a category filter

### Integration Tests:

- Filtered `listExpenses` against a real Supabase instance, including the cross-user-safety case

### Manual Testing Steps:

1. Click a category in the monthly summary — confirm the filtered list and banner
2. Click a category on the categories page — confirm the same
3. Click "Clear filter" — confirm return to the full list
4. Add an expense while filtered — confirm it appears (if matching category) or the list stays correctly scoped
5. Visit `/expenses` with a garbage `category` value — confirm graceful fallback to the full list

## Performance Considerations

None — a single additional `.eq()` clause on an already-indexed query path (`expenses_user_id_date_idx` covers `user_id`; category filtering adds a simple equality predicate, not a new access pattern at this data volume).

## Migration Notes

No schema change — this is a query/UI-only feature.

## References

- Roadmap slice: `context/foundation/roadmap.md` S-06
- PRD: `context/foundation/prd-v2.md` FR-003, FR-005, US-01
- Existing deep-link precedent: `src/pages/expenses.astro:13`, `src/components/expenses/ExpensesManager.tsx:46-54`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Service & API Filter

#### Automated

- [x] 1.1 Type checking passes — 67804a7
- [x] 1.2 Linting passes — 67804a7
- [x] 1.3 Unit tests pass — 67804a7
- [x] 1.4 Integration tests pass — 67804a7

### Phase 2: UI — Entry Points & Filtered View

#### Automated

- [x] 2.1 Type checking passes — 34def69
- [x] 2.2 Linting passes — 34def69
- [x] 2.3 Build succeeds — 34def69

#### Manual

- [ ] 2.4 Clicking a category in the monthly summary navigates to `/expenses?category=<id>` and shows only that category's expenses
- [ ] 2.5 Clicking a category on the categories page does the same
- [ ] 2.6 The "Filtered by: <name>" banner shows the correct category name; "Clear filter" returns to the full unfiltered list
- [ ] 2.7 A category with zero expenses shows "No expenses in this category." with the banner still visible
- [ ] 2.8 Adding/editing/deleting an expense while filtered keeps the view correctly scoped after refresh
- [ ] 2.9 Visiting `/expenses` with no `category` param, or an unrecognized one, shows the full list with no banner

### Phase 3: Testing

#### Automated

- [x] 3.1 Unit tests pass
- [ ] 3.2 Integration tests pass
- [ ] 3.3 Full e2e suite passes
