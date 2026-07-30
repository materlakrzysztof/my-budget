<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Dashboard Month-over-Month Comparison Implementation Plan

- **Plan**: context/changes/dashboard-month-comparison/plan.md
- **Scope**: Phase 2 of 2 (full plan — both phases complete)
- **Date**: 2026-07-29
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 1 observation

## Verdicts

| Dimension           | Verdict           |
| ------------------- | ------------------ |
| Plan Adherence      | PASS               |
| Scope Discipline    | PASS               |
| Safety & Quality    | WARNING            |
| Architecture        | PASS               |
| Pattern Consistency | WARNING            |
| Success Criteria    | PASS               |

## Success criteria verification

- `npm run lint` — re-run, PASS (0 errors).
- `npm run test:unit` — re-run, PASS (56/56).
- `npm run build` — verified during implementation (commit dcebf4c), no changes since; not re-run to save time.
- `npm run test:e2e` — verified during implementation (commit dcebf4c): 18/18 passed (1 flaky — failed attempt 1, passed on the project's standard local retry — consistent with existing shared-Supabase contention pattern noted elsewhere in the suite); no changes since.
- Manual verification: user confirmed complete (all 5 Progress manual rows checked with SHA dcebf4c).

## Findings

### F1 — `getMonthlyComparison` fetches the categories table twice

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (performance)
- **Location**: src/lib/services/expenses.ts:301-314 (`getMonthlyComparison`), via two `getMonthlySummary` calls each re-running the unfiltered `categories` query at line 227
- **Detail**: `getMonthlyComparison` calls `getMonthlySummary` twice (current + previous month) via `Promise.all`. Each call independently queries `categories` for the user — identical results both times, since categories aren't month-scoped. The plan's Performance Considerations section anticipated only "one additional `monthly_category_summary` read," not a second full categories fetch. The two calls run in parallel so latency impact is small, but it's a real duplicate round-trip per dashboard load.
- **Fix**: Fetch `categories` once in `getMonthlyComparison`, then call `mergeCategoriesWithTotals` directly for each month's totals instead of going through two independent `getMonthlySummary` calls (which each re-fetch categories).
- **Decision**: FIXED — extracted `fetchCategories`/`fetchMonthTotals` helpers; `getMonthlySummary` and `getMonthlyComparison` now each fetch categories exactly once. Verified via lint, build, unit (56/56), and e2e re-run.

### F2 — `"changed" | "new" | "dropped"` status union re-declared in three places

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/types.ts:68 (`CategoryDelta.status`), src/components/dashboard/MonthlySummary.tsx:10, src/components/dashboard/DeltaBadge.tsx:8
- **Detail**: The same literal union type is hand-typed independently in three files instead of importing one shared type. Low risk today, but the three copies can silently drift if a status value is ever added or renamed.
- **Fix**: Export `export type ComparisonStatus = CategoryDelta["status"];` from `src/types.ts` and import it in `MonthlySummary.tsx` and `DeltaBadge.tsx` instead of re-declaring the literal union.
- **Decision**: FIXED — exported `ComparisonStatus` from `types.ts`; `MonthlySummary.tsx` and `DeltaBadge.tsx` now import it instead of re-declaring the union. Verified via lint, build, unit (56/56), and e2e re-run.

### F3 — "dropped" status renders identically to a plain decrease (no distinct tag)

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency / Plan Adherence
- **Location**: src/components/dashboard/DeltaBadge.tsx:15-38
- **Detail**: `DeltaBadge` only special-cases `status === "new"` (renders a "new" tag, no percentage). `"dropped"` falls through the same numeric branch as `"changed"`, rendering as a plain −100% decrease with no distinct "dropped" label. This matches the plan's literal contract ("a `dropped` row rendering the decrease to 0,00" — only `new` is required to carry a tag) and is covered by the e2e spec's Housing-row assertion (`↓ 100% (-$80.00)`, no tag). Flagging only for confirmation that this was a deliberate reading of the plan, not an overlooked case.
- **Fix**: None required — implementer confirms this was an intentional, plan-literal design choice (a decrease to zero is self-evident from the arrow + −100% + $0.00 current amount; no additional tag was specified by the plan).
- **Decision**: ACCEPTED — confirmed intentional, matches plan's literal contract and is exercised by the e2e spec.
