# Expense Name Field Implementation Plan

## Overview

Add an optional `name` field to expenses so a user can label an entry (e.g. "Birthday dinner") to tell it apart from others later, closing the "expense identity" gap named in `prd-v2.md` (FR-002, US-01) and roadmap slice S-05. This is a single additive column plus its validation, form field, and list display — no schema change touches the monthly summary view or its aggregation logic.

## Current State Analysis

- `expenses` table (`supabase/migrations/20260722090000_create_expenses.sql:3-11`) has `id, user_id, category_id, amount, date, created_at` — no name/description column.
- `createExpenseSchema`/`updateExpenseSchema` (`src/lib/services/expenses.ts:28-34`) validate only `categoryId`, `amount`, `date`.
- `Expense`, `CreateExpenseRequest` (`src/types.ts:21-34`) have no name field; `UpdateExpenseRequest` is a type alias of `CreateExpenseRequest` (`src/types.ts:36`).
- `ExpenseFormDialog.tsx` renders category/amount/date fields only (`src/components/expenses/ExpenseFormDialog.tsx:96-153`); `ExpenseList.tsx` renders `{amount}` and `{date} · {categoryName}` per row (`src/components/expenses/ExpenseList.tsx:27-30`).
- `monthly_category_summary` view and `getMonthlySummary`/`mergeCategoriesWithTotals` (`src/lib/services/expenses.ts:167-213`) only touch `user_id, category_id, date, amount` — confirmed unaffected by this change.
- No optional/nullable text field exists anywhere in this codebase today: `categories.description` is `not null` with `min(1)` Zod validation (`supabase/migrations/20260721120000_create_categories.sql:5`, `src/lib/services/categories.ts:18-21`). This change introduces the first nullable-optional-field convention.
- Unit tests live at `src/**/*.test.ts` (`vitest.config.ts:5`) — no existing unit test file for `expenses.ts` today.

## Desired End State

A user can type an optional name (max 100 chars) when adding or editing an expense; it's saved, shown in the expense list next to the category/date line, and persists through edit. Leaving it blank behaves exactly as today (stored as `null`, nothing rendered). Existing expenses (created before this change) show no name and are otherwise unaffected. The monthly summary is byte-for-byte unchanged.

### Key Discoveries:

- `EXPENSE_SELECT` (`src/lib/services/expenses.ts:73`) is the single string that must gain the new column for every read path (`listExpenses`, `createExpense`, `updateExpense` all reuse it).
- `ExpenseList.tsx:28-30`'s `·`-separated `{date} · {categoryName}` line is a Playwright locator anchor (`tests/e2e/helpers.ts:119-121`, `expenseRowFor`, filters on `hasText: "·"`) — the new name must render as a **separate** line, not inserted into that line, or existing e2e specs break.
- `expenseDialog`/`expenseRowFor`/`summaryRowFor` helpers (`tests/e2e/helpers.ts:105-121`) are unaffected by an added field as long as the `·` line and dialog title stay intact.

## What We're NOT Doing

- No separate `description` field — PRD-v2 FR-002 names one field ("name/description"); this plan implements a single `name` column.
- No full-text/keyword search over the new field (`prd-v2.md` Non-Goals).
- No backfill or default value for existing rows beyond `null`.
- No new dedicated e2e spec file — coverage lands as unit + integration tests plus assertions added to existing e2e specs that already exercise add/edit.
- No change to `monthly_category_summary` view, `getMonthlySummary`, or `mergeCategoriesWithTotals`.

## Implementation Approach

Follow the existing top-down layering used by S-02/S-03 (schema → service/validation → API → UI), landing the additive migration and Zod/type changes first (Phase 1), then the form/list UI (Phase 2), then tests (Phase 3). The empty-string-to-`null` normalization happens once, in the Zod schema, so both the API route and any future caller get consistent behavior without duplicating the rule in the React form.

## Critical Implementation Details

