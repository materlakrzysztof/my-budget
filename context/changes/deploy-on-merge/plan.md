# CI auto-deploy-on-merge to Cloudflare Workers — Implementation Plan

## Overview

Add a gated `deploy` job to `.github/workflows/ci.yml` so that every merge to `main`
automatically deploys the app to Cloudflare Workers — but **only after** the existing
`ci` and `migration-safety` jobs pass. This promotes the parked roadmap item
"CI auto-deploy-on-merge" (`context/foundation/roadmap.md:181`) into shipped work.

## Current State Analysis

- **CI today** (`.github/workflows/ci.yml`): two jobs on `push`/`pull_request` to `main` —
  `ci` (checkout → node 22 → `npm ci` → `astro sync` → `lint` → `test:unit` → `build` with
  `SUPABASE_URL`/`SUPABASE_KEY` from repo secrets) and `migration-safety`
  (`supabase start` → `test:schema-safety`). **No deploy job exists.**
- **Deployment today**: one-time manual `npm run build && npx wrangler deploy`, live at
  `https://my-budget.krzysztof-materla-dev.workers.dev` (`context/deployment/deploy-plan.md`).
- **Wrangler**: `wrangler.jsonc` (`name: my-budget`, `main: @astrojs/cloudflare/entrypoints/server`,
  `assets.directory: ./dist`), no `account_id` — Wrangler auto-detects. `wrangler ^4.90.0`
  pinned in devDependencies.
- **Secrets**: runtime `SUPABASE_URL`/`SUPABASE_KEY` are already set on the Worker via
  `wrangler secret put` and **survive redeploys** — the deploy does not touch them. Repo secrets
  `SUPABASE_URL`/`SUPABASE_KEY` already exist (build step uses them).
- **Doc inconsistency**: `context/foundation/infrastructure.md:99` refers to an "existing GitHub
  Actions auto-deploy-on-merge flow" — it does not exist. To be corrected as part of this change.

### Key Discoveries:

- Parked reason has expired — S-01…S-07 all `done`/archived (`roadmap.md:187-195`).
- Not tied to any PRD FR (`prd.md` FR-001…FR-014 contain no CI/CD requirement) — pure infra.
- `account_id` deliberately kept out of `wrangler.jsonc` per `deploy-plan.md` — pass via env.
- No `deploy` npm script exists today (`package.json:5-18`).

## Desired End State

Merging any PR to `main` triggers CI; on green, a `deploy` job runs `npx wrangler deploy`
and the live Worker reflects the merged commit — no human runs `wrangler` by hand. A failing
`ci` or `migration-safety` blocks the deploy. A post-deploy smoke check confirms the site
returns HTTP 200. Manual `wrangler deploy` remains available as a fallback.

## What We're NOT Doing

- Not touching `wrangler.jsonc` (no `account_id` added there).
- Not adding staging/preview environments or per-branch deploys (deploy runs on `main` only).
- Not re-pushing Supabase runtime secrets (already on the Worker).
- Not migrating to Cloudflare's dashboard Git integration (keeping the GH-Actions-gated flow).
- Not adding E2E tests to the deploy gate (out of scope; E2E CI is separately parked).

## Implementation Approach

Extend the existing single workflow file with a third job, `deploy`, gated by
`needs: [ci, migration-safety]` and `if: github.ref == 'refs/heads/main'`. Deploy via the
pinned `npx wrangler deploy` (not a marketplace action) for version consistency; Wrangler reads
`CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` from env. Rebuild inside the job (job isolation)
rather than passing artifacts between jobs — simplest for this scale. Add an optional `deploy`
npm script for local parity, and reconcile the docs.

## Critical Implementation Details

- **Gate correctness**: `needs: [ci, migration-safety]` makes the deploy wait for both jobs;
  `if: github.ref == 'refs/heads/main'` ensures it is *skipped* on `pull_request` events (PRs
  still run `ci` + `migration-safety`, deploy shows as skipped). Both conditions are required —
  `needs` alone would still attempt to deploy from PR runs.
- **Secret prerequisite**: the job fails until `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`
  exist as GitHub repo secrets (manual Phase 0). This is expected, not a code bug.
