<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Testing Data Isolation & Summary Reconciliation

- **Plan**: context/changes/testing-data-isolation-summary/plan.md
- **Scope**: Phase 1, 2, 3 of 3 (full plan)
- **Date**: 2026-07-23
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 2 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | WARNING |
| Safety & Quality    | PASS    |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

## Findings

### F1 — Unplanned CI branch-trigger fix + doc updates

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; already resolved and approved in real time
- **Dimension**: Scope Discipline
- **Location**: `.github/workflows/ci.yml`, `CLAUDE.md`, `README.md`
- **Detail**: The plan's Phase 3 contract only asked to add a `npm run test:unit` step. During manual verification, a pre-existing bug surfaced: `ci.yml`'s `push`/`pull_request` triggers referenced a `master` branch that never existed in this repo (actual default branch is `main`), so CI had silently never run on any push/PR. This was fixed in a separate ad-hoc commit (`cbe8a82`) that also updated `CLAUDE.md` and `README.md`'s CI sections to say `main` and mention the new `test:unit` step. Not in the plan's "Changes Required".
- **Fix**: No further action needed — already surfaced to and explicitly approved by the user via AskUserQuestion during the session, landed in its own clearly-labeled commit separate from the plan's Phase 3 commit. Recording here for the change's audit trail.
- **Decision**: FIXED (already resolved via `cbe8a82`, prior to this triage)

### F2 — Test ordering relies on Vitest's implicit sequential default

- **Severity**: ⚠️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `tests/integration/cross-user-isolation.test.ts:31-46`
- **Detail**: The update/delete/summary tests depend on running in file order after a shared `beforeAll` (e.g. the update test must run before the delete test reads `aExpenseId`). Nothing pins this explicitly — it relies on Vitest's default non-shuffled, sequential-within-file execution. Neither this file nor `vitest.integration.config.ts` currently enables shuffling or file-level concurrency, so the risk is latent, not active.
- **Fix**: Optionally add a one-line comment noting the ordering dependency, or wrap the dependent tests in `describe.sequential(...)` if this config is ever copied into a shared/shuffled setup.
- **Decision**: FIXED — added an ordering-dependency comment to `tests/integration/cross-user-isolation.test.ts`

### F3 — No retry/backoff around Supabase Auth signUp

- **Severity**: ⚠️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `tests/integration/supabase-client.ts:23`
- **Detail**: `signUpTestUser` has no retry/backoff around network failure or Supabase Auth rate-limiting. A transient blip fails the whole file with the same loud error as a genuine RLS regression, with no way to tell them apart from the failure message alone.
- **Fix**: Acceptable as-is given the deliberate "fail loudly" design intent; only worth revisiting if this suite starts running frequently in CI and flakes on rate limits.
- **Decision**: ACCEPTED-AS-RULE: "Integration tests hitting Supabase Auth signUp have no distinguishing failure mode for transient network/rate-limit errors" (see `context/foundation/lessons.md`); code left unchanged

## Additional notes (not findings)

- Both review agents independently confirmed: Phase 1 and Phase 2 file contracts match the plan exactly (env.ts never logs credential values; `signUpTestUser` fails loudly instead of falling back to sign-in; the two vitest configs are fully independent; attacker calls in `cross-user-isolation.test.ts` are genuinely raw/unfiltered — 6 of 8 assertions exercise a real RLS-blocked path, confirmed non-vacuous via the manual "break one policy" verification step).
- `tests/integration/supabase-client.ts` deliberately uses the plain `@supabase/supabase-js` `createClient` instead of the app's `src/lib/supabase.ts` factory (which is `@supabase/ssr`-based and requires an Astro request context) — justified and already documented in the file's own docstring.
- Automated success criteria re-verified at review time: `npm run lint` (exit 0), `npm run test:unit` (17/17 passed), `npm run test:integration` (8/8 passed).
- All Manual Progress items (1.4, 1.5, 2.3, 2.4, 3.3) were confirmed by the user in the conversation in real time (including a live "break one RLS policy, confirm the test fails, restore it, confirm it passes again" check and a live CI Actions-tab check after the master→main fix) — not rubber-stamped.
