<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Dashboard Quick-Add Expense Implementation Plan

- **Plan**: context/changes/dashboard-quick-add/plan.md
- **Scope**: Phase 1 of 2, Phase 2 of 2 (full plan)
- **Date**: 2026-07-29
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 0 observations

## Verdicts

| Dimension            | Verdict |
| --------------------- | ------- |
| Plan Adherence        | WARNING |
| Scope Discipline      | PASS    |
| Safety & Quality      | WARNING |
| Architecture          | PASS    |
| Pattern Consistency   | WARNING |
| Success Criteria      | PASS    |

## Findings

### F1 — Post-add comparison recompute reproduces server aggregation client-side, contradicting the plan's explicit guardrail

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Plan Adherence
- **Location**: src/components/dashboard/DashboardView.tsx:41-66, src/lib/comparison.ts (new, not in plan)
- **Detail**: The plan's "Critical Implementation Details" section is explicit: after a successful POST, re-fetch `GET /api/expenses/summary` and **replace** state — "do not mutate a local copy... so the dashboard's total/donut/breakdown stay identical to a server render and cannot drift." The "What We're NOT Doing" section separately rules out "optimistic updates... reproducing server aggregation client-side."

  The plan's Phase 2 contract was written against a stale Current State Analysis — it describes `DashboardView` as taking `{ entries, currency }`, but a separate already-shipped change (`dashboard-month-comparison`, merged before this plan started) had already changed its real props to `comparison: MonthlyComparison` with month-over-month deltas. The plan never mentions this feature.

  Faced with that mismatch, the implementer re-fetches the current month's totals from `/api/expenses/summary` (authoritative, good) but rebuilds the **previous**-month side of the comparison from `comparison.categories[].previous` — values already sitting in browser state since the initial server render, not re-fetched — then runs `computeComparison` (aggregation, delta math, status classification, ranking) entirely client-side via the newly extracted `src/lib/comparison.ts`. This is precisely the pattern the plan says not to do, just for the comparison half rather than the raw total.

  Concretely: if previous-month data changes after page load (e.g. an edit/delete in another tab, or on the Expenses page, before the dashboard quick-add fires) the post-add delta badge can show a value that has already drifted from a fresh server render, until the next full page load — the exact class of drift the plan's guardrail exists to prevent. The deviation is also undocumented: unlike the no-categories guard (Progress row 2.7, explicitly justified inline), nothing in the plan's Progress notes or commit records this departure from "cannot drift."
- **Fix A ⭐ Recommended**: Document this as an accepted, scoped deviation — add a note to the plan (e.g. amend "Critical Implementation Details" or append to Progress 2.5) explaining that `DashboardView`'s real shape is comparison-based, that the plan's original guardrail assumed a shape that no longer existed at implementation time, and that the previous-month figures are carried from state rather than re-fetched as a deliberate trade-off (no new API endpoint was in scope).
  - Strength: Cheap, makes the plan an accurate record for future readers, mirrors how the no-categories deviation was already handled in this same document.
  - Tradeoff: The narrow correctness gap (previous-month drift across concurrent edits) stays unaddressed.
  - Confidence: HIGH — this repo's plans are actively used as living documents (see Progress row 2.7's inline justification pattern).
  - Blind spot: None significant.
- **Fix B**: Extend `GET /api/expenses/summary` (or a sibling read) to accept a target month so the client can re-fetch both current and previous month authoritatively and pass both into `computeComparison`, closing the drift gap entirely.
  - Strength: Fully restores the plan's original "cannot drift" guarantee.
  - Tradeoff: `src/pages/api/expenses/summary.ts` is currently hardcoded to the current month (verified — no query param); this is more than a comment, it's new endpoint surface the plan explicitly excluded ("No new API endpoint").
  - Confidence: MEDIUM — mechanically straightforward but reopens a scope boundary this plan deliberately closed.
  - Blind spot: Haven't checked whether `getMonthlySummary`/`getMonthlyComparison` are easily parameterized by month without touching RLS-sensitive query paths.
- **Decision**: FIXED via Fix A — documented as an accepted deviation in plan.md Progress row 2.5.

### F2 — Unhandled summary-refetch failure can strand the dialog open after a successful create

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/dashboard/DashboardView.tsx:53-65
- **Detail**: In `handleAddExpense`, `closeAddDialog()` runs unconditionally after the `fetch("/api/expenses/summary")` call, but only because it sits after the `if (response.ok)` block in the same async function — if that `fetch` throws (network failure, not just a non-2xx status), the throw propagates before `closeAddDialog()` executes. The expense has already been created server-side at that point, but the dialog stays open with the submitted values and no error is shown, inviting an accidental duplicate resubmit. `ExpensesManager.refresh()` has the same unguarded-fetch shape, so this isn't a new failure mode invented by this feature — it's a pre-existing gap that's now duplicated into a second call site.
- **Fix**: Wrap the refresh fetch in try/catch (or `.catch()`), and call `closeAddDialog()` regardless of refresh outcome since the create already succeeded — the create result, not the refresh result, should gate the dialog close.
- **Decision**: FIXED — wrapped the refresh in try/catch so `closeAddDialog()` always runs after a successful create.

### F3 — Comparison unit tests left behind in the wrong file after the code they test moved

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/services/expenses.test.ts:1-298 (tests), src/lib/comparison.ts (code now lives here)
- **Detail**: `computeComparison`, `mergeCategoriesWithTotals`, and `previousMonthReferenceDate` were extracted into `src/lib/comparison.ts`, but their `describe` blocks stayed in `src/lib/services/expenses.test.ts`, importing the functions via `expenses.ts`'s re-export rather than directly from their new home. This breaks the repo's own `X.ts` + `X.test.ts` co-location convention (e.g. `useCreateExpense.ts`/`useCreateExpense.test.ts`, `format.ts`/`format.test.ts`). Tests currently pass only because of the re-export; if that re-export is ever removed as dead weight, `comparison.ts` ships with no test coverage sitting next to it.
- **Fix**: Move the three `describe` blocks into a new `src/lib/comparison.test.ts`, importing directly from `./comparison`.
- **Decision**: FIXED — moved to `src/lib/comparison.test.ts`; `expenses.test.ts` trimmed to `listExpenses`/`createExpenseSchema`/`updateExpenseSchema` coverage.
