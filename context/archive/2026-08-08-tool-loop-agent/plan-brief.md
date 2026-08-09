# Modular Code-Review Agent on ai-sdk ToolLoopAgent — Plan Brief

> Full plan: `context/changes/tool-loop-agent/plan.md`

## What & Why

Refactor `packages/code-reviewer/src/index.ts` from a single-file `generateText`
reviewer into modular code built on the AI SDK's `ToolLoopAgent`. The point is
reusability: a `createReviewAgent()` factory the app and future promptfoo evals
can both drive, with schemas and prompts extracted into their own importable,
overridable modules.

## Starting Point

One ~166-line file holds everything: the OpenRouter model factory, three zod
schemas + inferred types, the `SYSTEM_PROMPT` + prompt builder, a `reviewCode()`
that calls `generateText({ output: Output.object(...) })`, and a
run-when-invoked-directly CLI demo. `main`/`types` point at this file.

## Desired End State

`src/` holds flat modules — `schemas.ts`, `prompts.ts`, `model.ts`, `agent.ts`,
`cli.ts` — with `index.ts` reduced to a side-effect-free re-export barrel. The
reviewer runs through a tool-less `ToolLoopAgent`; `createReviewAgent(config)` and
`reviewCode(input, config)` are both public. Every existing export name still
resolves, and importing the package runs no demo.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Tools on agent | Tool-less, tool-ready structure | Preserves current behavior with no fabricated capability; keeps future evals deterministic. | Plan |
| Module layout | Flat feature modules | Simple and discoverable for a small single-package scope. | Plan |
| Export surface | Factory + convenience fn | promptfoo can call the raw agent or a one-shot `reviewCode`. | Plan |
| Back-compat | Re-export all names via barrel | No breakage for current importers of the private package. | Plan |
| CLI demo | Move to `src/cli.ts` | Keeps the barrel import-clean and side-effect-free. | Plan |
| Instantiation | Lazy factory per config | No import-time env reads; test/eval configs inject cleanly. | Plan |
| Prompts | Constants + builder, overridable | Instruction text becomes swappable for prompt A/B evals. | Plan |

## Scope

**In scope:** module split; `ToolLoopAgent`-based reviewer; `createReviewAgent`
factory; prompt/instruction override; CLI relocation + script repoint; full
back-compat barrel.

**Out of scope:** eval environment (promptfoo config/datasets); any agent tools;
streaming/UI wiring; provider changes; new test framework; prompt/schema behavior
changes.

## Architecture / Approach

`schemas.ts` (data model) ← `agent.ts` → `model.ts` (OpenRouter factory) and
`prompts.ts` (instructions + builder). `agent.ts` exposes `createReviewAgent()`
(builds `new ToolLoopAgent({ model, instructions, output: Output.object({ schema }) })`)
and `reviewCode()` (calls `agent.generate({ prompt })`, returns `output`).
`cli.ts` holds the demo; `index.ts` re-exports everything.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Extract schemas & prompts | `schemas.ts` + `prompts.ts`, barrel rewired | Verbatim-move drift in instruction text / schema |
| 2. Model & agent modules | `model.ts` + `agent.ts`; `generateText`→`ToolLoopAgent` | Agent+structured-output wiring / `.ts` import extensions |
| 3. Barrel & CLI | pure barrel, `cli.ts`, repointed scripts | Leftover side-effects in barrel; wrong script paths |

**Prerequisites:** `OPENROUTER_API_KEY` for the manual smoke run; `ai@7.0.55`
already installed.
**Estimated effort:** ~1 session across 3 small phases.

## Open Risks & Assumptions

- tsconfig requires `.ts` import extensions and `import type` for type-only
  imports — easy to trip on, called out in Critical Implementation Details.
- No automated tests exist; correctness rests on typecheck + a manual smoke run.
- Assumes tool-less `ToolLoopAgent` with `output` performs a single generation
  (matches the docs' structured-output example).

## Success Criteria (Summary)

- `npm run typecheck` and `npm run build` pass; barrel exports every legacy name
  plus `createReviewAgent`.
- `reviewCode` and `createReviewAgent().generate()` return schema-valid results
  through the `ToolLoopAgent`.
- Importing the package has zero side effects; `npm run start` still runs the demo.
