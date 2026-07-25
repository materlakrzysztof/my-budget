# CI auto-deploy-on-merge — Plan Brief

> Full plan: `context/changes/deploy-on-merge/plan.md`

## What & Why

Wire continuous deployment: every merge to `main` auto-deploys the app to Cloudflare Workers,
but only after CI passes. This promotes the parked roadmap item "CI auto-deploy-on-merge"
(`roadmap.md:181`) — the only parked element tied to no PRD FR, purely technical. Its parking
reason ("ship the core loop first") has expired now that S-01…S-07 are all done.

## Starting Point

`ci.yml` runs `ci` (lint+unit+build) and `migration-safety` on push/PR to `main`, with no deploy
job. Deployment is a one-time manual `wrangler deploy` (live at
`my-budget.krzysztof-materla-dev.workers.dev`). Runtime Supabase secrets already live on the
Worker and survive redeploys.

## Desired End State

Merging a PR to `main` triggers CI; on green, a `deploy` job runs `npx wrangler deploy` and the
live Worker reflects the merge — no hand-run wrangler. A post-deploy smoke check asserts HTTP 200.
Manual `wrangler deploy` stays as a fallback.

## Key Decisions Made

| Decision            | Choice                                        | Why (1 sentence)                                              | Source |
| ------------------- | --------------------------------------------- | ------------------------------------------------------------- | ------ |
| CD structure        | Gated `deploy` job in existing `ci.yml`       | Deploy only on green CI; one coherent workflow file           | Plan   |
| Deploy mechanism    | `npx wrangler deploy` (pinned devDep)         | Version consistency; no marketplace-action dependency         | Plan   |
| Trigger gate        | `needs: [ci, migration-safety]` + `if` main   | Skipped on PRs, runs only on real merge to `main`             | Plan   |
| `account_id`        | Env in job, not in `wrangler.jsonc`           | Keeps the deliberate deploy-plan.md convention                | Plan   |
| Process depth       | Full 10x ceremony (new→plan→implement→archive)| Consistency with how S-01…S-07 were tracked                   | Plan   |

## Scope

**In scope:** deploy job in `ci.yml`; optional `deploy` npm script; smoke check; doc reconciliation
(roadmap Parked→Done, infrastructure inconsistency fix, README/CLAUDE notes).

**Out of scope:** touching `wrangler.jsonc`; staging/preview environments; re-pushing runtime secrets;
Cloudflare dashboard Git integration; E2E in the deploy gate.

## Architecture / Approach

Third job `deploy` appended to `ci.yml`, gated by `needs` + `if: github.ref == 'refs/heads/main'`,
with a `deploy-production` concurrency group. Rebuilds inside the job (job isolation) then runs
pinned `npx wrangler deploy`; Wrangler reads `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` from env.

## Phases at a Glance

| Phase                         | What it delivers                                   | Key risk                                        |
| ----------------------------- | -------------------------------------------------- | ----------------------------------------------- |
| 0. Cloudflare credentials     | API token + account ID as GitHub repo secrets      | Human-only; deploy fails until secrets exist    |
| 1. Gated deploy job + script  | Auto-deploy on merge, smoke-checked                | Gate correctness (must skip on PRs)             |
| 2. Doc reconciliation         | Roadmap/infra/README/CLAUDE reflect CD exists      | Low — prose only                                |

**Prerequisites:** Cloudflare account with the Worker already deployed (done); ability to create a
CF API token and add GitHub repo secrets (Phase 0).
**Estimated effort:** ~1 session; Phase 0 is manual, Phases 1–2 are small edits.

## Open Risks & Assumptions

- Deploy job stays red until the two CF secrets are added (Phase 0) — expected, not a bug.
- `astro env` schema marks Supabase vars optional, so a misconfig could deploy silently — the
  smoke check is the guard.

## Success Criteria (Summary)

- A PR to `main` runs CI with `deploy` skipped; a merge deploys automatically after green.
- `wrangler deployments list` shows the merge-timed deployment; live site serves and shows data.
- Docs no longer describe auto-deploy as parked or aspirational.
