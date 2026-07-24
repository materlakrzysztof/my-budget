# Migration & Deploy Safety Net Implementation Plan

## Overview

This is Phase 3 of `context/foundation/test-plan.md`'s rollout, closing Risk
#5: "A migration or deploy that passes in dev/staging corrupts or silently
omits data in production." It adds a CI-level gate that applies every
migration in `supabase/migrations/` to a fresh, throwaway Postgres instance
on every PR, then asserts the resulting schema actually has the shape the
app depends on (RLS enabled, expected policies, expected constraints) —
closing the specific gap named in `roadmap.md`: "CI runs lint+build only, no
DB-related gate."

## Current State Analysis

- `.github/workflows/ci.yml` runs `lint` → `test:unit` → `build` on every
  push/PR to `main`. No step ever applies a migration or touches a database.
- Two migrations exist: `supabase/migrations/20260721120000_create_categories.sql`
  and `20260722090000_create_expenses.sql`. Both enable RLS with granular
  per-operation policies (categories: select/insert only; expenses: all
  four). `expenses` adds a composite FK back to `categories` and a
  `monthly_category_summary` view (`security_invoker = true`).
- Deploy is manual only (`context/deployment/deploy-plan.md`), a one-time
  `wrangler deploy` from 2026-07-21 — done before the categories/expenses
  migrations existed. Auto-deploy-on-merge is explicitly parked in
  `roadmap.md` ("not required by any PRD FR"). There is no evidence the
  categories/expenses migrations were ever pushed to the production
  Supabase project.
- A separate, persistent "E2E" Supabase project (`.dev.vars.e2e`) already
  has these migrations applied and backs `tests/integration/` (Phase 1/2 of
  this rollout). Its CI wiring was deliberately deferred in Phase 1 to avoid
  provisioning new GitHub secrets for a live external project — that
  decision stands; this phase does not touch it.
- **Corrected during planning**: test-plan.md's Risk #5 wording cites
  "missing seed/reference data (e.g. default categories)" as a smoke-check
  target. That's not a real gap here — `src/lib/services/categories.ts:7-9,68`
  shows default categories are seeded lazily per-user at the app layer
  (`DEFAULT_CATEGORIES`, inserted on first read), not via
  `supabase/config.toml`'s `seed.sql` reference, which is unused vestigial
  config. There is no DB-level reference data for a deploy to omit. This
  plan does not add a seed-data check.
