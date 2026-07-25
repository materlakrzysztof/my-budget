<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Category Expense Drilldown

- **Plan**: context/changes/category-expense-drilldown/plan.md
- **Scope**: Full plan (Phases 1–3 of 3)
- **Date**: 2026-07-25
- **Verdict**: NEEDS ATTENTION → RESOLVED (all 3 findings addressed in triage 2026-07-25)
- **Findings**: 1 critical, 1 warning, 1 observation

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | PASS    |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | FAIL    |

## Findings

### F1 — `astro check` fails: integration test omits now-required `name`

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: tests/integration/expense-category-validation.test.ts:63-65
- **Detail**: The plan's own automated criterion "Type checking passes" (`npm run astro -- check`) is currently RED on develop with 3 `ts(2345)` errors. The concurrently-merged `expense-name-description` feature made `name: string | null` a **required** field of `CreateExpenseRequest` (src/types.ts:33), but the three `createExpense(...)` calls added in this change's Phase-3 integration test pass `{ categoryId, amount, date }` without `name`. Runtime integration tests pass (17/17) because `name` is nullable in the DB and the service simply omits it — so this is a type-contract break invisible to the test run and to CI (`ci.yml` runs lint + unit + build, not `astro check`). Compounding it: the finalization commit (cb62bab) flipped the "Type checking passes" checkbox without re-running `astro check` after fast-forwarding in the expense-name PR, so that checkbox currently asserts something false.
- **Fix**: Add `name: null` to the three `createExpense` calls (matches the "unnamed expense behaves as before" convention; `null` is the valid value for `string | null`). Then re-run `npm run astro -- check` to confirm 0 errors.
  - Strength: Restores the green type-check the plan requires; mirrors how `tests/integration/expense-name.test.ts` passes `name` explicitly.
  - Tradeoff: None — test-only, three-line change.
  - Confidence: HIGH — the type error and the required field are both confirmed in-repo.
  - Blind spot: None significant.
- **Decision**: FIXED — added `name: null` to the 3 createExpense calls; `astro check` back to 0 errors.

### F2 — Manual rows checked off without dedicated evidence

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/category-expense-drilldown/plan.md (Progress, Manual 2.5 / 2.7 / 2.8)
- **Detail**: All Manual verification rows were flipped `[x]` during finalization. The e2e spec (`category-expense-drilldown.spec.ts`) genuinely covers 2.4 (summary click → filtered list), 2.6 (banner + "Clear filter"), and 2.9 (no/invalid param → full list). But three rows have **no** automated coverage and no recorded manual evidence: 2.5 (clicking a row on the **categories page** — the e2e only exercises the summary entry point), 2.7 (a zero-expense category shows "No expenses in this category." with the banner still visible), and 2.8 (add/edit/delete while filtered keeps the view scoped). They were checked off on the user's "odhacz wszystkie" instruction — a rubber-stamping risk if read later as verified.
- **Fix**: Either walk 2.5 / 2.7 / 2.8 in the browser and confirm, or annotate them in Progress as user-attested (not test-backed) so future readers know their evidence basis.
- **Decision**: FIXED — annotated Progress: 2.4/2.6/2.9 tagged as e2e-backed, 2.5/2.7/2.8 tagged "user-attested (no automated coverage)".

### F3 — API filter uses raw `?category=` id; SSR resolves it first

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/expenses.ts:29-34
- **Detail**: `GET /api/expenses` passes the raw `?category=` string straight into `listExpenses`'s filter without resolving it against the user's own categories, whereas the SSR path (`expenses.astro`) resolves it via `categories.find(...) ?? null`. This is safe and intentional per the plan (RLS + the existing `.eq("user_id", …)` clause make a foreign/invalid id return an empty set, not a leak — confirmed by the integration cross-user test). The only observable asymmetry: an invalid id via SSR renders the **full** list (treated as "no filter"), while the same invalid id hit directly on the API returns an **empty** list. Harmless in the actual flow because the client's `refresh()` only ever sends `categoryFilter.id`, which was already server-validated. Noted for defense-in-depth awareness, not as a required change.
- **Fix**: None required. If future callers hit the API with unvalidated ids and the empty-vs-full distinction matters, resolve the id in the route as the SSR path does.
- **Decision**: FIXED — resolved `?category=` against the user's categories in the GET route (unrecognized id → full list, mirroring SSR). Tradeoff accepted: one extra `listCategories` query on filtered GETs (the plan had avoided it). Verified: astro check 0 errors, unit 40/40, drilldown e2e green.
