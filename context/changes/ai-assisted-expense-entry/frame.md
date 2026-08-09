# Frame Brief: AI-assisted expense entry (S-17) readiness

> Framing step before /10x-plan. This document captures what is _actually_
> at issue, separated from what was initially assumed.

## Reported Observation

Roadmap slice **S-17 "AI-assisted expense entry"** (`context/foundation/roadmap.md:183-196`, PRD FR-025–028) is fully spec'd but marked **`Status: blocked`** and **not** "Ready for `/10x-plan`" (`roadmap.md:211`). The stated blocker: *"external AI provider not yet selected or contracted"* (`roadmap.md:190`), tied to Open Question 1, *"Owner: user... Block: yes"* (`roadmap.md:192,215`).

## Initial Framing (preserved)

- **User's stated cause or approach**: none given — `/10x-frame` was invoked directly on the change-id with no accompanying description. Purely observation-driven.
- **User's proposed direction**: implicit — move the change toward `/10x-plan` (ran `/10x-new` → `/10x-frame` per the suggested path).
- **Pre-dispatch narrowing**: user believes the project **may already have usable AI infra** that satisfies the provider blocker; wants **one bundled plan** (provider + entry/review UI together, not split); picked this change up simply because **S-16 (prerequisite) is done and S-17 is next in roadmap order** — no separate pain/request driving it.

## Dimension Map

The "blocked, not ready to plan" observation could originate at any of these dimensions:

1. **Infra-reuse** — is there already a vetted, provisioned AI provider in this repo the app could point at, or does "provider not selected" mean genuinely zero prior evaluation? ← user's pre-dispatch narrowing
2. **Runtime-fit** — even if a provider is already integrated elsewhere, does that integration actually work inside the app's deployment runtime (Cloudflare Workers/`workerd` via `@astrojs/cloudflare`)?
3. **Decision-ownership/governance** — roadmap explicitly marks this as an "Owner: user, Block: yes" decision; does technical feasibility evidence actually unblock the roadmap, or is a separate, explicit sign-off still required regardless of what the code shows?
4. **Bundling** — should provider selection be planned separately from the entry/review UI, or is it genuinely one slice? — user resolved this directly (one slice).

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| **1. Infra-reuse**: an AI provider is already selected, provisioned, and used in this repo | `packages/code-reviewer/src/model.ts:12-47` builds an OpenRouter model via `@openrouter/ai-sdk-provider` + Vercel `ai` SDK, keyed by `OPENROUTER_API_KEY` (a real, already-provisioned repo secret per `CLAUDE.md` and `.github/workflows/ai-code-review.yml`). Default model `anthropic/claude-sonnet-5`. Archived research (`context/archive/2026-08-08-ci-cd-code-review/research.md:290`) shows this was a deliberate, evaluated choice ("Provider decision: OpenRouter (reuse engine as-is)"), not a placeholder. | **STRONG** |
| **2. Runtime-fit**: that integration works under the app's Cloudflare Workers SSR runtime | `model.ts` is fetch-based (Vercel AI SDK + `@openrouter/ai-sdk-provider`, no Node-only APIs beyond `node:process` for env access) — architecturally portable to Workers. But it currently runs only as a **Node CLI in GitHub Actions** (`packages/code-reviewer` `engines: node >=24`, invoked via `node src/review-pr.ts`), never inside `astro.config.mjs`'s `env.schema` (which only declares `SUPABASE_URL`/`SUPABASE_KEY`, `astro.config.mjs:77-82`) or the deployed worker. No evidence it has been run/tested under `workerd`. | **WEAK** — plausible, unverified |
| **3. Decision-ownership**: technical feasibility alone doesn't satisfy the roadmap's blocker | `roadmap.md:192` explicitly assigns Open Question 1 to "Owner: user... Block: yes" — a governance gate, not a technical one. No file evidence that "provider exists in repo" was previously treated as equivalent to "provider decision made for this feature." Archived research explicitly scoped that engine to CI/PR-review only (`context/archive/2026-08-08-ci-cd-code-review/research.md:72`: "Not..." further scoping omitted from excerpt but confirms narrow original scope). | **STRONG** |
| **4. Bundling**: provider selection and entry/review UI should be planned together | User explicitly chose this. No conflicting evidence — PRD's FR-026/027/028 already describe the toggle, parse, and review steps as one coherent flow (`prd.md:214-219`), and roadmap only lists a single change-id (`ai-assisted-expense-entry`) for all of it. | **STRONG** (by user decision + PRD structure) |

