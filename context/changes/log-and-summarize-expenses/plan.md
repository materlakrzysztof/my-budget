# Log and Summarize Expenses — Implementation Plan

## Overview

Roadmap slice `S-03` (`context/foundation/roadmap.md`), the north star of the MVP: a signed-in user can log an expense with today's date or a backdated (past) date, a positive amount, and a manually selected category (FR-006, FR-007, FR-008), then see it reflected in a ranked, month-end per-category summary (FR-009) that satisfies both PRD user stories (US-01, US-02). This is the largest slice yet — it introduces the second Supabase-backed table (`expenses`), the first SQL view in this codebase, the first full CRUD surface (add/edit/delete, unlike categories' add-only precedent), the first dynamic Astro API route, and the first modal/dialog UI primitive.

## Current State Analysis

- No `expenses` table exists; `public.categories` (`supabase/migrations/20260721120000_create_categories.sql`) is the only non-auth table, shipped and reviewed in the `expense-categories` change.
- The categories feature is a complete, consistent precedent for this plan to replicate: migration (RLS, per-operation policies) → `src/types.ts` DTOs → `src/lib/services/categories.ts` (zod + row-mapper + typed errors) → `src/pages/api/categories.ts` (auth-first, JSON status mapping) → `src/pages/categories.astro` (direct service call in frontmatter) → `src/components/categories/*.tsx` (Manager/List/Form/Alert composition).
- `src/pages/dashboard.astro` is a static placeholder (welcome message + sign-out button) with no DB-backed content — left untouched by this plan per the planning decision below.
- No date-handling or aggregation code exists anywhere in `src/` (confirmed by a repo-wide grep for `new Date(`, `toISOString`, `Date.now(`, `Intl.`, `timeZone` — zero matches). Cloudflare Workers' `Date`/`Intl` are UTC-only with no timezone override available.
- `src/components/ui/` has `button.tsx`, `input.tsx`, `textarea.tsx` — no dialog and no select component yet.
- No integration-test layer exists yet in this codebase (only Vitest unit tests and Playwright E2E). Bootstrapping DB-level integration tests is explicitly the job of the sibling change `context/changes/testing-data-isolation-summary/` (test-plan.md Phase 1), not this plan.
- `context/changes/expense-categories/reviews/impl-review.md` (finding F1) established a recurring lesson: a DB-level derived/normalized value must match the app's own logic *exactly*, or an invariant silently breaks. This plan applies that lesson directly to money handling and month attribution (see Critical Implementation Details).

### Key Discoveries:

- `src/lib/supabase.ts:5` — `createClient(requestHeaders, cookies)` is the only way to get a Supabase client; always the anon key, cookie-scoped, never service-role. Must be reused unchanged for `expenses` so RLS keeps enforcing `auth.uid() = user_id`.
- `src/middleware.ts:4` — `PROTECTED_ROUTES` is a flat array checked with `startsWith`; a new route is just appended.
- `src/lib/services/categories.ts:50-60` — the only existing query-style precedent (`selectCategories`) is a plain `.select().eq().order()`. supabase-js has no native `GROUP BY`/`SUM` over `.select()` — aggregation needs a DB-side view or RPC.
- `context/changes/expense-categories/reviews/impl-review.md` F1 — DB unique-index normalization didn't match the app's `normalizeCategoryName`, silently letting a duplicate through. This plan's equivalent risk is money/date handling in two places disagreeing (see Critical Implementation Details).
- `context/changes/expense-categories/plan.md:27` — migrations are applied manually to the E2E and production Supabase SQL editors; there is no `supabase link`/`db push` automation. An already-applied migration is never edited — schema fixes ship as a new migration file.
- `context/foundation/prd.md` (Guardrails) — "the total shown in the monthly summary always reconciles with the sum of individual expense entries" and "a user's financial data is never visible to other users" are the two hard guardrails this plan must prove, not just implement.

## Desired End State

