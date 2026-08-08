---
change_id: deploy-on-merge
title: CI auto-deploy-on-merge to Cloudflare Workers
status: archived
created: 2026-07-25
updated: 2026-07-26
archived_at: 2026-07-26T04:51:21Z
---

## Notes

Promotes the parked roadmap item **"CI auto-deploy-on-merge"** (`roadmap.md:181`) into
an active change. Adds a gated `deploy` job to `.github/workflows/ci.yml` so every merge
to `main` auto-deploys to Cloudflare Workers **only after** `ci` + `migration-safety` pass.
Parking reason ("low-complexity first, ship core loop before CD") has expired — S-01…S-07
are all done/archived. Not tied to any PRD FR; purely technical.

Design decisions (from plan-mode brainstorm): deploy via `npx wrangler deploy` (pinned
wrangler from devDeps, no marketplace action); `account_id` stays out of `wrangler.jsonc`
(env in the job); runtime Supabase secrets already live on the Worker and survive redeploys.
