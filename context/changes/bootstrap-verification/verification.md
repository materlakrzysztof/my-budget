---
bootstrapped_at: 2026-07-20T18:10:59Z
starter_id: 10x-astro-starter
starter_name: 10x Astro Starter (Astro + Supabase + Cloudflare)
project_name: my-budget
language_family: js
package_manager: npm
cwd_strategy: git-clone
bootstrapper_confidence: first-class
phase_3_status: ok
audit_command: npm audit --json
---

## Hand-off

```yaml
starter_id: 10x-astro-starter
package_manager: npm
project_name: my-budget
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: false
```

**Why this stack** (from the hand-off body):

A solo developer shipping MyBudget's MVP in 3 weeks after-hours needs login and persistent per-user data (categories, expenses) with minimal manual setup. 10x-astro-starter is the recommended default for `(web, js)` and bundles Astro + React + TypeScript with Supabase (Postgres + auth + storage) and Cloudflare deployment already wired via the `@astrojs/cloudflare` adapter, so auth and data storage come out of the box rather than being assembled by hand. It clears all four agent-friendly gates (typed, convention-based, popular in training, well-documented) and carries first-class bootstrapper confidence. AI-based auto-categorization and realtime features are out of scope for v1 per the PRD's Non-Goals, so those flags are false; payments and background jobs are not part of this product. Deployment stays on Cloudflare Pages, the starter's native default, to avoid the extra adapter-swap work that a Vercel deploy would require. CI runs on GitHub Actions with auto-deploy-on-merge, the standard shape for a solo project.

## Pre-scaffold verification

| Signal      | Value   | Severity | Notes                                                                   |
| ----------- | ------- | -------- | ----------------------------------------------------------------------- |
| npm package | not run | n/a      | `cmd_template` starts with `git clone`; no npm-distributed CLI to check |
| GitHub repo | not run | n/a      | `gh` CLI not found on this machine; recency check unavailable           |

## Scaffold log

**Resolved invocation**: `git clone https://github.com/przeprogramowani/10x-astro-starter .bootstrap-scaffold && cd .bootstrap-scaffold && npm install`
**Strategy**: git-clone
**Exit code**: 0
**Files moved**: 19
**Conflicts (.scaffold siblings)**: CLAUDE.md → CLAUDE.md.scaffold
**.gitignore handling**: moved silently (absent in cwd)
**.bootstrap-scaffold cleanup**: deleted

## Post-scaffold audit

**Tool**: npm audit --json
**Summary**: 0 CRITICAL, 6 HIGH, 9 MODERATE, 2 LOW
**Direct vs transitive**: 0/1/2/0 direct of total 0/6/9/2 (CRITICAL/HIGH/MODERATE/LOW)

#### CRITICAL findings

None.

#### HIGH findings

- **astro** (direct, range `<=7.0.0-beta.6`, fix available)
  - Astro: Reflected XSS via unescaped slot name — https://github.com/advisories/GHSA-8hv8-536x-4wqp (fixed `<6.3.3`)
  - Astro: Host header SSRF in prerendered error page fetch — https://github.com/advisories/GHSA-2pvr-wf23-7pc7 (fixed `<6.4.6`)
  - Astro: XSS via Unescaped Attribute Names in Spread Props — https://github.com/advisories/GHSA-jrpj-wcv7-9fh9 (fixed `<6.4.6`)
- **devalue** (transitive, range `5.6.3 - 5.8.0`, fix available)
  - Svelte devalue: DoS via sparse array deserialization — https://github.com/advisories/GHSA-77vg-94rm-hx3p
- **miniflare** (transitive, fix available) — advisory chain via `@cloudflare/vite-plugin`
- **undici** (transitive, range `7.0.0 - 7.27.2`, fix available)
  - Multiple advisories: TLS validation bypass, header injection, WebSocket DoS, cross-origin routing, cache poisoning, SameSite downgrade, cache info disclosure — see https://github.com/advisories/GHSA-vmh5-mc38-953g and related
- **vite** (transitive, range `7.0.0 - 7.3.3`, fix available)
  - launch-editor NTLMv2 hash disclosure on Windows — https://github.com/advisories/GHSA-v6wh-96g9-6wx3
  - `server.fs.deny` bypass on Windows alternate paths — https://github.com/advisories/GHSA-fx2h-pf6j-xcff
- **ws** (transitive, range `8.0.0 - 8.20.1`, fix available)
  - Uninitialized memory disclosure — https://github.com/advisories/GHSA-58qx-3vcg-4xpx
  - Memory exhaustion DoS from tiny fragments — https://github.com/advisories/GHSA-96hv-2xvq-fx4p

#### MODERATE findings

- @astrojs/language-server (transitive), @cloudflare/vite-plugin (transitive), js-yaml (transitive), supabase (direct), tar (transitive), volar-service-yaml (transitive), wrangler (direct), yaml (transitive), yaml-language-server (transitive) — all fix-available; see raw `npm audit --json` output for advisory IDs.

#### LOW / INFO findings

- @babel/core (transitive) — Arbitrary File Read via sourceMappingURL Comment — https://github.com/advisories/GHSA-4x5r-pxfx-6jf8
- esbuild (transitive) — arbitrary file read via dev server on Windows — https://github.com/advisories/GHSA-g7r4-m6w7-qqqr

## Hints recorded but not acted on

| Hint                    | Value                |
| ----------------------- | -------------------- |
| bootstrapper_confidence | first-class          |
| quality_override        | false                |
| path_taken              | standard             |
| self_check_answers      | null                 |
| team_size               | solo                 |
| deployment_target       | cloudflare-pages     |
| ci_provider             | github-actions       |
| ci_default_flow         | auto-deploy-on-merge |
| has_auth                | true                 |
| has_payments            | false                |
| has_realtime            | false                |
| has_ai                  | false                |
| has_background_jobs     | false                |

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.

Useful manual steps in the meantime:

- `git init` (if you have not already) to start your own repo history.
- Review any `.scaffold` siblings the conflict policy created and decide which version of each file to keep — `CLAUDE.md.scaffold` in this case.
- Address audit findings per your project's risk tolerance — the direct findings (`astro`, `supabase`, `wrangler`) are the most immediately actionable; run `npm audit fix` or bump versions manually once you've reviewed the advisories above.