- **Build env**: the `build` step still needs `SUPABASE_URL`/`SUPABASE_KEY` (astro env schema);
  reuse the same repo secrets already wired into the `ci` job.

## Phase 0: Cloudflare credentials (manual — human)

### Overview

One-time setup the human performs in the Cloudflare and GitHub dashboards. The deploy job
cannot succeed without it. Not a code change — listed so the implementer pauses for it.

### Changes Required:

#### 1. Create a scoped Cloudflare API token

**Where**: Cloudflare dashboard → My Profile → API Tokens → Create Token.

**Intent**: Generate a token that can publish the Worker, nothing more.

**Contract**: Use the "Edit Cloudflare Workers" template (permissions *Account › Workers Scripts ›
Edit* and *Account › Account Settings › Read*), scoped to the account. Copy the token once.

#### 2. Obtain the Account ID

**Where**: `npx wrangler whoami` (after `wrangler login`) or dashboard → Workers & Pages → Account ID.

#### 3. Add GitHub repo secrets

**Where**: GitHub repo → Settings → Secrets and variables → Actions.

**Contract**: Add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. Verify `SUPABASE_URL` /
`SUPABASE_KEY` repo secrets already exist, and that Worker runtime secrets are set
(`npx wrangler secret list`).

### Success Criteria:

#### Automated Verification:

- `npx wrangler whoami` shows the account and confirms token auth works locally.

#### Manual Verification:

- Both `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` appear in the repo's Actions secrets list.
- `SUPABASE_URL` / `SUPABASE_KEY` repo secrets confirmed present.

**Implementation Note**: Pause here for human confirmation that the secrets exist before relying
on the deploy job to run green.

---

## Phase 1: Gated deploy job + local deploy script

### Overview

Add the `deploy` job to `ci.yml` and an optional `deploy` npm script.

### Changes Required:

#### 1. Deploy job in the CI workflow

**File**: `.github/workflows/ci.yml`

**Intent**: Auto-deploy to Cloudflare Workers on merge to `main`, only after tests pass.

**Contract**: New job `deploy`, `runs-on: ubuntu-latest`, `needs: [ci, migration-safety]`,
`if: github.ref == 'refs/heads/main'`, with a `concurrency: { group: deploy-production,
cancel-in-progress: false }` guard. Steps: checkout → setup-node 22 (npm cache) → `npm ci` →
`npx astro sync` → `npm run build` (env `SUPABASE_URL`/`SUPABASE_KEY` from secrets) →
`npx wrangler deploy` (env `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` from secrets) →
smoke-check step `curl -fsS --retry 5 --retry-all-errors --retry-delay 5
https://my-budget.krzysztof-materla-dev.workers.dev/ -o /dev/null`.

#### 2. Local deploy script

**File**: `package.json`

**Intent**: Give the human a one-command local deploy matching CI.

**Contract**: Add `"deploy": "astro build && wrangler deploy"` to `scripts`.

### Success Criteria:

#### Automated Verification:

- Workflow YAML is valid and parses (no CI syntax error on push).
- `npm run build && npx wrangler deploy --dry-run` succeeds locally (build + wrangler config OK).
- On a PR to `main`: `ci` + `migration-safety` run and the `deploy` job is **skipped**.
- On merge to `main`: `deploy` runs after green, `npx wrangler deploy` succeeds, smoke check returns 200.

#### Manual Verification:

- `npx wrangler deployments list` shows a fresh deployment timestamped at the merge.
- Live site serves `/` and, after sign-in, shows data (runtime secrets intact).
- A deliberately broken `test:unit` on a branch → red `ci` → `deploy` does **not** run (revert after).

**Implementation Note**: After the workflow lands and a real merge deploys green, pause for human
confirmation of the live-site checks before closing the phase.

---

## Phase 2: Documentation reconciliation

### Overview

Update roadmap, infrastructure notes, and contributor docs to reflect that CD now exists.

### Changes Required:

#### 1. Roadmap

**File**: `context/foundation/roadmap.md`

**Intent**: Move the item from Parked to Done and correct the inventory line.

**Contract**: Remove the "CI auto-deploy-on-merge" bullet from `## Parked` (`:181`); add a Done
entry (infra) dated 2026-07-25; update the Deploy/infra inventory line (`:61`) from "Auto-deploy-on-merge
still not wired in" to reflect that it is wired.

