---
date: 2026-08-08T14:38:30+02:00
researcher: Krzysztof Materla
git_commit: b86b08b491a2001b5a3d9f9f1e5c57e656597807
branch: develop
repository: 10x_budget
topic: "CI/CD AI code-review GitHub Actions workflow for PRs"
tags: [research, codebase, ci-cd, github-actions, code-review, ai, composite-action]
status: complete
last_updated: 2026-08-08
last_updated_by: Krzysztof Materla
---

# Research: CI/CD AI code-review GitHub Actions workflow for PRs

**Date**: 2026-08-08T14:38:30+02:00
**Researcher**: Krzysztof Materla
**Git Commit**: b86b08b491a2001b5a3d9f9f1e5c57e656597807
**Branch**: develop
**Repository**: 10x_budget

## Research Question

Research the codebase to inform building the `ci-cd-code-review` change per
`context/changes/ci-cd-code-review/requirements.md`: a GitHub Actions workflow
that runs on every PR to the default branch, feeds an AI reviewer the PR title +
description + git diff, scores the change on six 1–10 criteria, posts a summary
PR comment, and applies `ai-cr:passed` / `ai-cr:failed` labels — with a
composite action doing the review and an on-demand retry on the `ai-cr:review`
label. Scope: research **both** AI backends and recommend one; include the app
conventions the reviewer will judge against.

## Summary

The most consequential finding is that **the repo already ships a reusable AI
code-review engine** — `packages/code-reviewer/` (`@10x/code-reviewer`), built
over the prior `tool-loop-agent` change. It is a schema-validated,
structured-output reviewer built on the Vercel AI SDK (`ai@7`) via OpenRouter
(`OPENROUTER_API_KEY`, default model `anthropic/claude-sonnet-5`). It is the
natural core of this feature, but has **two gaps** to close: its output schema
is severity-based findings, not the six 1–10 scored criteria; and its input is a
single code blob, not a PR title + description + diff.

Two viable backends were compared:

- **A — `anthropics/claude-code-action@v1`**: fully templated in the bundled
  `.claude/skills/10x-impl-review-ci/` skill (workflow YAML + orchestration). A
  batteries-included agentic runtime — but heavyweight, higher cost/latency, and
  it resists being wrapped in a composite action (it wants to be a job step).
- **B — Direct model call in a composite action** (reusing
  `packages/code-reviewer/`): one structured API call → six integers →
  deterministic threshold → comment + labels via `gh`. Cheapest, fully
  deterministic control over the rubric/labels, and it *is* a composite action
  as the requirements ask.

**Recommendation: Backend B.** The task is a fixed-rubric scorer, not an agent;
the requirements explicitly want a composite action; and B maximally reuses code
already in the repo. Adopt three mechanics from A's template regardless:
`fetch-depth: 0` + three-dot diff, hidden-marker comment dedup, and a separate
deterministic gate step that posts a commit status so the check can block merges
while the AI step stays exit-0.

One naming correction: requirements say "PR to **master**", but the repo's
default branch is **`main`** (existing `ci.yml` targets `main`; there is no
`master` branch). Plan against `main`.

## Detailed Findings

### Existing review engine — `packages/code-reviewer/` (the core to reuse)

A standalone, side-effect-free package (`@10x/code-reviewer`, `private`, Node
≥24, native TS, `ai@7` + `@openrouter/ai-sdk-provider@3` + `zod@4`). **Not**
wired into the root workspace (root `package.json` declares no workspaces).

- `packages/code-reviewer/src/schemas.ts:15-28` — `reviewResultSchema =
  { summary, findings[] }`, findings carry a `severity` enum
  (critical/high/medium/low/info). This is the structured-output enforcement
  mechanism (`Output.object`). **Gap:** no six-criteria 1–10 `scores` object yet.
- `packages/code-reviewer/src/prompts.ts:23-27` — `REVIEW_INSTRUCTIONS` +
  `buildReviewPrompt({code, filename, language, instructions})`. **Gap:** takes a
  code snippet, not `{prTitle, prBody, diff}`.
