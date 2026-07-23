# Testing Data Isolation & Summary Reconciliation — Implementation Plan

## Overview

Bootstrap a Vitest-based integration-test layer and use it to prove, with two
real signed-up Supabase users, the two guardrails Phase 1 of
`context/foundation/test-plan.md` exists to protect: that one user's
categories/expenses are never readable or mutable by another user (Risk #1),
and that the monthly summary view never leaks another user's totals (the
remaining, narrower slice of Risk #2). Separately, close a pre-existing gap
this change's own research surfaced: CI currently runs zero test commands of
any kind — wire the existing, already-passing unit suite in alongside lint
and build.

## Current State Analysis

Categories and expenses (schema, RLS, service layer, UI, and 9 Playwright
specs) all shipped since this change's original 2026-07-21 research, which is
now fully superseded by `context/changes/testing-data-isolation-summary/research.md`
(2026-07-23). That re-grounding found:

- RLS policies exist and are scoped correctly (`auth.uid() = user_id` on
  every policy); no service-role key exists anywhere in the codebase — one
  client factory (`src/lib/supabase.ts`), anon key only.
- Every API route derives the acting user from the session
  (`src/middleware.ts:6-13` → `context.locals.user`), never from client
  input — good defense-in-depth, but it also means **the app's own routes
  can never be used to exercise a genuine RLS gap**; proving RLS requires
  bypassing the app and querying Supabase directly as a second real user.
- The monthly summary total is not app code — it's a Postgres view
  (`monthly_category_summary`, `supabase/migrations/20260722090000_create_expenses.sql:29-37`)
  with `security_invoker = true`, so RLS still applies when reading through
  it. The multi-entry SUM-reconciliation gap the original test-plan worried
  about is already closed, oracle-free, by
  `tests/e2e/expenses-delete-updates-summary.spec.ts:19-30`. The one thing
  genuinely unproven is whether the view excludes **another user's**
  expenses — a Risk #1-shaped gap wearing a Risk #2 label.
- No integration-test layer exists today. Vitest
  (`vitest.config.ts:6`) only runs pure-function unit tests
  (`src/**/*.test.ts`, no I/O). Playwright only ever signs in as one user per
  spec (`tests/e2e/helpers.ts:64-80`, `signUpAndSignIn`). Nothing signs in as
  two real, distinct users and queries Supabase directly.
- `.github/workflows/ci.yml` runs `npm run lint` and `npm run build` only —
  no test step of any kind, despite `npm run test:unit` already existing and
  passing.
- The dedicated E2E Supabase project (`.dev.vars.e2e`, gitignored, same
  project `npm run dev:e2e` and Playwright already point at) has
  `mailer_autoconfirm: true` (confirmed in
  `context/archive/2026-07-21-account-signin-signout/plan.md:241`), so a
  direct `supabase-js` `signUp()` against it returns an active session
  immediately — no UI or email-confirmation step needed to get a second real
  authenticated session.

## Desired End State

A `tests/integration/` suite, runnable locally via `npm run test:integration`
against the real E2E Supabase project, proves cross-user isolation on
categories and expenses and summary-view exclusion using two real signed-up
users and raw (non-app-layer) Postgrest queries. `npm run test:unit` runs in
CI on every push/PR to `master`, alongside the existing lint and build steps.

Verify by running `npm run test:integration` locally (requires
`.dev.vars.e2e`) and confirming all assertions pass, and by inspecting a CI
run to confirm the new `test:unit` step executes and passes.

### Key Discoveries:

- `supabase/migrations/20260722090000_create_expenses.sql:13-25` — expenses
  RLS covers all 4 operations, each scoped by `auth.uid() = user_id`, with
  both `using` and `with check` on `update`.
- `supabase/migrations/20260721120000_create_categories.sql:9-17` —
  categories RLS covers only `select`/`insert`; no `update`/`delete` policy
  exists, matching that no such route exists today.
- `src/lib/services/expenses.ts:143-144,158-159` — `updateExpense`/
  `deleteExpense` add their own `.eq("user_id", userId)` filter on top of
  RLS. Calling these service functions as the attacker would only prove the
  app's own filter works, not RLS — the integration suite's attacker actions
  must query Postgrest directly instead (see Critical Implementation
  Details below).
- `tests/e2e/helpers.ts:64-80` — existing convention for unique-per-test
  users (no cleanup, accepted growth in the E2E project); the new suite
  follows the same convention rather than inventing a cleanup mechanism.

## What We're NOT Doing

- Not adding `update`/`delete` RLS policies to `categories` — no route
  exercises them today, and adding unused policies with nothing to verify
  them against is out of scope for a testing-focused change. Flagged as a
  forward note: add them when a category-edit/delete feature ships.
- Not wiring the new `test:integration` suite into CI in this phase — doing
  so requires provisioning new GitHub repo secrets for the E2E project,
  which is deliberately deferred as a named follow-up rather than bundled
  into the change that first establishes this test layer.
- Not adding an app/UI-level (Playwright) two-session negative test. Per
  research, the app's routes always derive `userId` from the session, so an
  app-level test can't exercise a genuine RLS gap — the DB-level integration
  test is the cheapest layer that gives real signal for Risk #1/#2.
- Not building a service-role/admin-based cleanup mechanism for the test
  users this suite creates in the E2E Supabase project. No service-role key
  exists anywhere in this codebase by design; accumulation is accepted,
  matching the convention the 9 existing Playwright specs already establish.
- Not addressing Risks #3 (backdated expense month attribution), #4 (wrong
  category), or #5 (migration/deploy safety) — those are `test-plan.md`
  Phases 2 and 3, separate rollout phases.

