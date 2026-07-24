# Expense Attribution Correctness — Plan Brief

> Full plan: `context/changes/expense-attribution-correctness/plan.md`
> Research: `context/changes/expense-attribution-correctness/research.md`

## What & Why

Phase 2 of `context/foundation/test-plan.md` set out to lock in month/category
attribution correctness (Risks #3-#4). Research found both risks already had
partial, previously-untracked e2e coverage from the original feature build.
What's left is one real, currently-untested gap: `categoryId` rejection on
expense creation — missing/empty (400) and foreign/nonexistent (409) — both
implemented and shipped, neither ever tested.

## Starting Point

`createExpenseSchema` (`src/lib/services/expenses.ts:28-34`) requires a valid
`categoryId` UUID; this only runs inside the API route
(`src/pages/api/expenses.ts:43-47`), not inside the service-layer
`createExpense()` function. A composite DB foreign key
(`expenses_user_category_fk`) independently rejects a syntactically valid but
foreign category id, which `createExpense()` maps to `CategoryOwnershipError`.
Existing tests: one e2e spec each for backdated-date exclusion (Risk #3) and
2-category persistence (Risk #4) — both happy-path only.

## Desired End State

Two new test cases close the gap: a unit test proving the schema rejects a
missing/empty `categoryId`, and an integration test proving a real user can't
attach an expense to another real user's category. `test-plan.md` reflects
Phase 2 as complete and documents why Risk #3 gets no further test.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Timezone-boundary test for Risk #3 | Skip entirely | App has zero timezone-differentiating logic — nothing to actually diverge | Plan (user) |
| "Correct inclusion in past month" test for Risk #3 | Out of scope | Summary API/UI never expose a past month — no product surface to test through | Plan (user) |
| 400 (missing/empty categoryId) test layer | Unit test on `createExpenseSchema` | Zod validation only runs at the HTTP boundary, which the integration harness never exercises — a unit test is the only layer that can actually reach it | Plan (technical finding) |
| 409 (foreign categoryId) test layer | Integration test, real 2nd user | `CategoryOwnershipError` is thrown inside the service layer itself, reachable directly — matches Phase 1's existing pattern | Plan (user) |
| New e2e helper for expense creation | Skip | No new e2e specs added this phase; nothing to de-duplicate yet | Plan (user) |

## Scope

**In scope:**
- Unit test: `categoryId` missing/empty rejected by `createExpenseSchema`
- Integration test: cross-user category attachment rejected (`CategoryOwnershipError`)
- `test-plan.md` update: Phase 2 → complete, Risk #3 note on past-month scope decision

**Out of scope:**
- Any new e2e test or e2e helper
- Timezone/local-midnight boundary testing
- HTTP-level test harness for API routes

## Architecture / Approach

Reuse Phase 1's integration pattern exactly (`signUpTestUser`, two real users,
direct service-layer calls against the real E2E Supabase project, no HTTP
layer involved). The unit test extends the existing `createExpenseSchema`
test block in place — no new file needed there.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Category attachment validation coverage | Unit + integration tests for both `categoryId` rejection paths, plus test-plan doc update | Integration test could be vacuous if not verified against a real FK break — mitigated by a manual break/restore check, same as Phase 1 |

**Prerequisites:** E2E Supabase project + `.dev.vars.e2e` already configured (Phase 1 infra, unchanged).
**Estimated effort:** ~1 session, single phase.

## Open Risks & Assumptions

- None outstanding — all scope questions were resolved during planning (see Key Decisions above).

## Success Criteria (Summary)

- `npm run test:unit` and `npm run test:integration` both pass, including the two new cases
- The new integration test is confirmed non-vacuous via a manual break/restore check
- `test-plan.md` accurately reflects Phase 2's completion and the Risk #3 scope decision
