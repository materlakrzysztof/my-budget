---
project: MyBudget
researched_at: 2026-07-20
recommended_platform: Cloudflare (Workers + Pages)
runner_up: Render
context_type: mvp
tech_stack:
  language: TypeScript/JavaScript
  framework: Astro 6 (React 19 islands)
  runtime: Cloudflare Workers (via @astrojs/cloudflare)
---

## Recommendation

**Deploy on Cloudflare (Workers + Pages).**

MyBudget's tech stack already ships wired for Cloudflare via the `@astrojs/cloudflare` adapter, so this is the zero-switching-cost option, and it stays at $0/month at the project's expected traffic (10k-100k requests/month, single region, solo user). It clears four of five agent-friendly criteria outright, with the fifth (MCP integration) present but not formally labeled GA. Given the interview's top priority is minimizing cost — not maximizing DX or global reach — and the stack is a hard constraint already pointing here, Cloudflare wins even after the anti-bias cross-check surfaced real (but manageable) platform-transition risk.

## Platform Comparison

| Platform   | CLI-first | Managed/Serverless | Agent-readable docs | Stable deploy API | MCP / Integration | Total    |
| ---------- | --------- | ------------------ | ------------------- | ----------------- | ----------------- | -------- |
| Cloudflare | Pass      | Pass               | Pass                | Pass              | Partial           | 4P / 1Pt |
| Render     | Pass      | Pass               | Pass                | Pass              | Pass              | 5P       |
| Vercel     | Pass      | Pass               | Pass                | Pass              | Pass              | 5P       |
| Netlify    | Partial   | Pass               | Partial             | Pass              | Partial           | 2P / 3Pt |
| Fly.io     | Pass      | Pass               | Pass                | Pass              | Partial           | 4P / 1Pt |
| Railway    | Partial   | Pass               | Pass                | Partial           | Partial           | 2P / 3Pt |

Notes per platform:

- **Cloudflare** — `wrangler deploy` / `rollback` / `tail` are fully non-interactive and CI-scriptable; docs are published as `llms.txt`/markdown; the only soft spot is an MCP server with no formal GA label as of this research (2026-07-20).
- **Render** — Every criterion passes cleanly, including a Render MCP server that reached GA per Render's own changelog. Deploys are immutable with automatic rollback on failed health checks — arguably the most deterministic deploy API of the six. Costs $0 (free, with cold-start spin-down) to $7/month (always-on Starter).
- **Vercel** — Also a clean 5-pass score, with an official OAuth-backed MCP. The blocker isn't a criterion — it's the **Hobby tier's ToS restriction to non-commercial personal use**, a real risk if MyBudget is ever monetized or shared beyond personal use.
- **Netlify** — CLI rollback and markdown-doc availability could not be reliably confirmed during research (some doc URLs 404'd); MCP server exists but is unlabeled for GA/beta status.
- **Fly.io** — Strong technical fit (first-class persistent processes, GA scale-to-zero, docs on GitHub) but has **no free tier** — realistic cost floor is ~$2-5/month even at MVP scale, working against the cost-minimization priority. Also introduces a Dockerfile as an ongoing maintenance artifact.
- **Railway** — No dedicated CLI rollback command (UI-only true rollback); MCP explicitly labeled "work in progress"; no free tier (Hobby base fee ~$5/month).

### Shortlisted Platforms

#### 1. Cloudflare (Recommended)

Already the deployment target baked into `context/foundation/tech-stack.md` — no adapter swap, no new Dockerfile, no new account to provision. Free tier (100k req/day) comfortably covers MyBudget's expected traffic. `wrangler` gives a fully scriptable deploy/rollback/logs loop. The gap versus a 5-pass platform is a single soft criterion (MCP maturity), not a functional limitation.

#### 2. Render

The strongest technical runner-up: every criterion passes, including a GA MCP server and the most deterministic deploy/rollback model researched (immutable deploys, automatic health-check-triggered rollback). Costs $0 (with cold-start spin-down on the free tier) to $7/month for always-on. Worth switching to if Cloudflare's edge-runtime constraints (Node-API gaps, bundle-size cap) start costing more engineering time than the $0-7/month would save.

#### 3. Vercel

Excellent DX and the most mature MCP integration of the six, but the Hobby tier's non-commercial-use restriction is a real constraint for a project that could plausibly grow past "personal tool" — worth a second look only if MyBudget stays strictly personal-use or upgrades to Pro.

## Anti-Bias Cross-Check: Cloudflare

### Devil's Advocate — Weaknesses

1. **Cloudflare Pages is in maintenance mode** — Cloudflare is consolidating features into Workers Static Assets. `tech-stack.md` points at `cloudflare-pages`; no forced migration exists today, but it's a path being actively de-emphasized.
2. **`workerd` is not Node** — requires the `nodejs_compat` flag; `node:fs` doesn't exist at all. Any future npm dependency (e.g. a chart library for v2's trend analysis) can silently fail on the edge runtime in ways that only surface at deploy time, not in local dev.
3. **Supabase Realtime over WebSocket has a documented Cloudflare-specific failure (error 1101)** — irrelevant today (no realtime requirement) but forecloses a cheap path to live-updating features later.
4. **Bundle size cap (3MB gzip on the free tier)** — Astro + React + Tailwind + shadcn/ui components can approach this faster than on a classic Node runtime; every new heavy dependency is a real risk of hitting the ceiling.
5. **No formal GA label on Cloudflare's MCP server** — if the plan ever includes agent-driven production operations (deploy/rollback via agent), this is more uncertainty than Render's confirmed-GA equivalent.

### Pre-Mortem — How This Could Fail