- No direct-Postgres client (`pg` or similar) exists in the codebase yet.
  The existing `tests/integration/` suite deliberately stays on anon-key
  `supabase-js` only (no service-role key anywhere, by design — see that
  phase's Open Risks). Asserting RLS/policy/constraint presence requires
  querying `pg_catalog`/`information_schema`, which PostgREST does not
  expose — this phase's suite needs a real Postgres connection, but only
  ever against the ephemeral local container this same job creates, never
  a hosted project, so it doesn't reopen that decision.

## Desired End State

Every PR against `main` runs a new `migration-safety` CI job, in parallel
with the existing `ci` job, that:

1. Boots a fresh, local, throwaway Postgres via the already-installed
   `supabase` CLI and applies every file in `supabase/migrations/` from
   scratch — a broken migration fails this job before it can reach `main`.
2. Runs a new Vitest suite that connects directly to that ephemeral
   Postgres and asserts RLS is enabled and the expected policies/constraints
   exist on `categories` and `expenses`.

The job is a required status check on `main` — a broken or shape-altering
migration cannot merge.

### Key Discoveries:

- `supabase` CLI is already a `devDependency` (`package.json:60`) — no new
  install needed to run it in CI.
- GitHub-hosted `ubuntu-latest` runners have Docker preinstalled, which is
  all `supabase start` needs — no new GitHub Actions marketplace action
  required.
- `supabase/config.toml:27-29` fixes the local DB port at `54322`, and the
  local stack's Postgres credentials are the CLI's well-known fixed default
  (`postgres`/`postgres`) — a stable, undocumented-elsewhere-in-this-repo
  fact the implementer needs to connect the new test suite.
- The exact flag name/values for excluding non-Postgres containers from
  `supabase start` (to keep the job fast) vary by CLI version — the
  implementer must confirm against `npx supabase start --help` for the
  installed `^2.23.4` rather than assume a specific flag spelling.

## What We're NOT Doing

- Not adding a DB-level seed/reference-data check — no such data exists
  (see Current State Analysis).
- Not building an automated post-deploy smoke check — deploy is manual with
  no CD to hook a check into; automating a check for a process that may
  change shape once CD exists is premature. This is a deliberate scope cut,
  not an oversight (test-plan.md Risk #5's "post-deploy data smoke" row
  stays unaddressed by this phase; revisit once/if CD is built).
- Not wiring the existing `tests/integration/` suite into this new job or
  into CI generally — that suite targets the persistent E2E project, is a
  different concern (business-logic/RLS-via-the-app-session proof, already
  covered by Phase 1), and wiring it was already deferred by that phase's
  own decision.
- Not touching the production Supabase project directly (no dry-run against
  a live/hosted project, no new secrets for one).
- Not adding RLS update/delete policies to `categories` — out of scope for
  this phase, matches Phase 1's existing decision to leave that as a
  forward note only.

## Implementation Approach

Two new pieces land in the same CI job: (1) the migration-apply step itself
(the `supabase` CLI already does this as a side effect of starting the
local stack), and (2) a Vitest suite making that apply's result provable,
not just "didn't error." Both run in a single new `migration-safety` job in
`.github/workflows/ci.yml`, parallel to the existing `ci` job so overall
wall-clock CI time isn't serialized. The suite follows the existing
`tests/integration/` convention (dedicated Vitest config, dedicated npm
script) rather than introducing a second test framework (e.g. pgTAP via
`supabase test db`) — one framework, matching test-plan.md's own
cost-vs-signal principle.

## Phase 1: Ephemeral migration-apply CI job

### Overview

Add a new parallel CI job that boots a throwaway local Postgres via the
`supabase` CLI and applies every migration from scratch on every PR,
proving the migration sequence itself applies cleanly before anything else
in this plan can be asserted against it.

### Changes Required:

#### 1. New CI job

**File**: `.github/workflows/ci.yml`

**Intent**: Add a `migration-safety` job alongside the existing `ci` job
(same `on:` triggers — push/PR to `main`) that checks out the repo, installs
Node 22 + deps, then boots the local Supabase stack so migrations apply
against a fresh database. The job's exit code is the migration-apply
signal — no custom error handling needed since the CLI already fails
non-zero on a bad migration.

**Contract**: A second top-level entry under `jobs:` (name: `migration-safety`),
running on `ubuntu-latest`, with steps mirroring the existing `ci` job's
checkout/setup-node/`npm ci`, then a step running the `supabase` CLI's start
command against `supabase/migrations/` (no `SUPABASE_URL`/`SUPABASE_KEY`
secrets needed — this never touches a hosted project). Exclude non-Postgres
containers (Studio, Realtime, Storage, Inbucket, Edge Runtime) if the
installed CLI version's `--exclude`/`-x` flag supports it, to keep the job
fast — confirm exact service names via `npx supabase start --help` before
finalizing the step.

### Success Criteria:

#### Automated Verification:

- Locally, `npx supabase stop --no-backup` then `npx supabase start` (or
  equivalent local boot command) completes with exit code 0 and reports
  both migrations applied
- `npm run lint` passes (workflow YAML syntax itself isn't linted by ESLint,
  but this catches any incidental TS/config drift from the change)

#### Manual Verification:

- Push a branch with this change; confirm the new `migration-safety` job
  appears in the GitHub Actions run and completes successfully
- Temporarily rename a column in a scratch copy of one migration file (not
  committed) and re-run locally to confirm the CLI actually fails non-zero
  on a broken migration, then discard the scratch edit

**Implementation Note**: After completing this phase and all automated
verification passes, pause here for manual confirmation from the human
that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Schema-shape assertion suite

### Overview

Add a Vitest suite that connects directly to the ephemeral local Postgres
Phase 1 boots and asserts the resulting schema has the exact shape the app
depends on — RLS enabled and the specific policies/constraints each table
needs — so a migration that applies without error but silently drops RLS
or a constraint is still caught.

### Changes Required:

#### 1. New dependency

**File**: `package.json`

**Intent**: Add a direct Postgres client so the suite can query
`pg_catalog`/`information_schema`, which PostgREST (and therefore
`supabase-js`) never exposes.

**Contract**: New `devDependencies` entries for `pg` and `@types/pg`
(current stable majors). New script `"test:schema-safety": "vitest run --config vitest.schema-safety.config.ts"`,
named to match the existing `test:unit`/`test:integration` convention.

#### 2. New Vitest config

**File**: `vitest.schema-safety.config.ts`

**Intent**: Mirror `vitest.integration.config.ts`'s shape (same `resolve.alias`
for `@/*`, same `testTimeout`) but point `include` at a new
`tests/schema-safety/**/*.test.ts` directory, kept separate from
`tests/integration/` since this suite targets the ephemeral local DB, not
the persistent E2E project.

