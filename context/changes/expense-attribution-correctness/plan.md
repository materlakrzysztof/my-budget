# Expense Attribution Correctness — Implementation Plan

## Overview

Close out Phase 2 of `context/foundation/test-plan.md` by covering the one
genuine, currently-untested gap behind Risk #4 (an expense is saved under the
wrong category): the `categoryId` rejection paths on expense creation — a
missing/empty value (400, zod) and a syntactically valid but foreign or
nonexistent value (409, `CategoryOwnershipError` via a composite DB FK). Both
behaviors are already implemented and shipped; neither has ever been
exercised by a test. Risk #3 (month attribution) gets no new tests in this
phase — see "What We're NOT Doing."

## Current State Analysis

`context/changes/expense-attribution-correctness/research.md` (2026-07-23)
already re-grounded this against shipped code. Key facts it and this
planning session's follow-up investigation established:

- `createExpenseSchema` (`src/lib/services/expenses.ts:28-34`) requires
  `categoryId: z.uuid()`. This schema is only ever invoked at the HTTP
  boundary, inside the `POST /api/expenses` route handler
  (`src/pages/api/expenses.ts:43-47`) via `createExpenseSchema.safeParse(body)`.
- The service-layer `createExpense()` function (`src/lib/services/expenses.ts:118-132`)
  does **not** run this schema itself — it accepts an already-typed
  `CreateExpenseRequest` and inserts it directly. It only throws
  `CategoryOwnershipError` when the DB's composite FK
  (`expenses_user_category_fk (user_id, category_id) → categories(user_id, id)`,
  `supabase/migrations/20260722090000_create_expenses.sql:10`) rejects the
  insert with Postgres error code `23503` (`mapWriteError`,
  `src/lib/services/expenses.ts:94-104`).
- The existing integration-test harness
  (`vitest.integration.config.ts:1-15`) never starts an HTTP server or hits
  an Astro API route — every existing integration test
  (`tests/integration/cross-user-isolation.test.ts`) imports service-layer
  functions (`createExpense`, `listCategories`, `getMonthlySummary`) and
  calls them directly against a real Supabase client from `signUpTestUser()`
  (`tests/integration/supabase-client.ts:11-39`).
- **Consequence**: the 400/zod path (missing/empty `categoryId`) is
  structurally unreachable through this integration harness — it can only be
  exercised where the schema actually runs, which is a pure function with no
  I/O. The 409/FK path, by contrast, fits the existing integration pattern
  exactly, since `mapWriteError` lives inside `createExpense()` itself,
  independent of any HTTP layer.
- `src/lib/services/expenses.test.ts:57-108` already unit-tests
  `createExpenseSchema` for `amount`/`date` edge cases, using one hardcoded
  `validCategoryId` throughout (`:58`) — no case varies `categoryId` at all.
- `context/foundation/test-plan.md` §3 Phase 2 currently reads `researched`
  with the change folder linked; §4's Playwright spec count was corrected to
  11 earlier in this change's research. The Risk Response Guidance table's
  Risk #3 row (§2) does not yet reflect this session's decision that
  "correct inclusion in a past month" has no product surface to test through
  (see below) — that update is part of this plan's scope.

## Desired End State

- `src/lib/services/expenses.test.ts` has explicit `categoryId` cases
  (missing key, empty string) proving `createExpenseSchema` rejects them,
  alongside the existing amount/date cases.
- A new `tests/integration/expense-category-validation.test.ts` proves, with
  two real signed-up users against the real E2E Supabase project, that
  attempting to create an expense under a category that genuinely belongs to
  a different user throws `CategoryOwnershipError`.
- `context/foundation/test-plan.md` §3 Phase 2 status reads `complete`, and
  §2's Risk #3 row documents why this phase adds no test for "correct
  inclusion in a past month."
- Verify: `npm run test:unit` and `npm run test:integration` both pass
  locally; `git diff` shows only the three files above touched.

### Key Discoveries:

- `src/pages/api/expenses.ts:43-47` — the only call site of
  `createExpenseSchema.safeParse`, confirming the 400 path is HTTP-boundary-only.
- `src/lib/services/expenses.ts:94-104` (`mapWriteError`) — confirms the 409
  path is reachable from a direct service-layer call, no HTTP needed.
- `tests/integration/supabase-client.ts:11-39` (`signUpTestUser`) — reused
  as-is; no changes needed to this helper.
- `context/foundation/lessons.md` — documents that `signUpTestUser` has no
  retry/backoff around transient network failures, accepted as-is; this
  plan's new integration test inherits that same known characteristic by
  reusing the helper unchanged.

## What We're NOT Doing