Six months after deploying MyBudget on Cloudflare Pages, the solo developer tries adding a charting library for v2's month-over-month trend view. The library silently depends on `node:fs` for font caching — it builds fine locally (Node) but throws only at Workers deploy time, because the runtime diverges from the dev server in a non-obvious way. Around the same time, Cloudflare's transition timeline for Pages advances further, and the migration guide to Workers Static Assets requires a manual `wrangler.toml` rewrite and a re-tested deploy. Being an after-hours project, the migration gets deferred repeatedly. Separately, the 3MB bundle cap gets crossed after one more UI dependency lands, and CI starts failing with an error that doesn't obviously point at "bundle too large" — debugging an edge-runtime-specific build failure eats more time than building the feature itself would have.

### Unknown Unknowns

- Workers Static Assets (Pages' likely successor) has a **different configuration model** than Pages — if a forced migration ever happens, it is not a one-line change.
- `astro:env` server-only secrets (used for `SUPABASE_URL`/`SUPABASE_KEY`) are set differently locally (`.dev.vars`) vs in production (Cloudflare dashboard or `wrangler secret put`) — easy to mix up on first deploy.
- Cloudflare KV (if ever adopted) is **eventually consistent** (up to 60s global propagation) — surprising if coming from a traditional immediately-consistent database mental model.
- Workers cold starts are extremely fast (milliseconds) but behave differently from a traditional serverless cold start — debugging performance requires a different mental model than Vercel/Render's function model.
- The `nodejs_compat` flag needs to stay current with `workerd` releases — a hidden, easy-to-forget maintenance point as Cloudflare evolves the runtime.

## Operational Story

- **Preview deploys**: Cloudflare Pages generates a preview URL per branch/PR automatically on push; no extra configuration needed. Preview URLs are publicly reachable by default — add Cloudflare Access if preview content needs to stay private.
- **Secrets**: `SUPABASE_URL`/`SUPABASE_KEY` are declared as server-only secrets via Astro's `astro:env` schema. Locally they live in `.dev.vars` (gitignored); in production they're set via the Cloudflare dashboard or `wrangler secret put <NAME>`. Only the account holder (or anyone with dashboard/API-token access) can read or rotate them.
- **Rollback**: `wrangler rollback` reverts to a prior deployment; this is a fast, deterministic CLI operation. Caveat: Supabase migrations do not roll back automatically alongside a Cloudflare rollback — a schema change paired with a bad deploy needs a manual migration revert.
- **Approval**: Routine deploys (`wrangler deploy` on merge to main, per the CI flow already configured) can run unattended. Rotating the primary Supabase service key, changing billing tier, or deleting a Supabase project/table should stay a human-approved action.
- **Logs**: `wrangler tail` streams live production logs read-only from the terminal; no dashboard click required. Cloudflare's docs are available as markdown (`developers.cloudflare.com/llms.txt`) for direct agent consumption when troubleshooting.

## Risk Register

| Risk                                                                                                                     | Source                        | Likelihood | Impact | Mitigation                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------ | ----------------------------- | ---------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pages deprecation path forces a config migration to Workers Static Assets                                                | Devil's advocate              | M          | M      | Watch Cloudflare's migration-guide changelog; budget a half-day for the `wrangler.toml` rewrite if/when Pages sunsets.                                                        |
| A future npm dependency silently relies on a missing Node API (`node:fs`, etc.) and only fails at deploy time            | Devil's advocate / Pre-mortem | M          | M      | Enable `nodejs_compat` explicitly; smoke-test `npm run build` + a real `wrangler deploy` to a preview branch before merging any new dependency, not just local `npm run dev`. |
| Bundle size creeps past the 3MB (free tier) gzip cap as UI dependencies accumulate                                       | Devil's advocate / Pre-mortem | L          | M      | Monitor build output size in CI; if approached, split routes or move to the paid 10MB tier ($5/mo).                                                                           |
| Supabase Realtime (WebSocket) doesn't work reliably on Cloudflare (error 1101) if live-updating features are added later | Research finding              | L          | L      | Not needed for v1; if added in v2, evaluate polling or a non-Workers proxy for the realtime channel specifically.                                                             |
| Cloudflare rollback doesn't revert a paired Supabase migration                                                           | Research finding              | L          | M      | Treat schema migrations as forward-only during MVP; keep migrations additive (new columns nullable) so an app rollback doesn't strand the schema.                             |
| Cloudflare's MCP server has no formal GA label, unlike Render's                                                          | Devil's advocate              | L          | L      | No action needed today (no agent-driven prod-ops planned); re-evaluate if agent-driven deploys become part of the workflow.                                                   |

## Getting Started

1. Confirm the Cloudflare adapter is already configured: `@astrojs/cloudflare` is in `package.json` and `astro.config.mjs` sets `output: "server"` with the Cloudflare adapter (already true in this scaffold).
2. Authenticate Wrangler: `npx wrangler login` (or set `CLOUDFLARE_API_TOKEN` for CI).
3. Set production secrets: `npx wrangler secret put SUPABASE_URL` and `npx wrangler secret put SUPABASE_KEY`.
4. Deploy: `npm run build && npx wrangler deploy` for a manual deploy — or just merge to `main`, which triggers the gated `deploy` job in `.github/workflows/ci.yml` to publish automatically after `ci` + `migration-safety` pass. CI auth uses the `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` GitHub repo secrets.
5. Verify: `npx wrangler tail` to confirm the deployed Worker is serving requests and logging as expected.

## Out of Scope

The following were not evaluated in this research:

- Docker image configuration
- Production-scale architecture (multi-region, HA, DR)

CI/CD pipeline setup (auto-deploy-on-merge) was subsequently delivered — see `context/changes/deploy-on-merge/` and the `deploy` job in `.github/workflows/ci.yml`.
