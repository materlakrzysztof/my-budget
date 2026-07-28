# Follow-up: update e2e specs after the summary moved to the dashboard

**Origin**: `monthly-dashboard` Phase 2 (absorb the summary). Deferred by user decision during `/10x-implement`.

## Context

Phase 2 removed the monthly summary from `/expenses` and it now lives on `/dashboard`. Five e2e specs still assert the summary on the Expenses page via the `summaryRowFor` helper and will fail until updated. CI does **not** run e2e (lint + unit + build + migration-safety only), so these are stale-but-non-blocking.

## Specs to update

- `tests/e2e/category-expense-drilldown.spec.ts` — drills from a summary row; the summary + drill-down entry point is now on `/dashboard`.
- `tests/e2e/expenses-add-and-summary.spec.ts`
- `tests/e2e/expenses-edit-updates-summary.spec.ts`
- `tests/e2e/expenses-delete-updates-summary.spec.ts`
- `tests/e2e/expenses-backdated-attribution.spec.ts`
- `tests/e2e/helpers.ts` — `summaryRowFor` should target the dashboard summary; add a navigation helper to `/dashboard`.

## Suggested approach

Split each spec's assertions by page: perform add/edit/delete/backdate actions on `/expenses`, then navigate to `/dashboard` to assert the reconciled per-category summary totals and drill-down. Consider coordinating with roadmap **S-15** (`expenses-category-filter`), which also reshapes the Expenses page, so the e2e rework happens once.
