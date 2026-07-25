<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Expense Name Field

- **Plan**: context/changes/expense-name-description/plan.md
- **Scope**: Full plan (Phases 1–3 of 3)
- **Date**: 2026-07-25
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 2 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | PASS    |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

## Findings

### F1 — `CreateExpenseRequest.name` is required in the type but optional in the Zod schema

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/types.ts:33 vs src/lib/services/expenses.ts:31-43
- **Detail**: `nameSchema` is `.optional().transform(blank → null)`, so the HTTP request body may **omit** `name` entirely (it parses to `null`). But the TypeScript DTO `CreateExpenseRequest` declares `name: string | null` as a **required** property. This stricter-than-wire type is defensible (it forces internal callers to be explicit about name), but it was the direct root cause of the parallel-developed `category-expense-drilldown` integration test failing `astro check` after the merge — its `createExpense({ categoryId, amount, date })` calls no longer type-checked once `name` became required (fixed in that change's F1). Noted so future shared-DTO field additions are weighed for parallel-branch ripple.
- **Fix**: Optional — declare `name?: string | null` for parity with the schema's optionality, or keep it required by deliberate choice. Either is defensible; no change needed for correctness.
- **Decision**: PENDING

### F2 — Legacy (pre-change) row display is asserted only implicitly

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/expense-name-description/plan.md (Progress, Manual 2.7)
- **Detail**: The e2e specs genuinely exercise the new field — the add spec fills "Birthday dinner" and asserts it renders (expenses-add-and-summary.spec.ts:27,31), the edit spec fills and asserts "Movie night" (expenses-edit-updates-summary.spec.ts:25), and the un-named Transport expense implicitly covers blank-name. So Manual 2.4/2.5/2.6 are well-backed. Only 2.7 ("existing expenses without a name display unchanged") has no dedicated evidence — it's hard to test without pre-seeded legacy rows, and the `name !== null` render guard makes it safe by construction. Noted, not a required change.
- **Fix**: None required. If desired, add a row created with `name: null` and assert no name line renders.
- **Decision**: PENDING

## Notes

- Plan Adherence verified file-by-file: additive nullable migration; `nameSchema` (`.trim().max(100).optional().transform`) exactly per Critical Implementation Details; `name` woven into `EXPENSE_SELECT`, `ExpenseRow`, `toExpense`, and the create/update payloads; `name: string | null` on `Expense` + `CreateExpenseRequest`; form field with 100-char client guard seeded from `editingExpense.name ?? ""`; list renders a **separate** `expense.name !== null` line preserving the `·` e2e anchor. All match.
- Unit tests cover every case the plan named: trimmed pass-through, exactly-100, over-100 reject, empty→null, whitespace→null, omitted→null, and update-schema parity. Integration test round-trips name on create/create-null/update. Both e2e specs extended with fill+assert. Thorough.
- Automated success criteria verified green this session (after the sibling change's F1 fix): astro check 0 errors, lint clean, unit 40/40, integration 17/17, e2e 14/14 (serial).
