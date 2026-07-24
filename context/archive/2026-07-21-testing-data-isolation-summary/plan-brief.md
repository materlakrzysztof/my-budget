# Testing Data Isolation & Summary Reconciliation — Plan Brief

> Full plan: `context/changes/testing-data-isolation-summary/plan.md`
> Research: `context/changes/testing-data-isolation-summary/research.md`

## What & Why

Prove, with two real Supabase users and no shortcuts through the app's own
session-derived filtering, that one user's categories/expenses are never
readable or mutable by another user, and that the monthly summary view never
leaks another user's totals. This is Phase 1 of `context/foundation/test-plan.md`'s
rollout, closing Risk #1 (IDOR/RLS gap) and the remaining slice of Risk #2
(summary reconciliation). Along the way, close a pre-existing gap the
research surfaced: CI runs lint and build but no tests at all.

## Starting Point

Categories, expenses, RLS policies, a DB-side summary view, a Vitest unit
suite, and 9 Playwright specs all shipped since this change opened. RLS is
scoped correctly and no service-role key exists anywhere — but that also
means the app's own routes can never be used to prove RLS holds, since
`userId` is always session-derived, never attacker-controlled. Nothing today
signs in as two real, distinct users and queries Supabase directly — that's
the one missing piece both remaining risk gaps share.

## Desired End State

A new `tests/integration/` Vitest suite, runnable via
`npm run test:integration` against the dedicated E2E Supabase project, gives
a real, RLS-provable answer to "can user B ever see or touch user A's data?"
— including through the monthly summary view. `npm run test:unit` runs
automatically in CI on every push/PR, alongside lint and build.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Test layer location | New `tests/integration/` dir + separate `vitest.integration.config.ts` | Keeps `npm run test:unit` fast and credential-free, mirroring the existing `tests/e2e/` convention | Plan (user-confirmed) |
| CI enforcement of new suite | Local-only this phase; CI wiring named as a follow-up | Avoids provisioning new GitHub secrets for a live external project in the same change that first establishes this pattern | Plan (user-confirmed) |
| CI's pre-existing zero-test gap | Wire `npm run test:unit` into CI now | Zero new secrets needed (no I/O), cheap, and directly closes a gap this same research flagged | Plan (user-confirmed) |
| Categories' missing update/delete RLS | Leave as-is; flag as a forward note only | No route exercises them today; adding unused policies with nothing to verify against is scope creep for a testing change | Plan (user-confirmed) |
| Priority if time-constrained | Cross-user DB-level proof is must-ship; CI/unit-in-CI wiring is cuttable | Matches test-plan.md's actual risk register — the CI hygiene item is adjacent, not core | Plan (user-confirmed) |
| Attacker query pattern | Raw Postgrest calls, not service-layer functions | Service functions like `updateExpense` add their own `.eq("user_id", ...)` filter, which would mask a real RLS gap | Research |
| Suite structure | One shared-fixture test file covering both risks | Both gaps close via the same two-real-user setup; splitting would duplicate the signup fixture for no benefit | Research |

## Scope

**In scope:**
- New Vitest integration-test layer (config, env loader, npm script)
- Cross-user isolation proof for categories (select/insert) and expenses (all 4 ops)
- Cross-user exclusion proof for the monthly summary view
- Wiring `npm run test:unit` into CI

**Out of scope:**
- Adding RLS update/delete policies to categories
- Wiring the new integration suite into CI (deferred follow-up)
- App/UI-level (Playwright) two-session negative tests
- Test-user cleanup/rotation in the E2E Supabase project
- Risks #3–#5 (date attribution, category mixup, migration safety) — later test-plan.md phases

## Architecture / Approach

Two real users are signed up directly against the E2E Supabase project via
`@supabase/supabase-js`, bypassing the Astro app entirely. Legitimate setup
(seeding categories, creating expenses) reuses the real service-layer
functions from `src/lib/services/`. Attacker actions deliberately skip the
service layer and issue raw Postgrest queries against the victim's known
record IDs — only that proves the database itself denies access, not just
the app's own filtering.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Integration test infrastructure | New Vitest config, env loader, signup helper, npm script, connectivity smoke test | Env-loading or client-construction bugs would silently invalidate every later assertion — caught early by a dedicated smoke test |
| 2. Cross-user isolation + summary suite | The core RLS/exclusion proof, covering categories, expenses, and the summary view | A test that accidentally reuses service-layer filtering would pass vacuously without proving RLS at all |
| 3. Wire `test:unit` into CI | New CI step, no new secrets | Low risk — existing suite already passes locally |

**Prerequisites:** Local `.dev.vars.e2e` with valid E2E-project credentials (already exists, reused as-is).
**Estimated effort:** ~1 session across 3 phases.

## Open Risks & Assumptions

- Assumes the E2E project's `mailer_autoconfirm: true` setting hasn't
  changed since it was last confirmed (2026-07-21) — Phase 1's signup
  helper fails loudly rather than silently if this assumption breaks.
- Test users accumulate indefinitely in the E2E project with no cleanup,
  matching the existing Playwright convention — acceptable for now, but
  worth revisiting if the E2E project ever hits a user-count quota.

## Success Criteria (Summary)

- `npm run test:integration` passes locally and provably fails when an RLS
  policy is temporarily broken (not a vacuous pass)
- No route or test can demonstrate one user reading, inserting-as,
  updating, or deleting another user's categories, expenses, or summary
  totals
- CI runs `npm run test:unit` on every push/PR, alongside lint and build