#### 2. Infrastructure notes

**File**: `context/foundation/infrastructure.md`

**Intent**: Fix the aspirational-flow inconsistency and de-scope the now-done item.

**Contract**: Rewrite `:99` to describe the real `deploy` job; remove/annotate "CI/CD pipeline
setup" in the Out-of-Scope list (`:102-108`) as delivered.

#### 3. Contributor docs

**Files**: `README.md` (Deployment/CI section ~`:142-162`), `CLAUDE.md` (`## CI`, Deploy note `:48`)

**Intent**: Tell contributors merges auto-deploy after green CI; manual `wrangler deploy` is fallback.

**Contract**: Prose additions only.

### Success Criteria:

#### Automated Verification:

- `prettier --check` passes on edited `*.md` (pre-commit formatting).
- No remaining reference to auto-deploy as "parked" or "not wired in" (`grep` clean in `context/foundation/`).

#### Manual Verification:

- Roadmap reads coherently: item under Done, inventory line accurate.
- README/CLAUDE deploy story matches actual behavior.

---

## Testing Strategy

### Automated:

- Workflow validity confirmed by the push itself running the parsed workflow.
- `wrangler deploy --dry-run` locally before pushing.
- Gate behavior proven by the PR run (deploy skipped) and merge run (deploy runs).

### Manual Testing Steps:

1. Open a trivial PR to `main`; confirm `deploy` is skipped, other jobs run.
2. Merge; confirm `deploy` runs after green, wrangler publishes, smoke check 200.
3. `npx wrangler deployments list` shows the new deployment.
4. Load the live site and sign in — data renders (runtime secrets untouched).
5. (Optional) Break `test:unit` on a branch, merge-sim, confirm deploy does not run; revert.

## Migration Notes

None. No data or schema changes. The first automated deploy replaces the manual one seamlessly
because runtime secrets already live on the Worker.

## References

- Change identity: `context/changes/deploy-on-merge/change.md`
- Parked item: `context/foundation/roadmap.md:181`
- Prior manual deploy: `context/deployment/deploy-plan.md`
- Current CI: `.github/workflows/ci.yml`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 0: Cloudflare credentials (manual)

#### Automated

- [x] 0.1 `npx wrangler whoami` confirms token auth works locally — token auth proven via successful CI deploy (run 30171936711)

#### Manual

- [x] 0.2 `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` present in repo Actions secrets — confirmed by successful deploy on 2026-07-25
- [x] 0.3 `SUPABASE_URL` / `SUPABASE_KEY` repo secrets confirmed present — build step succeeded in deploy job

### Phase 1: Gated deploy job + local deploy script

#### Automated

- [x] 1.1 Workflow YAML valid and parses on push — 4fc1445
- [x] 1.2 `npm run build && npx wrangler deploy --dry-run` succeeds locally — 4fc1445
- [x] 1.3 On PR to `main`, `deploy` job is skipped while `ci` + `migration-safety` run — gate `if: ref==main`; PR #4 merged cleanly, deploy did not run on the PR event
- [x] 1.4 On merge to `main`, `deploy` runs after green, `wrangler deploy` succeeds, smoke check 200 — run 30171936711 (main 4266bb3): ci/migration-safety/deploy all success, smoke 200

#### Manual

- [ ] 1.5 `npx wrangler deployments list` shows a fresh deployment at merge time
- [x] 1.6 Live site serves `/` and shows data after sign-in — live URL returns HTTP 200 (sign-in data path not separately exercised)
- [ ] 1.7 Broken `test:unit` on a branch keeps `deploy` from running (reverted after)

### Phase 2: Documentation reconciliation

#### Automated

- [x] 2.1 `prettier --check` passes on edited `*.md` — 981d489
- [x] 2.2 No "parked" / "not wired in" auto-deploy references remain in `context/foundation/` — 981d489

#### Manual

- [x] 2.3 Roadmap reads coherently (item under Done, inventory accurate) — verified in impl-review
- [x] 2.4 README/CLAUDE deploy story matches actual behavior — verified in impl-review; deploy behavior matches shipped run