**Contract**: Same structure as `vitest.integration.config.ts:1-15`, with
`include` and any `setupFiles` updated for the new directory.

#### 3. Postgres connection helper

**File**: `tests/schema-safety/db-client.ts`

**Intent**: Provide a single place that opens a `pg` connection to the
local ephemeral Postgres for the suite's tests to share.

**Contract**: Exports a function/client using the local stack's fixed
connection details (`127.0.0.1`, port `54322` per `supabase/config.toml:29`,
well-known local superuser credentials) — no `.dev.vars`/env file involved,
since this only ever targets the CI-local ephemeral container, never a
hosted project.

#### 4. Schema-shape assertions

**File**: `tests/schema-safety/schema-shape.test.ts`

**Intent**: Assert the specific, currently-true shape both migrations
establish, so a future migration that silently regresses one of these
facts fails this suite:
- RLS is enabled (`pg_class.relrowsecurity`) on `public.categories` and
  `public.expenses`
- Expected policies exist by name on each table (`pg_policies`):
  `categories_select_own`, `categories_insert_own`,
  `expenses_select_own`, `expenses_insert_own`, `expenses_update_own`,
  `expenses_delete_own`
- Expected constraints exist: `categories_user_id_normalized_name_key`
  (unique index), `categories_user_id_id_key` (unique constraint),
  `expenses_user_category_fk` (composite FK)
- `public.monthly_category_summary` view exists

**Contract**: A `describe`/`it` suite querying `pg_policies`,
`pg_class.relrowsecurity`, and `information_schema`/`pg_constraint` via the
Phase 2.3 helper, asserting presence (not full row-level behavior — that's
already `tests/integration/`'s job).

### Success Criteria:

#### Automated Verification:

- After `supabase start`/`db reset` locally, `npm run test:schema-safety`
  passes
- `npm run lint` passes on the new files

#### Manual Verification:

- Temporarily comment out `alter table public.expenses enable row level
  security;` in a local scratch copy (not committed), re-run `supabase db
  reset` + `npm run test:schema-safety`, confirm the suite fails — proving
  real detection power, not a vacuous pass — then revert
- Same check for one policy (e.g. comment out `expenses_delete_own`) and one
  constraint (e.g. `expenses_user_category_fk`)

**Implementation Note**: After completing this phase and all automated
verification passes, pause here for manual confirmation from the human
that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Wire into the job, enforce, and document

### Overview

Run the Phase 2 suite as the final step of the Phase 1 CI job, make the job
a required status check on `main`, and update `test-plan.md` to reflect
this phase's real scope and the two decisions that narrow it (no seed-data
check, no post-deploy check yet).

### Changes Required:

#### 1. Wire suite into the CI job

**File**: `.github/workflows/ci.yml`

**Intent**: Add `npm run test:schema-safety` as the final step of the
`migration-safety` job from Phase 1, after the local stack is up.

**Contract**: One additional step in the `migration-safety` job, no new
triggers or secrets.

#### 2. Update the test plan

**File**: `context/foundation/test-plan.md`

**Intent**: Reflect that Phase 3 shipped, what it actually covers, and the
two scope decisions made during planning — following the same
closure-note convention already used for Risk #3 (`test-plan.md:65-74`).

**Contract**:
- §3 Phased Rollout: Phase 3 row `Status` → `complete`
- §5 Quality Gates: the "migration dry-run" row's "Required after §3 Phase 3"
  becomes simply required/live