## Narrowing Signals

- User: "the project may already have usable AI infra" → confirmed true, and stronger than expected (not just "some AI code exists" but a specifically evaluated, paid-for OpenRouter integration with a known-good model default).
- User: "plan as one slice" → rules out splitting the change; the frame stays scoped to S-17 as a whole.
- User: "following roadmap order, no separate trigger" → this is routine roadmap progression, not an urgent/ad-hoc request — no reason to rush past the runtime-fit gap.

## Cross-System Convention

The repo's convention for adding a new server-only secret to the deployed app is the `astro:env/server` pattern already used for `SUPABASE_URL`/`SUPABASE_KEY` (`astro.config.mjs:77-82`, `src/lib/supabase.ts`) — declared in `env.schema`, sourced from `.dev.vars` locally / Cloudflare secrets in production. `OPENROUTER_API_KEY` does not yet follow this convention; it currently only exists as a GitHub Actions repo secret consumed by a Node CLI, a different trust boundary and runtime than the deployed worker.

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is**: S-17 is not blocked on "which AI provider" — that evaluation already happened and produced a working answer (OpenRouter + Vercel AI SDK, `anthropic/claude-sonnet-5`). It's blocked on two narrower, faster things: (a) an explicit decision to **reuse that same OpenRouter account for a new purpose** — sending users' personal free-text expense entries, not code diffs — through the app's own runtime, and (b) verifying that integration actually runs under Cloudflare Workers rather than only Node/CI.

The original framing ("no provider decision has been made") overstates the gap. Reframing it this way changes what `/10x-plan` needs to open with: not a provider bake-off, but (1) a short technical spike confirming `@openrouter/ai-sdk-provider` works under `workerd` with secrets wired via `astro:env/server`, and (2) an explicit, recorded decision — informed by the fact that OpenRouter/Anthropic already handle this repo's code-review data — that the same account and data-handling stance are acceptable for personal financial text, satisfying PRD's guardrail that only the submitted free text is sent and nothing is persisted without confirmation (`prd.md:76,225`).

## Confidence

**MEDIUM** — the infra-reuse and decision-ownership hypotheses are STRONG (direct file evidence), but runtime-fit is unverified. Recommend the plan's first phase be a small, time-boxed spike (call OpenRouter via the AI SDK from an Astro API route under `wrangler dev`/`workerd`) before committing to the full entry/review-flow design — if that spike fails, the reframe collapses back toward the original "provider not actually usable" framing and S-17 stays genuinely blocked.

## What Changes for /10x-plan

Treat "provider = OpenRouter, reusing `packages/code-reviewer/src/model.ts`'s approach (not the package itself — different runtime)" as the working default, opening with a Workers-runtime feasibility spike rather than a provider evaluation. Update `roadmap.md`'s S-17 status and Open Question 1 once the spike and the explicit reuse decision are confirmed, so the roadmap reflects reality instead of a stale "not yet selected" blocker. Parsing-accuracy and data-shape open questions (#2, #3) remain non-blocking per PRD/roadmap and can be resolved during planning as already scoped.

## References

- Source files: `context/foundation/roadmap.md:183-217`, `context/foundation/prd.md:210-219,275-279`, `astro.config.mjs:65-83`, `packages/code-reviewer/src/model.ts:1-48`, `packages/code-reviewer/package.json:1-31`
- Related archive: `context/archive/2026-08-08-ci-cd-code-review/research.md`, `context/archive/2026-08-08-ci-cd-code-review/plan-brief.md`
- Related change: `context/changes/ai-assisted-expense-entry/change.md`