A signed-in user visits `/expenses` and sees their logged expenses (most recent first) and a ranked, largest-to-smallest monthly summary — every one of their categories appears, with a `$0.00` total and a zero-width bar for categories with no expenses this month. They can open a dialog to add an expense with today's date or any past date (never a future date), a positive amount, and one of their categories; edit any existing expense's amount, date, or category via the same dialog pre-filled; or delete an expense via an in-app confirmation dialog. Every mutation is reflected immediately in both the list and the summary. RLS enforces that no user can read or write another user's expenses, and a composite foreign key enforces that an expense's category always belongs to the same user who owns the expense.

Verify via: `npm run test:e2e -- expenses` passes against the dedicated E2E Supabase project, and `npm run test:unit` passes for the pure summary-ranking and validation logic.

## What We're NOT Doing

- Not implementing month-over-month trend analysis or a month selector/navigator — FR-009 and the roadmap's north star both scope the summary to the current month only (PRD Non-Goals).
- Not implementing CSV/Excel export, AI-based auto-categorization, bank-account import, or shared/multi-user budgets — all explicit PRD Non-Goals, unaffected by this slice.
- Not supporting zero or negative amounts (refunds/credits) — decided during planning; amounts are strictly positive (`amount > 0`), matching "expense" semantics with no PRD signal for refund tracking.
- Not adding a lower bound on how far back an expense can be dated — only a "no future dates" rule, per FR-006/FR-007's literal wording.
- Not adding pagination, search, or filtering to the expense list — `target_scale.data_volume: small` per the PRD, consistent with the categories precedent.
- Not adding bulk operations (bulk edit/delete, CSV import).
- Not building the deeper cross-cutting RLS-isolation or reconciliation *integration* test suite — this plan's own tests are its unit tests (pure ranking/validation logic) plus its own risk-tied E2E specs; bootstrapping a general DB-level integration-test layer for Risk #1/#2 stress-testing is `testing-data-isolation-summary`'s job (test-plan.md Phase 1), which is currently blocked on this plan landing.
- Not adding a new shadcn `select` component — the category picker uses a plain native `<select>` styled like the existing `Input`/`Textarea`, keeping this slice's new-dependency surface to just the dialog primitive.

## Implementation Approach