- `packages/code-reviewer/src/agent.ts:33-39` — `createReviewAgent` uses
  `ToolLoopAgent` + `Output.object({ schema })` for schema-validated JSON;
  `reviewCode(input, config)` wrapper.
- `packages/code-reviewer/src/model.ts:20,37` — `DEFAULT_MODEL =
  "anthropic/claude-sonnet-5"` via OpenRouter; env `OPENROUTER_API_KEY`
  (required) + `OPENROUTER_MODEL` (`.env.example:1-2`).
- `packages/code-reviewer/src/cli.ts` — runnable demo gated on direct invocation.
- A scoped `ai-sdk` skill is available under `packages/code-reviewer/.claude/skills`
  for AI-SDK work in that package.

### Existing CI — `.github/workflows/ci.yml`

The **only** workflow; no `.github/actions/**` composite exists yet (convention
to establish).

- Triggers: `push` and `pull_request` to `[main]` (`ci.yml:3-7`).
- Jobs: `ci` (checkout@v4 → setup-node@v4 node 22 npm-cache → `npm ci` →
  `npx astro sync` → `npm run lint` → `npm run test:unit` → `npm run build`,
  `ci.yml:10-25`); `migration-safety` (`supabase start --exclude ...` →
  `npm run test:schema-safety`, `ci.yml:27-37`); `deploy` (`needs: [ci,
  migration-safety]`, `if: github.ref == 'refs/heads/main'`, `concurrency:
  deploy-production`, wrangler deploy + curl smoke, `ci.yml:39-65`).
- **No `permissions:` block anywhere**; no `GITHUB_TOKEN` or `gh` usage in live
  CI. Secrets present: `SUPABASE_URL`, `SUPABASE_KEY` (`ci.yml:24-25,56-57`),
  `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` (`ci.yml:60-61`). No
  `ANTHROPIC_API_KEY` / `OPENROUTER_API_KEY` yet.
- Node pinned `.nvmrc:1` = `22.14.0`; no `engines` field. (The reviewer package
  wants Node ≥24 — a version reconciliation point if run in the same job.)
- Labels: none defined/provisioned in the repo. `ai-cr:passed` / `ai-cr:failed`
  / `ai-cr:review` must be created (a Phase-0 manual/`gh label create` step, per
  the deploy-on-merge precedent).

### Backend A — `anthropics/claude-code-action@v1` (templated, but heavy)

Fully specified by `.claude/skills/10x-impl-review-ci/`
(`SKILL.md` + `references/workflow-template.yml` + `impl-review-instructions.md`).
Its CI harness mechanics are copy-pasteable even though its purpose is
plan-vs-impl review.

- Invocation `references/workflow-template.yml:124-161`: `uses:
  anthropics/claude-code-action@v1`, `ANTHROPIC_API_KEY` passed **both** as env
  and the `anthropic_api_key` input; tool-allowlist + `--max-turns 60` routed
  through `claude_args`. Template pins `claude-opus-4-7` → use **`claude-opus-4-8`**
  (current Opus) or **`claude-sonnet-5`** for a cost-appropriate gate.
- Permissions `workflow-template.yml:52-57`: workflow-level `permissions: {}` then
  per-job `pull-requests: write` (comments) + `statuses: write` (verdict). For
  labels add **`issues: write`** (label mutation hits the issues endpoint;
  `pull-requests: write` alone does not cover it). Drop `contents: write`
  (read-only feature).
- Diff discovery is inside the skill via git/`gh`, not the action:
  `git diff --name-only "origin/${BASE}...HEAD"` (three-dot, `SKILL.md:96-100`),
  PR body via `gh pr view --json body` (`SKILL.md:67`); requires `fetch-depth: 0`
  (`workflow-template.yml:59-63`).
- Comment posting `gh pr comment` (`SKILL.md:448`); comment **dedup** via hidden
  HTML marker + `gh api --paginate .../comments` delete (`SKILL.md:488-501`).
- Pass/fail is a **separate deterministic step** that parses the verdict and
  POSTs a commit status (`workflow-template.yml:216-301`) — the AI step stays
  exit-0. Copy this pattern.