- §6.5 Cookbook: replace the "TBD" with the actual pattern (add a migration
  → run `supabase start`/`db reset` + `npm run test:schema-safety` locally →
  CI job replays both automatically on the PR)
- Add a "Risk #5 closure note" paragraph (same style as the existing Risk #3
  note) documenting: the gate's scope (apply-cleanly + schema-shape,
  ephemeral local target only), that no DB-level seed-data check was needed
  (default categories are app-seeded, not DB-seeded), and that the
  post-deploy smoke check is deliberately deferred pending CD

### Success Criteria:

#### Automated Verification:

- `npm run format` (Prettier) produces no diff on the updated
  `test-plan.md`

#### Manual Verification:

- Push a PR; confirm both `ci` and `migration-safety` show as checks on it
- In GitHub repo settings → Branches → branch protection rule for `main`,
  add `migration-safety` as a required status check (repo-admin action —
  confirm with the user before changing shared branch-protection settings;
  do not do this unilaterally)
- Re-read the updated `test-plan.md` §3/§5/§6.5 and the new Risk #5 closure
  note for accuracy against what actually shipped

**Implementation Note**: After completing this phase and all automated
verification passes, pause here for manual confirmation from the human
that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- N/A — this phase adds a schema/CI-level gate, not application logic.

### Integration Tests:

- Phase 2's `tests/schema-safety/schema-shape.test.ts` is itself the
  integration-level proof for this phase; see Phase 2 above.

### Manual Testing Steps:

1. Run `npx supabase start` locally, then `npm run test:schema-safety` —
   confirm green.
2. Break one RLS statement, one policy, and one constraint in scratch
   (uncommitted) copies, one at a time, confirming each breaks the suite,
   then revert.
3. Push a PR and confirm the new job runs and passes in GitHub Actions.

## Performance Considerations

`supabase start` involves Docker image pulls on a cold cache; excluding
unneeded containers (Phase 1) keeps this bounded. No further optimization
(e.g. Docker layer caching) is in scope for this phase — revisit only if
the job's wall-clock time becomes a problem in practice.

## Migration Notes

Not applicable — this phase adds a test/CI gate, not a data migration.

## References

- Test plan: `context/foundation/test-plan.md` (§2 Risk #5, §3 Phase 3 row)
- Prior rollout phases: `context/changes/testing-data-isolation-summary/`,
  `context/changes/expense-attribution-correctness/`
- Existing integration-test convention: `tests/integration/env.ts`,
  `vitest.integration.config.ts`
- Default-category implementation (source of the corrected scope decision):
  `src/lib/services/categories.ts:7-9,68`
- Deploy history: `context/deployment/deploy-plan.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a
> step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Ephemeral migration-apply CI job

#### Automated

- [x] 1.1 Local `supabase start` (or equivalent) completes with exit code 0 and reports both migrations applied — ac6e084
- [x] 1.2 `npm run lint` passes — ac6e084

#### Manual

- [x] 1.3 Push a branch; confirm the new `migration-safety` job appears and completes successfully in GitHub Actions
- [x] 1.4 Confirm a deliberately broken migration (scratch, uncommitted) fails the CLI non-zero, then revert

### Phase 2: Schema-shape assertion suite

#### Automated

- [x] 2.1 `npm run test:schema-safety` passes after `supabase start`/`db reset`
- [x] 2.2 `npm run lint` passes on the new files

#### Manual

- [x] 2.3 Confirm suite fails when RLS is temporarily disabled on `expenses` (scratch, uncommitted), then revert
- [x] 2.4 Confirm suite fails when a policy is temporarily removed (scratch, uncommitted), then revert
- [x] 2.5 Confirm suite fails when a constraint is temporarily removed (scratch, uncommitted), then revert

### Phase 3: Wire into the job, enforce, and document

#### Automated

- [ ] 3.1 `npm run format` produces no diff on the updated `test-plan.md`

#### Manual

- [ ] 3.2 Confirm both `ci` and `migration-safety` show as checks on a pushed PR
- [ ] 3.3 Add `migration-safety` as a required status check in GitHub branch protection for `main` (confirm with user first)
- [ ] 3.4 Re-read updated `test-plan.md` §3/§5/§6.5 and the new Risk #5 closure note for accuracy
