<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Log and Summarize Expenses

- **Plan**: context/changes/log-and-summarize-expenses/plan.md
- **Scope**: Full plan (Phases 1-4)
- **Date**: 2026-07-23
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 3 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

Plan Adherence: all 21 changed/planned files (migration, types, service, 3 API routes, middleware, page, 4 components, Topbar, dialog primitive, 4 E2E specs, helpers.ts additions, unit tests) verified MATCH against their plan Contract — no drift, no missing implementation.

Scope Discipline: the only dependency addition across all 4 phases is `radix-ui` (the planned shadcn dialog primitive); no unplanned files or endpoints found in any phase's diff.

Architecture: RLS covers all 4 operations on `expenses`, the `monthly_category_summary` view correctly declares `security_invoker = true`, and the composite ownership FK (`user_id, category_id) references categories(user_id, id)`) matches the plan's Critical Implementation Details verbatim.

Success Criteria: `npm run lint` (clean), `npm run test:unit` (17/17 passed), `npx astro check` (0 errors/0 warnings), `npm run build` (succeeded), and the full E2E suite (11/11 passed, including this phase's 4 new specs verified via deliberate-break red-then-green) all pass.

## Findings

### F1 — Unmapped Postgres errors surface as raw 500s for out-of-range amounts

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/expenses.ts:75-79 (mapWriteError), src/pages/api/expenses.ts:58, src/pages/api/expenses/[id].ts:48
- **Detail**: `amountSchema` (expenses.ts:12-16) has no upper bound, but the `amount` column is `numeric(12,2)`. A value like `"99999999999.99"` passes zod validation, then triggers Postgres `22003` (numeric field overflow) on insert/update. `mapWriteError` only handles `23514` and `23503`, so `22003` re-throws unmapped and surfaces as an unhandled 500 instead of a friendly `422`, through the bare `throw err;` fallthrough in both API routes.
- **Fix A ⭐ Recommended**: Add a `.max()` bound to `amountSchema` matching the column's precision (reject ≥ 10 digits before the decimal) so the fast-fail zod check catches it before the DB is ever hit.
  - Strength: Matches the existing "fast-fail client-side check, DB is still authoritative" pattern already used for future-dates in this same file.
  - Tradeoff: Duplicates the precision constraint in two places (zod + `numeric(12,2)`); if the column width ever changes, zod must be updated too.
  - Confidence: HIGH — same shape as the existing date-fast-fail pattern documented in the plan's Critical Implementation Details.
  - Blind spot: None significant — a `numeric(12,2)` overflow is unambiguous and unlikely to change without a deliberate migration.
- **Fix B**: Map `22003`/`22007`/`22008` in `mapWriteError` to a friendly validation error, same treatment as the existing two codes.
  - Strength: Keeps the DB as the single source of truth for the bound, no duplication.
  - Tradeoff: Users only find out about the bound after a round-trip to the DB, not immediately on typing.
  - Confidence: MEDIUM — straightforward but adds another code path to `mapWriteError`.
  - Blind spot: Haven't confirmed exactly which Postgres error codes numeric overflow can produce across supabase-js's error surface.
- **Decision**: FIXED via Fix A — added `MAX_AMOUNT = 9999999999.99` and a `.refine()` bound to `amountSchema` in src/lib/services/expenses.ts.

### F2 — mapWriteError conflates two distinct CHECK constraints under one error code

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/expenses.ts:5,76
- **Detail**: `FUTURE_DATE_VIOLATION = "23514"` is Postgres's generic `check_violation` code, shared by both `check (amount > 0)` and `check (date <= current_date)` on the `expenses` table. Any `23514` is unconditionally reported as "Expense date cannot be in the future," which would mislabel an amount-constraint failure. Currently unreachable in the UI (zod validates `amount > 0` before the DB is hit), but the same "defense-in-depth against a direct API call" reasoning that justifies `CategoryOwnershipError`'s mapping applies here too, and the code can't currently tell which constraint fired.
- **Fix**: Inspect `error.message`/`error.details` (Postgres includes the constraint name, e.g. `expenses_amount_check` vs the date check) to disambiguate before choosing which typed error to throw.
  - Strength: Makes the error message actually true regardless of which constraint fired, closing the same class of gap the plan already flags for `CategoryOwnershipError`.
  - Tradeoff: Parses a Postgres error string, which is a slightly less stable contract than an error code.
  - Confidence: MEDIUM — Postgres reliably includes the constraint name in `error.message`, but this hasn't been tested against a live `23514` on the amount check specifically.
  - Blind spot: Haven't verified the exact `error.details`/`error.message` shape supabase-js surfaces for this specific constraint under the E2E Supabase project.
- **Decision**: FIXED — added `InvalidAmountError`, disambiguated `23514` by checking `error.message` for `expenses_amount_check` in `mapWriteError`, and mapped the new error to 422 in both `src/pages/api/expenses.ts` and `src/pages/api/expenses/[id].ts`.

### F3 — Broken category join silently degrades to an empty category name

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/expenses.ts:64-73 (toExpense)
- **Detail**: `categoryName: row.categories?.name ?? ""` silently falls back to an empty string if the PostgREST embed for the composite FK ever returns null (e.g. a stale schema cache), rather than failing loudly like `ExpenseNotFoundError` does elsewhere.
- **Fix**: Throw or log if `row.categories` is unexpectedly null instead of defaulting silently.
- **Decision**: FIXED — `toExpense` now throws a descriptive error instead of defaulting `categoryName` to `""` when the embed is null.

### F4 — Unhandled mutation errors leave the UI silently stuck with only a console error

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/expenses/ExpensesManager.tsx:88-90,100-102
- **Detail**: A genuine 500 (e.g. from F1) throws inside `handleFormSubmit`/`handleConfirmDelete` with no catch, leaving the submit button reset via `finally` but no user-facing message. This mirrors `CategoriesManager.tsx`'s pre-existing gap exactly — not a new deviation, but expenses now has three mutation paths instead of one, multiplying the blast radius.
- **Fix**: Surface a generic `serverError` fallback for unmapped non-ok responses, consistent across both features.
- **Decision**: FIXED — `handleFormSubmit`/`handleConfirmDelete` in `ExpensesManager.tsx` now set a friendly `serverError` instead of throwing on an unmapped non-ok response; the delete-confirmation dialog now renders `serverError` too (previously only the form dialog did), via new `openDeleteDialog`/`closeDeleteDialog` helpers that also clear the error appropriately.

### F5 — Date validity beyond format is left entirely to Postgres

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/expenses.ts:18-22 (dateSchema)
- **Detail**: `dateSchema` only checks `YYYY-MM-DD` shape and "not future" — a calendar-invalid date like `2026-02-30` isn't caught client-side, only by Postgres's own error code, which falls into the same unmapped-error path as F1. Low practical risk since the native `<input type="date">` prevents most invalid entries from the UI.
- **Fix**: Fold into the same error-mapping fix as F1, or validate with a stricter zod date check.
- **Decision**: SKIPPED — low practical risk (the native date input already prevents most invalid entries) and the plan's Critical Implementation Details explicitly designate the DB check as the authoritative source for date validity.