## Implementation Approach

Two real users are signed up directly against the E2E Supabase project via
`@supabase/supabase-js` (bypassing the Astro app entirely), each producing an
authenticated client. Legitimate setup actions (seeding categories, creating
expenses) reuse the actual service-layer functions from
`src/lib/services/`, so the suite exercises real production code paths for
the "victim" side. Attacker actions deliberately do **not** go through the
service layer — they issue raw Postgrest queries as the second user against
the first user's known record IDs, because only a raw query can prove the
*database* denies access independent of the app's own `.eq("user_id", ...)`
filtering. The same two users are reused across the whole suite via a shared
`beforeAll` fixture, minimizing Auth API calls.

## Critical Implementation Details

**Attacker queries must bypass the service layer, not just use it with the
attacker's own ID.** `updateExpense`/`deleteExpense`
(`src/lib/services/expenses.ts:143-144,158-159`) already filter
`.eq("user_id", userId)` before touching a row. If the integration test calls
these functions as user B targeting user A's expense ID, the app-level filter
alone will produce a "not found" result — the test would pass even if the
underlying RLS policy were broken or missing, because it never reached the
database's own enforcement. The attacker's `select`/`insert`/`update`/`delete`
calls in this suite must be raw `supabase.from(...)` calls with **no**
`user_id` filter, so a passing test is actually evidence RLS did the
blocking.

## Phase 1: Integration Test Infrastructure

### Overview

Stand up the new Vitest project, its credential loader, and the npm script,
verified with a minimal connectivity check — before any real assertions are
written.

### Changes Required:

#### 1. Vitest config for the new suite

**File**: `vitest.integration.config.ts` (new, repo root, sibling of the
existing `vitest.config.ts`)

**Intent**: A second, independent Vitest config so the fast, network-free
`npm run test:unit` run is completely unaffected — no new env-var
requirement is introduced for the default developer/CI unit run.

**Contract**: Mirrors `vitest.config.ts`'s shape (same `@` alias resolution)
but with `test.include: ["tests/integration/**/*.test.ts"]` and a
`setupFiles` entry pointing at the new env loader (below). Set a longer
`testTimeout` than the unit config's default — these tests make real network
calls to Supabase Auth and Postgrest.

#### 2. Credential loader for `.dev.vars.e2e`

**File**: `tests/integration/env.ts` (new)

**Intent**: Load `SUPABASE_URL`/`SUPABASE_KEY` from `.dev.vars.e2e` into
`process.env` before any integration test file runs, and fail fast with a
clear message if the file or values are missing — this suite is meaningless
without a real Supabase connection, so silently skipping is worse than a
loud, early error.

**Contract**: A minimal `KEY=VALUE` line parser, intentionally duplicated
from (not imported from) `astro.config.mjs`'s `parseDevVars` — importing an
Astro config module into a Vitest setup file would pull in Astro/Vite
integration-setup side effects that have nothing to do with loading two
env vars. Runs as a `setupFiles` entry in `vitest.integration.config.ts`, so
it executes once before the suite, not per-test.

#### 3. Test-user signup helper

**File**: `tests/integration/supabase-client.ts` (new)

**Intent**: Give each test a fresh, real, authenticated Supabase session
with minimal boilerplate — one function that signs up a uniquely-named user
directly via `@supabase/supabase-js` (not through the Astro app or
Playwright) and returns both the client and the resulting `user.id`.