- **No e2e test for "correct inclusion in a past month" (Risk #3).** The
  monthly-summary API (`src/pages/api/expenses/summary.ts:22` →
  `getMonthlySummary(supabase, userId)`, `src/lib/services/expenses.ts:187-192`)
  never accepts a month/`referenceDate` parameter — it always resolves to the
  current month. The UI has no mechanism to view a past month's summary at
  all. There is no product surface through which a user (or an e2e test
  driving the UI) could observe whether a backdated expense lands in its
  *own* past month, only that it's excluded from the *current* one — which
  `tests/e2e/expenses-backdated-attribution.spec.ts` already proves. Adding a
  test for this would mean querying the `monthly_category_summary` view
  directly, which tests nothing beyond what Phase 1's summary-reconciliation
  integration coverage already establishes about that view's correctness.
  This is a documented scope decision, not a gap.
- **No Playwright `timezoneId` / local-midnight boundary test.** The app has
  no timezone-differentiating logic anywhere (every "today" computation is
  UTC-based, `todayIsoDate()` in both `ExpenseFormDialog.tsx` and
  `expenses.ts`) — a browser-level timezone simulation would not exercise any
  code path that could actually diverge.
- **No new expense-creation e2e test helper.** `tests/e2e/helpers.ts` keeps
  its current inline-boilerplate pattern; this phase doesn't add any new e2e
  specs, so there's no growing duplication to justify the refactor here.
- **No HTTP-level test harness for API routes.** Adding one solely to
  integration-test a single zod rejection would be disproportionate; the
  pure-function unit test on `createExpenseSchema` gives the same signal at
  far lower cost.

## Implementation Approach

Two small, independent test additions plus one documentation update, all in
a single phase given the small scope:

1. Extend the existing `createExpenseSchema` unit-test block with
   `categoryId`-focused cases (cheapest layer, matches where the 400
   behavior actually lives).
2. Add one new integration test file following Phase 1's exact
   two-real-users pattern, proving the 409/FK path with a genuinely foreign
   category.
3. Update `test-plan.md` to reflect both this phase's completion and the
   Risk #3 scope decision, so a future reader doesn't rediscover the same
   "no product surface" investigation.

## Phase 1: Category attachment validation coverage

### Overview

Add the missing unit and integration coverage for Risk #4's two rejection
paths, and close out Phase 2 in the test-plan documentation.

### Changes Required:

#### 1. Unit test — missing/empty `categoryId`

**File**: `src/lib/services/expenses.test.ts`

**Intent**: Add cases to the existing `describe("createExpenseSchema", ...)`
block proving the schema rejects a request with no `categoryId` key and one
with `categoryId: ""`, alongside the existing amount/date cases in the same
block.

**Contract**: Two new `it(...)` blocks calling
`createExpenseSchema.safeParse(...)` with (a) the `categoryId` key omitted
entirely and (b) `categoryId: ""`, each asserting `result.success` is
`false`. Reuse the existing `validCategoryId`/`todayIso()` fixtures already
in the file for the other required fields.

#### 2. Integration test — foreign category rejection

**File**: `tests/integration/expense-category-validation.test.ts` (new)

**Intent**: Prove that `createExpense()` rejects an attempt to attach an
expense to a category genuinely owned by a different real user, throwing
`CategoryOwnershipError` — the one Risk #4 path with zero coverage today.

**Contract**: Follow `tests/integration/cross-user-isolation.test.ts`'s
existing shape exactly: `signUpTestUser("integration-category-validation-a")`
and `-b"` in a `beforeAll`, fetch user B's own category via
`listCategories(userB.supabase, userB.userId)`, then call
`createExpense(userA.supabase, userA.userId, { categoryId: <B's category
id>, amount: "10.00", date: todayIsoDate() })` and assert it rejects with an
error whose `name` is `"CategoryOwnershipError"` (import `CategoryOwnershipError`
from `@/lib/services/expenses` and assert via
`expect(promise).rejects.toBeInstanceOf(CategoryOwnershipError)` or
equivalent). Import `createExpense`, `listCategories`, and
`CategoryOwnershipError`; define a local `todayIsoDate()` helper matching the
one already duplicated in `cross-user-isolation.test.ts`.

#### 3. Test-plan documentation update

**File**: `context/foundation/test-plan.md`

**Intent**: Mark Phase 2 complete and record the Risk #3 scope decision so
it isn't rediscovered later.

**Contract**: In §3's Phase 2 row, change `Status` from `researched` to
`complete`. In §2's Risk Response Guidance table, append one sentence to the
Risk #3 "Must challenge" or a new note under the table clarifying: the
monthly-summary API/UI never expose a past month, so "correctly included in
its own past month" has no product surface to test through beyond what the
existing e2e exclusion test and Phase 1's summary-view integration coverage
already establish — deliberately out of scope, not a gap.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm run test:unit`
- Integration tests pass: `npm run test:integration`
- Lint passes: `npm run lint`

#### Manual Verification:

- Confirm the new integration test actually fails if `CategoryOwnershipError`
  is not thrown (e.g., temporarily point it at user A's own category and
  confirm the test now fails) — same "break it to prove it's non-vacuous"
  check Phase 1 used, then restore.
- Confirm `test-plan.md`'s Phase 2 row and Risk #3 note read correctly
  end-to-end.

---

## Testing Strategy

### Unit Tests:

- `categoryId` missing key → schema rejects
- `categoryId: ""` → schema rejects

### Integration Tests:

- User A attempts to create an expense with user B's real, existing
  category id → `CategoryOwnershipError`

### Manual Testing Steps:

1. Run `npm run test:unit` and `npm run test:integration` locally; confirm
   both suites pass in full, not just the new cases.
2. Temporarily break the new integration test's assertion (point it at a
   valid same-user category instead of the foreign one) to confirm it can
   actually fail, then restore it.

## Migration Notes

None — no schema or data changes, test-only additions plus a documentation
edit.

## References

- Research: `context/changes/expense-attribution-correctness/research.md`
- Prior integration-test pattern: `tests/integration/cross-user-isolation.test.ts:30-155`
- Prior test-helper: `tests/integration/supabase-client.ts:11-39`
- Prior unit-test block: `src/lib/services/expenses.test.ts:57-108`
- Lesson on `signUpTestUser`'s known no-retry characteristic: `context/foundation/lessons.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Category attachment validation coverage

#### Automated

- [x] 1.1 Unit tests pass: `npm run test:unit` — 0136318
- [x] 1.2 Integration tests pass: `npm run test:integration` — 0136318
- [x] 1.3 Lint passes: `npm run lint` — 0136318

#### Manual

- [x] 1.4 New integration test confirmed non-vacuous (break/restore check) — 0136318
- [x] 1.5 `test-plan.md` Phase 2 row and Risk #3 note confirmed correct — 0136318