Four phases, bottom-up like `expense-categories`: schema + RLS + summary view, then the service/API/types layer, then the UI (including the first dialog primitive in this codebase), then E2E coverage via `/10x-e2e`. The summary is computed as a live Postgres view (not a materialized view or RPC — the smallest new pattern that satisfies "DB-side, single source of truth" without solving problems FR-009 doesn't ask for), queried with `security_invoker` so RLS keeps applying through it. Zero-expense categories are merged into the ranking in the service layer (a pure, unit-testable function), not baked into the view, since categories don't carry a date to group by.

## Critical Implementation Details

**A composite foreign key ties `expenses.category_id` to the *same* user, closing an ownership gap RLS alone doesn't cover.** RLS's `expenses_insert_own`/`expenses_update_own` policies only check `auth.uid() = user_id` on the expense row itself — nothing stops a client from posting a `category_id` that belongs to a different user's category. That wouldn't leak the other user's data (their category stays invisible under `categories_select_own`), but it would silently corrupt the expense: `listExpenses`'s join to `categories` would return no matching row (RLS blocks it), showing a blank/null category forever. The fix is a composite foreign key, `foreign key (user_id, category_id) references public.categories (user_id, id)`, which requires adding `unique (user_id, id)` to `categories` first — done via a **new** migration in this same phase (the `expense-categories` migration is already applied to the E2E and production projects and is never edited, per the established convention).

**Money is `numeric(12,2)` end-to-end and is never coerced to a JS `number` for arithmetic.** supabase-js returns `numeric` columns as strings. The service layer treats `amount` as a string in every DTO; the only place summation happens is the Postgres view (`sum(amount)`), never a JS `reduce`. This is the same class of risk as the categories review's F1 finding (a value computed/derived in two places must actually agree) — here the invariant is "the total shown always reconciles with the sum of entries," and the way to guarantee that is to compute the sum exactly once, in the database.

**"No future dates" has one authoritative source — a DB check constraint — with a same-definition client-side check for fast feedback only.** The table has `check (date <= current_date)`, evaluated by Postgres using its own session "today." The service layer's zod validation also rejects a client-supplied future date as a fast-fail UX nicety, computed from the same UTC-based "today" the Worker's `Date` naturally produces (Cloudflare Workers has no other timezone available) — but the DB constraint is the actual authority; a `23514` violation is mapped to the same friendly error a client-side rejection would produce. Phase 1's manual verification includes confirming the Supabase project's Postgres session timezone is UTC (`show timezone;`), so this assumption holds.

**An edit that changes an expense's date can move it into or out of the current month — the UI always refetches the summary after any mutation, never patches it optimistically.** Because the summary is a live query, not a cached value, there's nothing to invalidate — but a naive "patch the local list, leave the summary alone" implementation would show a stale total after an edit or delete. `ExpensesManager` refetches (or re-derives from a freshly-fetched summary response) after every create/update/delete.

## Phase 1: Database schema — `expenses` table, RLS, ownership FK, monthly-summary view

### Overview

Creates the second table this project owns, with full per-operation RLS (including update/delete, unlike categories), a composite foreign key that ties an expense's category to its own user, and a `security_invoker` view that computes per-category monthly totals without duplicating that logic anywhere else.

### Changes Required:

#### 1. Expenses table, ownership FK, and summary view migration

**File**: `supabase/migrations/20260722090000_create_expenses.sql` (new)

**Intent**: Store each user's expenses scoped by `user_id`, constrained so every expense's category is provably owned by the same user, with RLS covering all four operations (select/insert/update/delete — expenses are mutable, unlike categories), and a view that computes the ranked monthly summary as a single source of truth for "the total."

**Contract**:

```sql
alter table public.categories add constraint categories_user_id_id_key unique (user_id, id);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null,
  amount numeric(12,2) not null check (amount > 0),
  date date not null check (date <= current_date),
  created_at timestamptz not null default now(),
  constraint expenses_user_category_fk foreign key (user_id, category_id) references public.categories (user_id, id) on delete restrict
);

alter table public.expenses enable row level security;

create policy "expenses_select_own" on public.expenses
  for select to authenticated using (auth.uid() = user_id);

create policy "expenses_insert_own" on public.expenses
  for insert to authenticated with check (auth.uid() = user_id);

create policy "expenses_update_own" on public.expenses
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "expenses_delete_own" on public.expenses
  for delete to authenticated using (auth.uid() = user_id);

create index expenses_user_id_date_idx on public.expenses (user_id, date);

create view public.monthly_category_summary
  with (security_invoker = true) as
  select
    e.user_id,
    e.category_id,
    date_trunc('month', e.date)::date as month,
    sum(e.amount) as total
  from public.expenses e
  group by e.user_id, e.category_id, date_trunc('month', e.date);
```

`category_id` deliberately has no direct `references public.categories(id)` clause — the composite `expenses_user_category_fk` (on `(user_id, category_id)`) is the only foreign key, and it subsumes plain referential integrity while adding the ownership guarantee. `on delete restrict` prevents a category from ever being deleted out from under existing expenses (categories currently have no delete policy at all, so this is a forward-looking guard, not a live concern). The view's `with (security_invoker = true)` clause is load-bearing, not boilerplate: without it, the view runs with its owner's privileges and silently bypasses `expenses`' RLS, leaking every user's totals to every other user.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- Apply the migration SQL to the E2E Supabase project's SQL editor; confirm the table, all four policies, the composite FK, and the view exist with no errors.
- Apply the same migration SQL to the production Supabase project's SQL editor.
- Confirm the Supabase project's Postgres session timezone is UTC (`show timezone;` in the SQL editor), so the `date <= current_date` constraint agrees with the Worker's UTC `Date`.
- Insert two expenses under two different `auth.users` rows (via two authenticated app sessions or the SQL editor's RLS simulation) and confirm one user cannot see, update, or delete the other's expense, and cannot query the other's rows through `monthly_category_summary`.
- Attempt to insert an expense with a `category_id` belonging to a different user than `user_id` and confirm it is rejected by the composite FK.
- Attempt to insert an expense dated tomorrow and confirm it is rejected by the check constraint.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Service layer, types, and API routes

### Overview

Adds the `Expense`/summary types, the `expenses` service module (CRUD, validation, the pure category/total merge that produces the ranking), the CRUD + summary JSON API routes, and unit tests for the pure logic.

### Changes Required:

#### 1. Shared types

**File**: `src/types.ts` (extend)

**Intent**: Define the `Expense` entity and its request/response DTOs alongside the existing `Category` types, following the same naming convention.

**Contract**: `Expense { id: string; categoryId: string; categoryName: string; amount: string; date: string; createdAt: string }` (amount stays a string end-to-end, per Critical Implementation Details); `CreateExpenseRequest { categoryId: string; amount: string; date: string }`; `UpdateExpenseRequest` — same shape as `CreateExpenseRequest` (full replace, all three fields editable); `ExpenseResponse { expense: Expense }`; `ListExpensesResponse { expenses: Expense[] }`; `MonthlySummaryEntry { categoryId: string; categoryName: string; total: string; rank: number }`; `MonthlySummaryResponse { summary: MonthlySummaryEntry[] }`.

#### 2. Expenses service

**File**: `src/lib/services/expenses.ts` (new)

**Intent**: Own CRUD, validation, and the category/total merge that produces the ranked summary — the single place all four consumers (list/create/update/delete API routes, plus the SSR page) go through.

**Contract**:

- Zod schemas for create and update: `categoryId` a UUID, `amount` a positive decimal string with at most 2 decimal places, `date` an ISO `YYYY-MM-DD` string not later than today (the fast-fail client-side check from Critical Implementation Details).
- `FutureDateError` and `CategoryOwnershipError` typed `Error` subclasses, mapped from Postgres `23514` (check violation) and `23503` (FK violation) respectively — the latter should essentially never trigger through the UI (the category dropdown only ever offers the user's own categories) but is defense-in-depth against a direct API call.
- `listExpenses(supabase, userId): Promise<Expense[]>` — selects the user's expenses joined with their category's name, ordered most-recent-date first.
- `createExpense(supabase, userId, input: CreateExpenseRequest): Promise<Expense>` — validates, inserts, maps `23514`/`23503` to the typed errors above.
- `updateExpense(supabase, userId, expenseId, input: UpdateExpenseRequest): Promise<Expense>` — validates, updates the row scoped by `id` and `user_id`; if no row matches (wrong owner or nonexistent id), throws a typed `ExpenseNotFoundError`.
- `deleteExpense(supabase, userId, expenseId): Promise<void>` — deletes scoped by `id` and `user_id`.
- `getMonthlySummary(supabase, userId, referenceDate?: Date): Promise<MonthlySummaryEntry[]>` — computes the first-of-month for `referenceDate` (defaulting to `new Date()`), queries the user's categories and `monthly_category_summary` filtered to that month, and calls `mergeCategoriesWithTotals`. The optional `referenceDate` parameter exists specifically so unit tests can exercise month-boundary behavior without mocking the system clock.
- `mergeCategoriesWithTotals(categories: { id: string; name: string }[], totals: { categoryId: string; total: string }[]): MonthlySummaryEntry[]` — pure function, exported separately for unit testing. Every category appears exactly once; categories with no matching total default to `"0.00"`; sorted descending by numeric total; ties broken alphabetically by category name; `rank` assigned `1..N` after sorting.

#### 3. API routes — expenses collection

**File**: `src/pages/api/expenses.ts` (new)

**Intent**: Expose list and create as JSON, following the categories route's exact auth-first, status-mapping conventions.

**Contract**: `export const prerender = false;` `GET` — 401 if no `locals.user`; else `{ expenses: Expense[] }` via `listExpenses`. `POST` — 401 if no user; parse + zod-validate body (400 with issues on failure); call `createExpense`; `201 { expense }` on success, `422 { error }` on `FutureDateError`, `409 { error }` on `CategoryOwnershipError`.

#### 4. API routes — single expense

**File**: `src/pages/api/expenses/[id].ts` (new)

**Intent**: Expose update and delete as JSON for a single expense, addressed by its `id` path param.

**Contract**: `export const prerender = false;` `PATCH` — 401 if no user; zod-validate body; call `updateExpense`; `200 { expense }`, `404` on `ExpenseNotFoundError`, `422`/`409` on the same validation errors as create. `DELETE` — 401 if no user; call `deleteExpense`; `204` on success, `404` on `ExpenseNotFoundError`.

#### 5. API route — monthly summary

**File**: `src/pages/api/expenses/summary.ts` (new)

**Intent**: Expose the ranked current-month summary as JSON, as a sibling static route to the dynamic `[id].ts` (Astro resolves the literal `summary.ts` match before the dynamic pattern — no route-priority code needed).

**Contract**: `export const prerender = false;` `GET` — 401 if no user; else `{ summary: MonthlySummaryEntry[] }` via `getMonthlySummary(supabase, user.id)` (no `referenceDate` override from the client — always "now").

#### 6. Unit tests

**File**: `src/lib/services/expenses.test.ts` (new)

**Intent**: Cover `mergeCategoriesWithTotals` and the validation schemas in isolation, without a browser or live Supabase project — the cheapest-layer verification for the summary-ranking logic (test-plan.md Risk #2) and amount/date validation edge cases.

**Contract**: Table-driven cases for `mergeCategoriesWithTotals` — a category with no matching total defaults to `"0.00"`, descending order by total, alphabetical tie-break, correct sequential `rank` values; validation cases for the create/update schema — amount `0`, negative, and more than 2 decimal places all rejected, a well-formed positive amount accepted; a future-dated ISO string rejected, today and any past date accepted.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm run test:unit`
- Lint passes: `npm run lint`
- Type checking passes: `npx astro check`
- Build passes: `npm run build`

#### Manual Verification:

- Against the E2E Supabase project (`npm run dev:e2e`), `POST /api/expenses` with a valid body creates an expense and `GET /api/expenses` reflects it.
- `PATCH /api/expenses/:id` updates the amount/date/category and `GET /api/expenses` reflects the change; `DELETE /api/expenses/:id` removes it.
- `GET /api/expenses/summary` reflects all of the user's categories, with `$0.00` for any category with no expenses this month, ranked largest-to-smallest.
- `POST /api/expenses` with a future date returns `422`; with another user's `category_id` (if reachable at all — likely only testable via a direct request) returns `409`.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: UI — expenses page, add/edit dialog, and ranked summary

### Overview

Adds the protected `/expenses` page: an expense list with edit/delete actions, a dialog (this codebase's first) for adding and editing expenses, and a ranked monthly summary with a CSS-only proportional bar per category.

### Changes Required:

#### 1. Protect the new route

**File**: `src/middleware.ts`

**Intent**: Gate `/expenses` the same way `/dashboard` and `/categories` already are.

**Contract**: Add `"/expenses"` to the `PROTECTED_ROUTES` array.

#### 2. Dialog primitive

**Intent**: Add this codebase's first modal/dialog component, per CLAUDE.md's "install new shadcn components with `npx shadcn@latest add [name]`" — needed for the add/edit form overlay and the delete confirmation.

**Contract**: `npx shadcn@latest add dialog` (adds `src/components/ui/dialog.tsx`).

#### 3. Expenses page

**File**: `src/pages/expenses.astro` (new)

**Intent**: SSR entry point — fetches the user's categories (for the picker), expenses, and monthly summary directly via the service layer (no self-fetch), following `categories.astro`'s pattern.

**Contract**: Frontmatter calls `listCategories(supabase, user.id)`, `listExpenses(supabase, user.id)`, and `getMonthlySummary(supabase, user.id)`; renders `<Layout title="Expenses">` wrapping `<ExpensesManager categories={categories} initialExpenses={expenses} initialSummary={summary} client:load />`.

#### 4. Expenses island (state + composition)

**File**: `src/components/expenses/ExpensesManager.tsx` (new)

**Intent**: Own the expense list, summary, and dialog state (add vs. edit mode, which expense is being edited, delete-confirmation target); after any successful create/update/delete, refetch the summary (never patch it optimistically, per Critical Implementation Details) and update the expense list from the mutation's response or a fresh `GET /api/expenses`.

**Contract**: `props: { categories: Category[]; initialExpenses: Expense[]; initialSummary: MonthlySummaryEntry[] }`; internal state: `expenses`, `summary`, `dialogMode: "closed" | "add" | "edit"`, `editingExpense: Expense | null`, `deleteTarget: Expense | null`, `serverError: string | null`. Renders `<MonthlySummary entries={summary} />`, `<ExpenseList expenses={expenses} onEdit={...} onDeleteRequest={...} />`, `<ExpenseFormDialog>` (open when `dialogMode !== "closed"`), and a delete-confirmation `<Dialog>` (open when `deleteTarget !== null`) built from the newly-added shadcn dialog primitive rather than a native `confirm()` — keeping delete confirmation in-app and consistently testable.

#### 5. Expense list

**File**: `src/components/expenses/ExpenseList.tsx` (new)

**Intent**: Render the current expenses (date, category name, amount) most-recent-first, with per-row Edit and Delete actions.

**Contract**: `props: { expenses: Expense[]; onEdit: (expense: Expense) => void; onDeleteRequest: (expense: Expense) => void }`.

#### 6. Add/edit expense dialog

**File**: `src/components/expenses/ExpenseFormDialog.tsx` (new)

**Intent**: A dialog wrapping one form reused for both add and edit (pre-filled from `editingExpense` when present); category picker is a plain native `<select>` styled like the existing `Input`/`Textarea` (no new shadcn select component, per What We're NOT Doing); amount is a text input (`inputMode="decimal"`), never `type="number"`, to avoid any JS float coercion before the value is sent as a string.

**Contract**: `props: { open: boolean; mode: "add" | "edit"; categories: Category[]; editingExpense: Expense | null; onSubmit: (input: CreateExpenseRequest | UpdateExpenseRequest) => Promise<void>; onClose: () => void; serverError: string | null }`; client-side validation mirrors `AddCategoryForm.tsx`'s `validate()` pattern (required category, positive-amount format check, date not in the future); renders `serverError` (e.g. the mapped `422`/`409` message) inline, following `DuplicateCategoryAlert.tsx`'s `role="alert"` pattern.

#### 7. Monthly summary display

**File**: `src/components/expenses/MonthlySummary.tsx` (new)

**Intent**: Render the ranked per-category totals with a CSS-only proportional bar per row (bar width scaled to `total / max(total across all entries)`, zero-width when every total is `0`).

**Contract**: `props: { entries: MonthlySummaryEntry[] }`; renders in `rank` order.

#### 8. Navigation link

**File**: `src/components/Topbar.astro`

**Intent**: Let a signed-in user reach the new page.

**Contract**: Add an "Expenses" link next to the existing "Dashboard" and "Categories" links, shown only in the signed-in branch.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Type checking passes: `npx astro check`
- Build passes: `npm run build`

#### Manual Verification:

- Visiting `/expenses` while signed out redirects to `/auth/signin`.
- A signed-in user with existing categories but no expenses sees an empty expense list and a summary showing every category at `$0.00` with zero-width bars.
- Adding an expense via the dialog (today's date) appears in the list and updates the correct category's summary total immediately, without a page reload.
- Adding a backdated expense does not change the current month's summary total for that category.
- Editing an expense's amount, date, or category updates both the list and the summary correctly (including moving a total between categories/months when the category or date changes).
- Deleting an expense (via the in-app confirmation dialog, not a native browser confirm) removes it from the list and reduces the correct category's summary total.
- Attempting to submit a future-dated expense is blocked client-side with an inline error before any request is sent.
- The "Expenses" link appears in the Topbar only when signed in.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: E2E coverage for expenses and the monthly summary

### Overview

Drives risk-tied Playwright coverage via `/10x-e2e log-and-summarize-expenses phase 4`, run against the dedicated E2E Supabase project once Phase 1's migration is applied there.

### Changes Required:

#### 1. Add expenses across categories, summary reconciles and ranks correctly

**File**: `tests/e2e/expenses-add-and-summary.spec.ts` (new, generated by `/10x-e2e`)

**Intent**: Prove FR-006, FR-008, US-01, and the summary-reconciliation guardrail together — the category a user selects is the category the total accrues to (test-plan.md Risk #4, using ≥2 distinct categories so a mixup is actually observable), and the ranked total reconciles with what was entered.

**Contract**: Sign up a unique user, add two expenses with today's date under two different categories with known amounts, navigate to the summary, assert each category's total equals its own expense's amount (not the other's) and the larger amount ranks first.

#### 2. Backdated expense does not affect the current month's summary

**File**: `tests/e2e/expenses-backdated-attribution.spec.ts` (new, generated by `/10x-e2e`)

**Intent**: Prove US-02 and test-plan.md Risk #3 — a backdated expense is attributed to the month it's dated in, not the month it's entered in.

**Contract**: Add a today-dated expense and a backdated (e.g. two months ago) expense in the same category with different known amounts; assert the current month's summary total for that category equals only the today-dated amount.

#### 3. Editing an expense updates the list and summary

**File**: `tests/e2e/expenses-edit-updates-summary.spec.ts` (new, generated by `/10x-e2e`)

**Intent**: Prove edit mutability is reflected everywhere the value is shown, per the "always refetch, never patch optimistically" design decision.

**Contract**: Add an expense, edit its amount via the dialog, assert the list shows the new amount and the category's summary total reflects it (old amount no longer contributes).

#### 4. Deleting an expense updates the list and summary

**File**: `tests/e2e/expenses-delete-updates-summary.spec.ts` (new, generated by `/10x-e2e`)

**Intent**: Prove delete mutability is reflected everywhere, using the in-app confirmation dialog (not a native browser confirm, which browser automation should avoid triggering).

**Contract**: Add two expenses in the same category, delete one via the confirmation dialog, assert the list no longer shows it and the summary total drops by exactly that amount.

### Success Criteria:

#### Automated Verification:

- `npx playwright test tests/e2e/expenses-add-and-summary.spec.ts` passes
- `npx playwright test tests/e2e/expenses-backdated-attribution.spec.ts` passes
- `npx playwright test tests/e2e/expenses-edit-updates-summary.spec.ts` passes
- `npx playwright test tests/e2e/expenses-delete-updates-summary.spec.ts` passes
- Full E2E suite passes: `npm run test:e2e`

#### Manual Verification:

- For each of the four specs, confirm the deliberate-break check `/10x-e2e` runs actually turned the test red before the fix/revert.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before considering the change done.

---

## Testing Strategy

### Unit Tests:

- `mergeCategoriesWithTotals` — categories with no expenses default to `$0.00`, correct descending ranking, alphabetical tie-break, sequential `rank` assignment.
- Amount/date validation schemas — zero, negative, and over-2-decimal amounts rejected; future dates rejected; well-formed values accepted.

### Integration Tests:

- Not applicable — this stack has no dedicated integration-test layer yet (that's `testing-data-isolation-summary`'s job); the CRUD + summary API contract, RLS isolation, ownership-FK enforcement, and month-attribution correctness are exercised via the Phase 1 manual verification and the Phase 4 Playwright specs instead.

### Manual Testing Steps:

1. Apply the Phase 1 migration to the E2E Supabase project and (separately) production.
2. `npm run dev:e2e`, sign up a new user, visit `/expenses` — confirm all default categories show `$0.00` and the list is empty.
3. Add an expense with today's date — confirm it appears in the list and its category's summary total updates without a page reload.
4. Add a backdated expense in the same category — confirm the current month's summary total is unaffected.
5. Edit an expense's category, amount, and date — confirm the list and summary both reflect the change correctly.
6. Delete an expense via the confirmation dialog — confirm it disappears from the list and the summary total drops accordingly.
7. Attempt a future-dated expense — confirm it's blocked client-side with an inline error.
8. Sign out, visit `/expenses` directly — confirm redirect to `/auth/signin`.

## Performance Considerations

None beyond what's already true of the stack — `target_scale.data_volume: small` per the PRD means the expense list and the monthly-summary view (a plain, non-materialized `GROUP BY` over a handful of rows) both run in single-digit milliseconds; no pagination, caching, or materialization needed at this scale.

## Migration Notes

This is a net-new table with no existing data to migrate. The composite foreign key requires `categories` to gain a `unique (user_id, id)` constraint — since `id` is already the primary key (and therefore already unique on its own), adding this constraint is a metadata-only change with no data-rewrite cost and cannot fail against existing rows.

## References

- Roadmap slice: `context/foundation/roadmap.md` (`S-03`, the north star)
- PRD requirements: `context/foundation/prd.md` (FR-006, FR-007, FR-008, FR-009, US-01, US-02, and the three Guardrails)
- Research: `context/changes/log-and-summarize-expenses/research.md`
- Prior plan conventions and precedent to replicate: `context/changes/expense-categories/plan.md`
- DB-vs-app normalization lesson applied here to money/date handling: `context/changes/expense-categories/reviews/impl-review.md` (F1)
- Sibling test-rollout change (blocked on this plan): `context/changes/testing-data-isolation-summary/research.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Database schema — expenses table, RLS, ownership FK, monthly-summary view

#### Automated

- [x] 1.1 Lint passes: `npm run lint` — 548948f
- [x] 1.2 Build passes: `npm run build` — 548948f

#### Manual

- [x] 1.3 Migration applied cleanly to the E2E Supabase project's SQL editor
- [x] 1.4 Migration applied to the production Supabase project's SQL editor
- [x] 1.5 Postgres session timezone confirmed UTC
- [x] 1.6 RLS cross-user isolation manually verified (select/update/delete and the summary view)
- [x] 1.7 Composite FK rejects a cross-user category_id
- [x] 1.8 Check constraint rejects a future-dated expense

### Phase 2: Service layer, types, and API routes

#### Automated

- [x] 2.1 Unit tests pass: `npm run test:unit`
- [x] 2.2 Lint passes: `npm run lint`
- [x] 2.3 Type checking passes: `npx astro check`
- [x] 2.4 Build passes: `npm run build`

#### Manual

- [x] 2.5 POST/GET /api/expenses create-and-list round trip verified
- [x] 2.6 PATCH/DELETE /api/expenses/:id update-and-delete verified
- [x] 2.7 GET /api/expenses/summary reflects all categories with correct $0.00 defaults and ranking
- [x] 2.8 Future-date POST returns 422; cross-user category_id returns 409

### Phase 3: UI — expenses page, add/edit dialog, and ranked summary

#### Automated

- [ ] 3.1 Lint passes: `npm run lint`
- [ ] 3.2 Type checking passes: `npx astro check`
- [ ] 3.3 Build passes: `npm run build`

#### Manual

- [ ] 3.4 Signed-out visit to `/expenses` redirects to `/auth/signin`
- [ ] 3.5 New user sees all categories at $0.00 with zero-width bars and an empty list
- [ ] 3.6 Adding an expense updates the list and summary without a page reload
- [ ] 3.7 Adding a backdated expense does not change the current month's summary
- [ ] 3.8 Editing an expense (amount/date/category) updates list and summary correctly
- [ ] 3.9 Deleting an expense via the in-app confirmation dialog updates list and summary
- [ ] 3.10 Future-dated submission is blocked client-side with an inline error
- [ ] 3.11 "Expenses" link appears in Topbar only when signed in

### Phase 4: E2E coverage for expenses and the monthly summary

#### Automated

- [ ] 4.1 `tests/e2e/expenses-add-and-summary.spec.ts` passes
- [ ] 4.2 `tests/e2e/expenses-backdated-attribution.spec.ts` passes
- [ ] 4.3 `tests/e2e/expenses-edit-updates-summary.spec.ts` passes
- [ ] 4.4 `tests/e2e/expenses-delete-updates-summary.spec.ts` passes
- [ ] 4.5 Full E2E suite passes: `npm run test:e2e`

#### Manual

- [ ] 4.6 Each spec's deliberate-break check confirmed red-then-green