**Contract**: Exports something like `signUpTestUser(prefix: string): Promise<{ supabase: SupabaseClient; userId: string }>`.
Instantiates the client with `auth: { persistSession: false, autoRefreshToken: false }`
(no browser storage exists in the Vitest/Node process). Asserts
`data.session` is non-null immediately after `signUp` — per Key Discoveries,
the E2E project has `mailer_autoconfirm: true`, so a null session here means
the project's auth settings changed and the whole suite's premise is
invalid; fail loudly rather than silently falling back to a separate
sign-in step. Follows `tests/e2e/helpers.ts`'s existing convention of a
timestamp-suffixed unique email per call, so parallel/repeated runs don't
collide and no cleanup step is required.

#### 4. npm script + trivial connectivity test

**File**: `package.json`

**Intent**: A discoverable, documented way to run this suite, matching the
existing `test:unit`/`test:e2e` naming convention.

**Contract**: Add `"test:integration": "vitest run --config vitest.integration.config.ts"`.

**File**: `tests/integration/connectivity.test.ts` (new)

**Intent**: Prove the whole chain — env loading, client construction,
network reachability — works before Phase 2 builds real assertions on top
of it, so a Phase 2 test failure can't be confused with a Phase 1 wiring
bug.

**Contract**: One test that calls `signUpTestUser` once and asserts a
`userId` (a UUID) comes back.

### Success Criteria:

#### Automated Verification:

- `npm run test:integration` runs and the connectivity test passes (requires
  local `.dev.vars.e2e`)
- `npm run test:unit` still passes, unaffected by the new config file
- `npm run lint` passes on all new files

#### Manual Verification:

- Run `npm run test:integration` locally against the real E2E Supabase
  project and confirm it connects and passes with no flakiness across a
  couple of repeated runs
- Confirm `.dev.vars.e2e` values are never printed or logged by the new env
  loader (only presence/absence, not the values, should appear in any error
  message)

---

## Phase 2: Cross-User Isolation & Summary Exclusion Suite

### Overview

The core deliverable: one test file, two real users, proving categories and
expenses cross-user isolation and monthly-summary exclusion at the database
level.

### Changes Required:

#### 1. The isolation suite

**File**: `tests/integration/cross-user-isolation.test.ts` (new)

**Intent**: Prove, with real data and real RLS in effect, that user B can
never read, insert-as, update, or delete user A's rows, and that the
monthly summary view never surfaces user A's totals to user B — covering
Risk #1 in full and the remaining slice of Risk #2.

**Contract**: A single `describe` block with a shared `beforeAll` signing up
two users (A, B) via `signUpTestUser`. Covers, per Key Discoveries and
Critical Implementation Details above:

- **Categories** (select/insert only, matching the policies that exist):
  seed A's categories via the real `listCategories` service call; as B,
  raw-select a specific category ID belonging to A → expect an empty
  result, no error; as B, raw-insert a category row with `user_id` forged to
  A's ID → expect the insert to be rejected by the `with check` policy.
- **Expenses** (all 4 operations): create one expense for A via the real
  `createExpense` service call, capturing its ID; as B, raw-select that ID
  (no `user_id` filter) → expect empty; as B, raw-insert an expense with
  `user_id` forged to A's ID → expect rejection; as B, raw-update that
  expense ID (no `user_id` filter) → expect zero rows affected, then
  re-fetch as A to confirm the amount is unchanged; as B, raw-delete that
  expense ID (no `user_id` filter) → expect zero rows deleted, then
  re-fetch as A to confirm it still exists.
- **Summary exclusion**: after A has at least one expense, call the real
  `getMonthlySummary` service function as A twice — once before and once
  after B independently creates several expenses of their own — asserting
  A's totals are unchanged; additionally, as B, raw-query
  `monthly_category_summary` filtered to A's `user_id` → expect an empty
  result, proving the view's `security_invoker = true` RLS scoping holds
  even when queried directly.

### Success Criteria:

#### Automated Verification:

- `npm run test:integration` passes, including every assertion listed above
- `npm run lint` passes

#### Manual Verification:

- Prove the suite isn't vacuous: temporarily comment out one RLS policy
  (e.g. `expenses_update_own`) via the Supabase dashboard SQL editor against
  the E2E project, re-run `npm run test:integration`, confirm the
  corresponding assertion fails, then restore the policy and confirm the
  suite passes again
- Confirm the run doesn't affect or require any state from the local dev
  Supabase project (`.dev.vars`) — only the E2E project (`.dev.vars.e2e`) is
  touched

