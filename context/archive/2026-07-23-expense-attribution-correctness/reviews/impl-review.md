<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Expense Attribution Correctness

- **Plan**: context/changes/expense-attribution-correctness/plan.md
- **Scope**: Phase 1 of 1 (full plan)
- **Date**: 2026-07-23
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

### F1 — Integration suite shows the known transient JWT-clock-skew flake (already accepted)

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; nothing to fix, already an accepted rule
- **Dimension**: Success Criteria
- **Location**: `tests/integration/supabase-client.ts:26` (`signUpTestUser`, no retry)
- **Detail**: During review verification, `npm run test:integration` failed once with `Unknown Error: JWT issued at future` in `cross-user-isolation.test.ts` (unrelated to this phase's new file, all 7 of its tests skipped as a result), then passed cleanly on immediate retry (9/9). This reproduces exactly the no-retry/no-backoff characteristic of `signUpTestUser` already documented in `context/foundation/lessons.md` and `ACCEPTED-AS-RULE` in Phase 1's own impl-review. The new `expense-category-validation.test.ts` inherits this same accepted characteristic by design — `plan.md`'s References section explicitly calls this out.
- **Fix**: None needed — already an accepted rule, not a new defect. Recorded as observed evidence for the audit trail.
- **Decision**: ACCEPTED-AS-RULE (pre-existing, see `context/foundation/lessons.md`)

### F2 — New integration test has no in-file positive control

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `tests/integration/expense-category-validation.test.ts:31-39`
- **Detail**: The single test only asserts the rejection path (foreign `categoryId` → `CategoryOwnershipError`). A hypothetical regression where `createExpense` threw `CategoryOwnershipError` unconditionally would still pass this test — there's no in-file positive control (e.g., a same-user category succeeding). This is mitigated today: the plan's manual Progress item 1.4 (break the assertion, confirm it fails, restore) was performed and confirmed by the user, and same-user category creation is already exercised elsewhere (unit tests, `cross-user-isolation.test.ts`'s `beforeAll`, the e2e happy-path spec).
- **Fix**: Optional — add a companion assertion in this file that a same-user category succeeds, for a self-contained non-vacuous proof that doesn't depend on the one-time manual check. Given existing coverage elsewhere and the cost×signal principle, not required now.
- **Decision**: ACCEPTED (existing coverage + manual verification already mitigate this)

## Additional notes (not findings)

- Both sub-agents independently confirmed all three planned changes MATCH their contracts exactly: the two unit test cases in `src/lib/services/expenses.test.ts:109-117`, the new `tests/integration/expense-category-validation.test.ts` (full file, follows `cross-user-isolation.test.ts`'s pattern precisely — same imports, `TestUser` interface, `beforeAll` shape, `todayIsoDate()` duplication convention), and the `test-plan.md` update (§3 Phase 2 → `complete`, §2 Risk #3 closure note added).
- No scope creep: `git show --stat` on both commits (`0136318`, `b3aafa5`) confirms only the three planned files plus the change's own lifecycle docs were touched. `tests/e2e/`, `playwright.config.ts`, and `tests/e2e/helpers.ts` were untouched, consistent with the plan's "What We're NOT Doing" (no e2e timezone test, no new e2e helper, no HTTP-level test harness).
- Automated success criteria re-verified at review time: `npm run test:unit` (19/19 passed), `npm run test:integration` (9/9 passed on retry after the transient flake in F1), `npm run lint` (exit 0, confirmed during implementation).
- Manual Progress items 1.4 and 1.5 were confirmed by the user in the conversation ("manual testing completed") before the phase-end commit ritual ran — not rubber-stamped.