- Retry-on-label already wired: `on: pull_request: types: [..., labeled,
  unlabeled]` + guard (`workflow-template.yml:34,80-102`).
- **Untrusted-PR quirk** (`workflow-template.yml:104-122`): the action relocates
  the repo `.claude/` and restores it from the base branch, so a review skill
  must be staged into user-level `~/.claude/skills/` to survive.

### Backend B — direct model call in a composite action (recommended)

- ~80% exists in `packages/code-reviewer/`. Composite action: (1) assemble diff,
  (2) one structured call for six 1–10 scores, (3) `gh` comment + labels.
- Structured JSON: extend `reviewResultSchema` with `scores`: six
  `z.number().int().min(1).max(10)` fields; `Output.object` already validates
  (`agent.ts:37`). Extend `buildReviewPrompt` to `{prTitle, prBody, diff}`.
  (Raw-Anthropic alternative: `output_config.format` json_schema on Opus 4.8 /
  Sonnet 5.)
- Threshold + labels are plain bash the team owns (e.g. fail if any criterion
  < 5, or average < 7 — a policy choice for the plan):
  `gh label create ai-cr:passed --color 2ea043 --force`;
  `gh label create ai-cr:failed --color d73a4a --force`;
  `gh pr edit "$PR" --add-label ... --remove-label ...`; `gh pr comment`.