**Implementation Note**: After completing this phase and all automated
verification passes, pause here for manual confirmation from the human that
the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Wire Existing Unit Tests into CI

### Overview

Close the gap this change's research flagged: CI runs lint and build but no
tests at all, despite a passing unit suite already existing.

### Changes Required:

#### 1. CI workflow

**File**: `.github/workflows/ci.yml`

**Intent**: Run the existing, already-passing unit suite on every push/PR to
`master`, alongside the existing lint and build steps.

**Contract**: Add a `run: npm run test:unit` step after the existing
`npm run lint` step and before `npm run build` (fail fast on logic
regressions before spending time on a build). No new secrets are needed —
the unit suite (`src/**/*.test.ts`) does no I/O.

### Success Criteria:

#### Automated Verification:

- `npm run test:unit` passes locally (already true; re-verified here as the
  exact command CI will run)
- CI workflow YAML is valid (a pushed commit or opened PR triggers the
  workflow without a syntax error)

#### Manual Verification:

- Open the Actions tab for a push/PR that includes this change and confirm
  the new `test:unit` step appears, runs, and passes

---

## Testing Strategy

### Unit Tests:

- No changes to existing unit tests (`src/lib/services/*.test.ts`); Phase 3
  only wires the existing suite into CI.

### Integration Tests:

- Phase 1: connectivity smoke test.
- Phase 2: full cross-user isolation (categories select/insert, expenses
  select/insert/update/delete) and summary-exclusion coverage, as detailed
  above.

### Manual Testing Steps:

1. Run `npm run test:integration` locally with `.dev.vars.e2e` present;
   confirm all tests pass.
2. Temporarily break one RLS policy in the E2E project and confirm the
   corresponding test fails (Phase 2 manual verification) — this is the
   proof the suite gives real signal rather than passing vacuously.
3. Open a PR including this change's CI workflow update and confirm
   `test:unit` runs and passes in the Actions UI (Phase 3 manual
   verification).

## Performance Considerations

Each integration test run signs up 2 new Auth users against the E2E
project — cheap in absolute terms (well under Supabase's default rate
limits) but not free; the shared `beforeAll` fixture keeps this to exactly 2
signups per file run rather than per-test, matching the cost-minimization
already implicit in `tests/e2e/helpers.ts`'s per-spec (not per-assertion)
signup pattern.

## Migration Notes

No schema or data migration in this change — RLS policies are read, not
modified (per the "What We're NOT Doing" decision to leave categories'
missing update/delete policies untouched).

## References

- Related research: `context/changes/testing-data-isolation-summary/research.md`
- Risk register: `context/foundation/test-plan.md:43-63`
- `mailer_autoconfirm` confirmation: `context/archive/2026-07-21-account-signin-signout/plan.md:241`
- Existing signup convention: `tests/e2e/helpers.ts:64-80`
- Existing oracle-free multi-entry summary proof: `tests/e2e/expenses-delete-updates-summary.spec.ts:19-30`
- RLS policies: `supabase/migrations/20260721120000_create_categories.sql:9-17`, `supabase/migrations/20260722090000_create_expenses.sql:13-25`
- Summary view: `supabase/migrations/20260722090000_create_expenses.sql:29-37`
- Service layer: `src/lib/services/categories.ts`, `src/lib/services/expenses.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Integration Test Infrastructure

#### Automated

- [x] 1.1 `npm run test:integration` runs and the connectivity test passes
- [x] 1.2 `npm run test:unit` still passes, unaffected
- [x] 1.3 `npm run lint` passes on all new files

#### Manual

- [ ] 1.4 `npm run test:integration` runs reliably against the real E2E project across repeated runs
- [ ] 1.5 Env loader never prints/logs actual credential values

### Phase 2: Cross-User Isolation & Summary Exclusion Suite

#### Automated

- [ ] 2.1 `npm run test:integration` passes, including all isolation and summary-exclusion assertions
- [ ] 2.2 `npm run lint` passes

#### Manual

- [ ] 2.3 Temporarily breaking an RLS policy causes the corresponding assertion to fail (proves the suite isn't vacuous)
- [ ] 2.4 Run doesn't touch or require the local dev Supabase project

### Phase 3: Wire Existing Unit Tests into CI

#### Automated

- [ ] 3.1 `npm run test:unit` passes locally
- [ ] 3.2 CI workflow YAML triggers without a syntax error

#### Manual

- [ ] 3.3 Actions tab shows the new `test:unit` step running and passing on a push/PR
