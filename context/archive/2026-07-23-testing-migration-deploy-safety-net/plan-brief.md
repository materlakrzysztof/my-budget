# Migration & Deploy Safety Net — Plan Brief

> Full plan: `context/changes/testing-migration-deploy-safety-net/plan.md`

## What & Why

Phase 3 of `context/foundation/test-plan.md`'s rollout: close Risk #5 — "a
migration or deploy that passes in dev/staging corrupts or silently omits
data in production" — the one top-5 risk this project's CI does nothing
about today. `.github/workflows/ci.yml` runs lint, unit tests, and build,
but never applies a migration or touches a database.

## Starting Point

Two migrations exist (`categories`, `expenses`), both with RLS and
per-operation policies, applied to a persistent E2E Supabase project used by
`tests/integration/` — but never verified against a *fresh* schema in CI.
Deploy is manual, one-time, and predates these migrations; there's no
evidence they've ever reached the actual production project. Auto-deploy is
explicitly parked (roadmap.md), so this phase targets CI, not CD.

## Desired End State

Every PR triggers a new `migration-safety` CI job that boots a throwaway
local Postgres via the already-installed `supabase` CLI, applies every
migration from scratch, and runs a new Vitest suite proving the resulting
schema has the exact shape the app needs (RLS on, right policies, right
constraints). The job is a required check — a broken or shape-regressing
migration cannot merge to `main`.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| DB seed-data check | Dropped entirely | Default categories are seeded lazily per-user at the app layer (`categories.ts`), not via `supabase/config.toml`'s unused `seed.sql` — there's no DB-level reference data to check | Plan (corrected mid-planning) |
| Migration dry-run mechanism | Ephemeral local Postgres via `supabase` CLI | Zero new secrets, proves the full sequence applies from a truly fresh schema — CLI is already a devDependency, Docker is preinstalled on GH runners | Plan |
| Reuse `tests/integration/` suite in this job | No — kept separate | That suite targets the persistent E2E project and a different concern (RLS via real sessions); wiring it into CI was already deferred by Phase 1's own decision | Plan |
| Post-deploy data smoke check | Skipped for this phase | No CD exists to hook a post-deploy check into; automating for a process that may change shape later is premature | Plan |
| Enforcement | Required status check, blocks merge | A non-blocking check defeats the point — the team has already been burned by this once (interview Q2) | Plan |
| Priority if constrained | Schema-shape assertions, not just "didn't error" | "Applied without error" is weak signal on its own; the real value is proving RLS/policies/constraints didn't silently regress | Plan |
| Partial-apply failure handling | Rely on `supabase` CLI's own transactional apply | No custom rollback needed — there's no real target to protect, the ephemeral container is discarded either way | Plan |
| Test tooling | Vitest + new `pg` dependency, not pgTAP/`supabase test db` | One test framework across the repo, matching test-plan.md's own cost-vs-signal principle | Plan |

## Scope

**In scope:**
- New parallel `migration-safety` job in `.github/workflows/ci.yml`
- Ephemeral local Postgres boot via `supabase` CLI, migrations applied from scratch
- New `tests/schema-safety/` Vitest suite asserting RLS + policies + constraints
- Required-status-check enforcement on `main` (with explicit user confirmation before changing branch protection)
- `test-plan.md` updates (§3 status, §5 gates, §6.5 cookbook, Risk #5 closure note)

**Out of scope:**
- DB-level seed/reference-data check (no real gap — see Key Decisions)
- Automated post-deploy smoke check (no CD to hook into yet)
- Wiring `tests/integration/` into CI (separate, already-deferred concern)
- Any dry-run against the actual production/E2E hosted project
- Adding RLS update/delete policies to `categories` (pre-existing, unrelated forward note)

## Architecture / Approach

One new GitHub Actions job runs alongside (not inside) the existing `ci`
job. It boots Supabase's local Docker-based stack (Postgres + friends,
non-Postgres containers excluded for speed), which applies
`supabase/migrations/*.sql` as a side effect of starting up. A new Vitest
suite then connects directly to that local Postgres with a `pg` client —
necessary because RLS/policy/constraint facts live in `pg_catalog`, which
PostgREST/`supabase-js` never expose — and asserts the specific shape both
existing migrations establish.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Ephemeral migration-apply CI job | New CI job proving migrations apply cleanly from a fresh DB | Wrong `supabase start` exclude-flag syntax for the installed CLI version wastes a cycle — verify via `--help` first |
| 2. Schema-shape assertion suite | New Vitest suite proving RLS/policies/constraints didn't silently regress | A suite that queries the wrong catalog view could pass vacuously — the manual "break it and confirm it fails" step directly guards this |
| 3. Wire in, enforce, document | Job required on `main`; test-plan.md reflects real Phase 3 scope | Enabling branch protection is a shared, repo-wide setting — requires explicit user confirmation, not unilateral action |

**Prerequisites:** Docker available locally for manual verification steps (already required for `supabase start`, same as existing `tests/integration/` local dev flow).
**Estimated effort:** ~1 session across 3 phases.

## Open Risks & Assumptions

- Assumes the installed `supabase` CLI (`^2.23.4`) supports excluding
  non-Postgres containers from `start` — if not, the job still works, just
  slower; not a correctness risk.
- Assumes GitHub-hosted `ubuntu-latest` runners keep Docker preinstalled
  (current, standard behavior).
- Enabling the required-status-check itself is a manual, user-confirmed
  step, not something this plan's implementation automates.

## Success Criteria (Summary)

- A migration that fails to apply, or that silently drops RLS/a
  policy/a constraint, fails CI on the PR and cannot merge to `main`
- No new secrets or hosted-project access were introduced
- `test-plan.md` accurately reflects what Phase 3 covers and what it
  deliberately doesn't