- Diff assembly: `checkout@v4` `fetch-depth: 0` →
  `git diff origin/<base.sha>...HEAD` + `gh pr view --json title,body`. Cap/
  truncate large diffs for cost (requirements flag PR description as a "cost
  tradeoff", `requirements.md:9`).
- Permissions: `pull-requests: write` + `issues: write` + `contents: read`
  (+ `statuses: write` for a merge-blocking gate).
- Retry-on-label: `types: [opened, synchronize, reopened, labeled]` + job `if:
  github.event.action != 'labeled' || github.event.label.name == 'ai-cr:review'`;
  optionally remove `ai-cr:review` at the end so it's re-addable.

### App conventions the reviewer must judge against (grounding the 6 criteria)

Mapped to the six rubric criteria in `requirements.md:16-38`:

1. **Correctness** — layered API route → service → Supabase; thin routes, logic
   in `src/lib/services/` (`src/pages/api/categories.ts:18-57`,
   `expenses/[id].ts:21-73`). Typed error classes → specific HTTP codes
   (`services/expenses.ts:57-83`, `categories.ts:27-46`). Postgres error codes by
   named constant, not magic string (`categories.ts:6-7`, `expenses.ts:15`);
   `23514` shared by two check constraints, disambiguated by name — a real trap
   (`expenses.ts:117-127`). Explicit DB-row→DTO mappers (`toCategory`/`toExpense`).
2. **Idiomaticity** — shared types in `src/types.ts` (`CreateXRequest`/`XResponse`);
   `satisfies` on responses (`categories.ts:29`); `@/*` alias (`tsconfig.json:9-11`);
   `cn()` for classes (`utils.ts:4-6`); all user-facing strings via `t()` from
   `@/i18n` (Polish UI; hardcoded English is off-convention, but `"Unauthorized"`/
   `"Invalid input"` are intentionally machine-facing); React islands only where
   interactive, hooks in `src/components/hooks/`, no `"use client"`; every route
   `const prerender = false` + local `json()` helper.
3. **Complexity** — thin routes; shared helpers over duplication (`throwDuplicate`,
   `mapWriteError`, `EXPENSE_SELECT`); `Promise.all` for independent fetches;
   comments explain *why* not *what*.
4. **Test/risk coverage** — four tiers: `test:unit` (vitest, **only tier CI
   runs**, `ci.yml:21`), `test:integration` (real Supabase RLS,
   `tests/integration/cross-user-isolation.test.ts` deliberately omits
   `.eq("user_id")` to defeat vacuous passes), `test:schema-safety` (asserts RLS
   enabled/policies by name, CI `migration-safety` job), `test:e2e` (Playwright,
   `// risk:`/`// seed:` headers, Polish role/label locators, no `waitForTimeout`).
   **Integration & e2e do NOT run in CI** — their coverage is a reviewer
   responsibility.
5. **Documentation** — no JSDoc mandate; convention is rationale comments on
   non-obvious decisions (astro.config env loader `astro.config.mjs:13-39`,
   migration headers, test-file attack-assumption headers). Flag why-less magic,
   don't demand boilerplate.
6. **Security & safety** — the strongest convention set: auth guard first line of
   every route (`if (!context.locals.user) ... 401`, `categories.ts:19-21`);
   `PROTECTED_ROUTES` redirect in `middleware.ts:4,18-22`; **defense in depth** —
   services also `.eq("user_id", userId)` even under RLS; **RLS mandatory** —
   every table `enable row level security` + granular per-op/per-role policies
   with `auth.uid() = user_id` in `using` and `with check`
   (`supabase/migrations/20260721120000_create_categories.sql:9-17`,
   `20260722090000_create_expenses.sql:13-25`, `..._create_user_settings.sql:8-17`);
   views need `security_invoker = true` (`20260722090000_*.sql:29-30`); migration
   naming `YYYYMMDDHHmmss_*`, forward-only; **secrets server-only** via
   `astro:env/server` (`astro.config.mjs:77-82`, `supabase.ts:3`) — never
   client-reachable; zod `safeParse` → 400 + `issues`, bounds mirror DB check
   constraints.

**Lint already enforces (don't re-flag):** ESLint flat `strictTypeChecked` +
`stylisticTypeChecked` (`eslint.config.js:15`), Prettier, react-hooks +
react-compiler `error`, `astro/no-set-html-directive: error`, husky + lint-staged
pre-commit. **Reviewer should catch what lint/CI cannot:** missing RLS/
`security_invoker`, missing `.eq("user_id")`, missing auth guard, secrets reaching
client, missing `prerender = false`, hardcoded user-facing strings bypassing
`t()`, logic inlined in routes, DTO drift from `src/types.ts`, new migrations
without schema-safety/isolation tests, wrong Postgres-error-code mapping.

## Code References

- `context/changes/ci-cd-code-review/requirements.md` — the spec (criteria `16-38`, labels `45-48`, retry `50-53`).
- `.github/workflows/ci.yml:3-65` - existing single workflow; conventions to extend.
- `packages/code-reviewer/src/schemas.ts:15-28` - structured-output schema to extend with a `scores` object.
- `packages/code-reviewer/src/prompts.ts:23-27` - prompt builder to extend for PR title/body/diff.
- `packages/code-reviewer/src/agent.ts:33-39` - `Output.object` schema-validated agent.
- `packages/code-reviewer/src/model.ts:20,37` - OpenRouter model + `OPENROUTER_API_KEY`.
- `.claude/skills/10x-impl-review-ci/references/workflow-template.yml:34,52-57,80-122,124-161,216-301` - reference PR-review workflow: label triggers, permissions, untrusted-`.claude/` staging, action invocation, deterministic status gate.
- `.claude/skills/10x-impl-review-ci/SKILL.md:67,96-100,448,488-501` - diff discovery, comment posting, marker-based dedup.
- `src/pages/api/categories.ts:12-57`, `src/pages/api/expenses/[id].ts:21-73` - route→service→error-mapping convention.
- `src/lib/services/expenses.ts:15,25-53,57-83,95-127`, `categories.ts:6-7,27-46` - service layer, validation, error-code mapping.
- `src/middleware.ts:4-22`, `src/lib/supabase.ts:3-23` - auth guard + server-only secrets + cookie sessions.
- `supabase/migrations/20260721120000_create_categories.sql:9-17`, `20260722090000_create_expenses.sql:13-30`, `20260724110000_create_user_settings.sql:8-17` - RLS/`security_invoker` patterns.
- `tests/integration/cross-user-isolation.test.ts:7-19`, `tests/schema-safety/schema-shape.test.ts` - risk-coverage patterns CI does/doesn't run.
- `eslint.config.js:15,57-70`, `astro.config.mjs:13-39,77-82` - auto-enforced rules + secret declaration.

## Architecture Insights

- **This team's GHA convention** (from `context/archive/2026-07-25-deploy-on-merge/`
  and `2026-07-23-testing-migration-deploy-safety-net/`): extend the single
  `ci.yml` rather than proliferate workflows; gate with `needs` + `if`; guard with
  `concurrency`; prefer pinned CLI over marketplace actions; a Phase-0 manual step
  for secrets/labels; a doc-reconciliation phase. A composite action under
  `.github/actions/` is a *new* convention this change introduces — consistent with
  the requirement to keep the main workflow readable.
- **Secret flow convention**: all credentials via `secrets.*` injected as
  step-level `env:`; config files hold no secrets; no `permissions:` scoping used
  yet (this feature introduces the first `permissions:` block).
- **Provider tension to resolve in the plan**: the in-repo engine uses OpenRouter
  (`OPENROUTER_API_KEY`), while the bundled CI template uses Anthropic direct
  (`ANTHROPIC_API_KEY`). Backend B lets either be chosen by swapping the AI-SDK
  provider behind the same schema/glue.
- **Deterministic gate over model-authored verdict**: keep scoring/threshold/label
  logic in code the team owns; the AI returns data, bash decides pass/fail and
  (optionally) posts a merge-blocking commit status.

## Historical Context (from prior changes)

- `context/changes/tool-loop-agent/plan.md` + `.../reviews/impl-review.md` -
  built `packages/code-reviewer/` as modular `ToolLoopAgent` modules "so promptfoo
  evals can drive it later"; APPROVED, 0 critical; `OPENROUTER_API_KEY` is the
  smoke-run secret; `ai@7.0.55`. Eval env and provider changes were out of scope.
- `context/archive/2026-07-25-deploy-on-merge/{change,plan}.md` - added the
  `deploy` job; the template for how this team structures a CI change plan.
- `context/archive/2026-07-23-testing-migration-deploy-safety-net/{plan,plan-brief}.md`
  - added the `migration-safety` gate.
- `context/foundation/prd.md:277`, `prd-v4.md:28,145,171` - CI scoped as "GitHub
  Actions (lint + build + migration safety)"; AI code-review is pure tooling, tied
  to no PRD FR (like deploy-on-merge).
- `context/foundation/test-plan.md:123-131` - the quality-gate taxonomy a
  code-review gate would join. `tech-stack.md:10` - `ci_default_flow:
  auto-deploy-on-merge`.
- `context/foundation/lessons.md` - two lessons (Supabase Auth test retries; Astro
  redirect guards); neither touches CI/review.

## Related Research

- No prior `research.md` exists for this change; this is the first. Related prior
  artifact: `context/changes/tool-loop-agent/plan.md` (the engine this feature
  consumes).

## Open Questions

1. **Provider decision**: OpenRouter (reuse engine as-is, `OPENROUTER_API_KEY`) vs
   Anthropic direct (`ANTHROPIC_API_KEY`, first-party billing/controls)? Backend B
   supports either behind one schema.
2. **Pass/fail threshold policy**: per-criterion floor (e.g. any < 5 fails), a
   weighted average, or security/correctness as hard-fail gates while others are
   advisory? Requirements define the 1–10 scale but not the cutoff.
3. **Merge-blocking or advisory?** Do we post a `statuses: write` commit status
   that blocks merge (needs branch-protection wiring), or only comment + label?
4. **Node version**: engine wants Node ≥24; CI pins 22. Run the composite action
   in its own step/container at 24, or relax the engine's `engines` constraint?
5. **Package wiring**: `packages/code-reviewer` is not in a workspace. How does the
   composite action install/run it — `npm ci` inside the package dir, a workspace,
   or a thin invocation script?
6. **PR-description cost tradeoff** (`requirements.md:9`) — include PR body in the
   prompt or drop it to cut tokens? And how to cap very large diffs.
7. **Branch naming**: requirements say "master"; repo default is `main`. Confirm
   `main` before writing the workflow trigger.
8. **Schema reconciliation**: extend the existing severity-based
   `reviewResultSchema` with a `scores` object, or add a parallel
   `scoredReviewSchema` so the engine's existing severity findings API stays intact?