**Null handling convention (new precedent).** Since no optional-field convention exists in this codebase yet: a blank or whitespace-only name normalizes to `null` (not `""`) at the Zod-schema boundary (`z.string().trim().max(100).optional()` transformed so `undefined`/`""` → `null`). `toExpense` and `ExpenseList` should therefore only ever check `!== null` (never also check for empty string) to decide whether to render a name.

## Phase 1: Data & Validation Layer

### Overview

Add the nullable column and thread it through validation, the service layer, and shared types — no UI yet.

### Changes Required:

#### 1. New migration

**File**: `supabase/migrations/20260724100000_add_expense_name.sql`

**Intent**: Add an optional label to expenses, purely additive so existing rows remain valid with no backfill.

**Contract**: `alter table public.expenses add column name text;` — nullable, no default, no length constraint (length is enforced at the app layer only, matching the existing convention where `categories.description`'s `max(200)` is Zod-only with no DB-side check). No RLS change needed — existing per-row policies already cover the whole row.

#### 2. Validation & service layer

**File**: `src/lib/services/expenses.ts`

**Intent**: Validate the new field (max 100 chars, blank → `null`), select/map it on every read, and pass it through on write.

**Contract**: Add a `nameSchema` next to `amountSchema`/`dateSchema` (`expenses.ts:15-26`) and include it in `createExpenseSchema`/`updateExpenseSchema` (`expenses.ts:28-34`) as `name: nameSchema`, producing `z.infer` type `string | null`. Extend `EXPENSE_SELECT` (`expenses.ts:73`) to include `name`, `ExpenseRow` (`expenses.ts:64-71`) with `name: string | null`, `toExpense` (`expenses.ts:75-92`) to map it onto `Expense.name`, and the `insert`/`update` payload objects in `createExpense`/`updateExpense` (`expenses.ts:125`, `expenses.ts:142`) to include `name: input.name`.

#### 3. Shared types

**File**: `src/types.ts`

**Intent**: Expose the new field on the entity and request DTOs.

**Contract**: Add `name: string | null` to `Expense` (`types.ts:21-28`) and `CreateExpenseRequest` (`types.ts:30-34`); `UpdateExpenseRequest` inherits it automatically via its existing type alias (`types.ts:36`).

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly: `npx supabase start` (or `npx supabase db reset` if already running)
- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Existing schema-safety suite still passes unchanged: `npm run test:schema-safety`

#### Manual Verification:

- N/A for this phase (no UI yet) — covered by Phase 2's manual verification.

---

## Phase 2: UI — Form & List

### Overview

Surface the field in the add/edit dialog and the expense list.

### Changes Required:

#### 1. Add/edit form

**File**: `src/components/expenses/ExpenseFormDialog.tsx`

**Intent**: Let the user type an optional name when adding or editing an expense.

**Contract**: Add a `name` local state (`useState`) seeded from `editingExpense.name ?? ""` in edit mode, mirroring the existing `amount`/`date` pattern (`ExpenseFormDialog.tsx:44-45`). Add a plain `<Input>` field (following the `expense-amount`/`expense-date` markup at `ExpenseFormDialog.tsx:119-153`) with a client-side max-length guard (100 chars) mirroring the existing `validate()` structure (`ExpenseFormDialog.tsx:49-66`). Include `name: name.trim()` in the `onSubmit` payload (`ExpenseFormDialog.tsx:75`) — the server-side schema owns the empty-string-to-`null` normalization, so the client just sends the trimmed raw string.

#### 2. Expense list display

**File**: `src/components/expenses/ExpenseList.tsx`

**Intent**: Show the name so users can tell expenses apart at a glance, without disturbing the existing `·`-separated line that e2e helpers key off of.

**Contract**: Insert a new conditional line between the amount (`ExpenseList.tsx:27`) and the existing `{date} · {categoryName}` line (`ExpenseList.tsx:28-30`) that renders only `expense.name !== null` — the existing line's structure and text stay byte-for-byte the same.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Build succeeds: `npm run build`

#### Manual Verification:

- Adding an expense with a name shows it in the list immediately
- Adding an expense with a blank name behaves exactly as before (no stray empty line)
- Editing an existing (pre-change) expense shows an empty name field, and setting one persists on save
- Existing expenses without a name display unchanged

---

## Phase 3: Testing

### Overview

Cover the new validation/null-handling behavior and confirm no regression in existing add/edit e2e coverage.

### Changes Required:

#### 1. Unit tests for the schema

**File**: `src/lib/services/expenses.test.ts` (new)

**Intent**: Lock in the trim/max-length/empty-to-null behavior decided for the new field, since it's a new convention with no prior test to copy.

**Contract**: Test `createExpenseSchema`/`updateExpenseSchema` parsing of: a normal name (passes through trimmed), a name over 100 chars (fails), an empty string and whitespace-only string (both parse to `null`), and an omitted `name` key (parses to `null`).

#### 2. Integration test for persistence

**File**: `tests/integration/expense-category-validation.test.ts` (extend) or a small new integration test alongside it

**Intent**: Confirm the name round-trips through a real Supabase insert/update, since unit tests alone don't cover the DB column existing and mapping correctly.

**Contract**: `createExpense` with a `name` returns an `Expense` whose `name` matches; `createExpense` with `name: null` returns `name: null`; `updateExpense` can change an existing expense's name.

#### 3. Existing e2e specs

**Files**: `tests/e2e/expenses-add-and-summary.spec.ts`, `tests/e2e/expenses-edit-updates-summary.spec.ts`

**Intent**: Confirm the new field doesn't break the flows these specs already exercise, and that a named expense's name is visible in the list.

**Contract**: Add one assertion each — e.g. fill the new name field when adding/editing an expense in these specs and assert the name text appears in `expenseRowFor(...)` — no new spec file, no change to existing locators or the seed pattern.

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

- `createExpenseSchema`/`updateExpenseSchema` name validation: normal value, over-length, blank/whitespace, omitted key

### Integration Tests:

- `createExpense`/`updateExpense` round-trip the `name` column against a real Supabase instance

### Manual Testing Steps:

1. Add an expense with a name — confirm it shows in the list
2. Add an expense with a blank name — confirm no stray line and no error
3. Edit an existing pre-change expense — confirm the name field starts empty, set a name, save, confirm it now shows
4. Confirm the monthly summary numbers are unchanged after adding named expenses

## Performance Considerations

None — single nullable column, no new index, no change to the summary view or its query.

## Migration Notes

Purely additive (`alter table ... add column`); existing rows get `null` automatically with no backfill step required.

## References

- Roadmap slice: `context/foundation/roadmap.md` S-05
- PRD: `context/foundation/prd-v2.md` FR-002, FR-005, US-01
- Prior pattern (required, not optional, field): `src/lib/services/categories.ts:18-21`, `supabase/migrations/20260721120000_create_categories.sql:5`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Data & Validation Layer

#### Automated

- [x] 1.1 Migration applies cleanly — 4f89c49
- [x] 1.2 Type checking passes — 4f89c49
- [x] 1.3 Linting passes — 4f89c49
- [x] 1.4 Existing schema-safety suite still passes unchanged — 4f89c49

### Phase 2: UI — Form & List

#### Automated

- [x] 2.1 Type checking passes — 90afd65
- [x] 2.2 Linting passes — 90afd65
- [x] 2.3 Build succeeds — 90afd65

#### Manual

- [ ] 2.4 Adding an expense with a name shows it in the list immediately
- [ ] 2.5 Adding an expense with a blank name behaves exactly as before
- [ ] 2.6 Editing an existing (pre-change) expense shows an empty name field, and setting one persists on save
- [ ] 2.7 Existing expenses without a name display unchanged

### Phase 3: Testing

#### Automated

- [x] 3.1 Unit tests pass — 6e69b42
- [ ] 3.2 Integration tests pass
- [ ] 3.3 Full e2e suite passes
