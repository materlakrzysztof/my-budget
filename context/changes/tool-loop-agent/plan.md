# Modular Code-Review Agent on ai-sdk ToolLoopAgent — Implementation Plan

## Overview

Refactor `packages/code-reviewer/src/index.ts` (~166 lines, single file) into a
set of flat, single-responsibility modules and re-implement the reviewer on top
of the AI SDK's `ToolLoopAgent`. The public surface gains a reusable agent
factory (`createReviewAgent`) alongside the existing `reviewCode` convenience
function, so promptfoo evals can drive either the raw agent or a one-shot call in
a future change. Schemas and prompts become first-class, independently importable
and overridable modules.

This change is a behavior-preserving refactor plus one implementation swap
(`generateText` → `ToolLoopAgent.generate`). No new product capabilities, no eval
environment.

## Current State Analysis

Everything lives in `packages/code-reviewer/src/index.ts`:

- **Model factory** (`index.ts:44-56`): `createReviewModel(config)` builds an
  OpenRouter `LanguageModel`, resolving the API key from config or
  `OPENROUTER_API_KEY`, and model id from config / `OPENROUTER_MODEL` /
  `DEFAULT_MODEL`. Throws when no key resolves.
- **Schemas** (`index.ts:59-79`): `severitySchema`, `reviewFindingSchema`,
  `reviewResultSchema` (zod v4) plus inferred `Severity`, `ReviewFinding`,
  `ReviewResult` types.
- **Prompts** (`index.ts:82-110`): `ReviewCodeInput` interface, `SYSTEM_PROMPT`
  constant, `buildReviewPrompt(input)` builder.
- **Reviewer** (`index.ts:119-130`): `reviewCode(input, config)` calls
  `generateText({ model, system, prompt, output: Output.object({ schema }) })`
  and returns the validated `output`.
- **CLI demo** (`index.ts:133-166`): `main()` runs a sample review; guarded by an
  `import.meta.url === process.argv[1]` check so it only fires when the file is
  executed directly.

Package facts (`packages/code-reviewer/package.json`, `tsconfig.json`):

- `ai@7.0.55` (installed matches manifest), `@openrouter/ai-sdk-provider@^3`,
  `zod@^4.4.3`. ESM (`"type": "module"`), Node ≥24, TS 7.
- `main` and `types` both point at `src/index.ts` → the barrel must stay there.
- `scripts.start` / `scripts.dev` run `node ... src/index.ts` → they must be
  repointed once the demo moves out of the barrel.

### Key Discoveries:

- **`ToolLoopAgent` verified API** (`node_modules/ai/docs/03-agents/02-building-agents.mdx`):
  `new ToolLoopAgent({ model, instructions, tools?, output?, stopWhen?, toolChoice? })`.
  Structured output via `output: Output.object({ schema })`; consumed as
  `const { output } = await agent.generate({ prompt })`. `instructions` replaces
  `generateText`'s `system`. Tools may be omitted entirely — the structured-output
  example in the docs uses no tools (`02-building-agents.mdx:296-314`).
- **Reusability is the documented purpose** (`02-building-agents.mdx:8-19`): define
  the agent once, export it, reuse across the app — exactly the promptfoo need.
- **tsconfig constraints** (`tsconfig.json`): `rewriteRelativeImportExtensions` +
  `allowImportingTsExtensions` mean **relative imports must use explicit `.ts`
  specifiers** (e.g. `from "./schemas.ts"`). `verbatimModuleSyntax` means
  **type-only imports must use `import type`**. `erasableSyntaxOnly` forbids
  enums/namespaces (interfaces are fine). `isolatedModules` is on.
- **`Output`** is already imported from `ai` in the current file (`index.ts:17`),
  so the structured-output helper is available and version-matched.

## Desired End State

`packages/code-reviewer/src/` contains flat feature modules:

```
src/
  schemas.ts   — zod schemas + inferred types
  prompts.ts   — ReviewCodeInput, REVIEW_INSTRUCTIONS, buildReviewPrompt()
  model.ts     — CodeReviewerConfig, DEFAULT_MODEL, createReviewModel()
  agent.ts     — createReviewAgent(), reviewCode()
  cli.ts       — the runnable demo (former main())
  index.ts     — pure re-export barrel of the full public surface
```

Verification of the end state:

- `npm run typecheck` passes with zero errors.
- Importing `@10x/code-reviewer` (i.e. `src/index.ts`) still yields every name
  the current file exports: `DEFAULT_MODEL`, `CodeReviewerConfig`,
  `createReviewModel`, `severitySchema`, `reviewFindingSchema`,
  `reviewResultSchema`, `Severity`, `ReviewFinding`, `ReviewResult`,
  `ReviewCodeInput`, `reviewCode` — plus the new `createReviewAgent`,
  `REVIEW_INSTRUCTIONS`, `buildReviewPrompt`.
- `reviewCode(input, config)` returns a schema-validated `ReviewResult`, produced
  through a `ToolLoopAgent`.
- `createReviewAgent(config)` returns a configured `ToolLoopAgent` whose
  `.generate({ prompt })` yields `{ output: ReviewResult }`.
- `npm run start` (repointed to `cli.ts`) runs the sample review unchanged when
  `OPENROUTER_API_KEY` is set.
- Importing the barrel has **no side effects** (no demo execution on import).

## What We're NOT Doing

- **No eval environment**: no promptfoo config, no `promptfooconfig.yaml`, no eval
  scripts or datasets. We only ensure the export surface is eval-friendly.
- **No tools on the agent** in this change. The agent is tool-less but structured
  so a `tools` map can be added later without reshaping callers. No placeholder or
  example tools.
- **No streaming API**, no `useChat`/UI message wiring, no lifecycle-callback
  plumbing beyond what the agent needs.
- **No provider changes**: OpenRouter stays. No AI Gateway migration.
- **No behavior change** to prompts, schema shape, severity levels, or model
  defaults. `REVIEW_INSTRUCTIONS` is the verbatim former `SYSTEM_PROMPT` text.
- **No test framework introduction** — the package has none today; adding one is a
  separate change. Verification is typecheck + manual smoke run.

## Implementation Approach

Refactor in three incremental phases, each ending on a green `npm run typecheck`.
Phases 1 and 2 add the new modules while leaving `index.ts` importing from them
progressively; Phase 3 flips `index.ts` to a pure barrel and relocates the demo.
Because the package has no automated tests, each phase's primary automated gate is
the type checker (strict, `noUncheckedIndexedAccess`), backed by a manual smoke
run at the end.

The one substantive logic change is in `reviewCode`: instead of calling
`generateText({ system, prompt, output })`, it constructs the agent via
`createReviewAgent(config)` and calls `agent.generate({ prompt })`, returning
`output`. The agent carries `instructions` (was `system`) and
`output: Output.object({ schema: reviewResultSchema })`.

## Critical Implementation Details

- **Import extensions**: every relative import between the new modules must carry
  the `.ts` extension (`import { reviewResultSchema } from "./schemas.ts"`) — the
  tsconfig's `rewriteRelativeImportExtensions` rewrites them to `.js` on emit, and
  `node src/*.ts` runs the `.ts` specifiers directly. Omitting the extension fails
  resolution.
- **Type-only imports**: `verbatimModuleSyntax` requires `import type { ... }` for
  types (`LanguageModel`, `ReviewResult`, `CodeReviewerConfig`, `ReviewCodeInput`)
  and `export type { ... }` when re-exporting types through the barrel. Mixing a
  type into a value import is a compile error here.
- **Barrel must stay side-effect-free**: the `import.meta.url === process.argv[1]`
  demo guard must live in `cli.ts`, not `index.ts` — a barrel that also runs a
  demo would execute on any import (including a future eval harness).

## Phase 1: Extract Schemas & Prompts

### Overview

Move the pure data/definitions — zod schemas, inferred types, the input
interface, the instruction constant, and the prompt builder — into `schemas.ts`
and `prompts.ts`. `index.ts` re-imports from them so the public surface is
unchanged. No logic changes.

### Changes Required:

#### 1. Schemas module

**File**: `packages/code-reviewer/src/schemas.ts` (new)

**Intent**: House the review result data model so it can be imported by the agent
and, later, by evals without pulling in model/agent code.

**Contract**: Export `severitySchema`, `reviewFindingSchema`, `reviewResultSchema`
(moved verbatim from `index.ts:59-75`) and the inferred types `Severity`,
`ReviewFinding`, `ReviewResult` (`export type`). Imports `z` from `zod`.

#### 2. Prompts module

**File**: `packages/code-reviewer/src/prompts.ts` (new)

**Intent**: Make the reviewer's instruction text and prompt construction
first-class and swappable for future prompt A/B evals.

**Contract**: Export `ReviewCodeInput` interface (from `index.ts:82-91`),
`REVIEW_INSTRUCTIONS` string constant (verbatim text of the former `SYSTEM_PROMPT`,
`index.ts:93-97`), and `buildReviewPrompt(input: ReviewCodeInput): string` (from
`index.ts:99-110`). No dependency on `ai` or the model.

#### 3. Rewire the barrel to import extracted modules

**File**: `packages/code-reviewer/src/index.ts`

**Intent**: Remove the now-duplicated definitions and source them from the new
modules while keeping every export name identical.

**Contract**: Delete the schema/type/prompt definitions from `index.ts`; add
`export { ... } from "./schemas.ts"` and `export { ... } from "./prompts.ts"`
(with `export type` for the type-only names). `reviewCode` and the CLI continue to
reference `SYSTEM_PROMPT`/`buildReviewPrompt` — update those references to
`REVIEW_INSTRUCTIONS`/the imported builder.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm --prefix packages/code-reviewer run typecheck`
- Barrel still exports all schema/prompt/type names (verified by typecheck of a
  scratch import or by grep of the `export` lines).

#### Manual Verification:

- `src/schemas.ts` and `src/prompts.ts` contain the definitions verbatim (no
  accidental wording/shape drift in `REVIEW_INSTRUCTIONS` or the schemas).

**Implementation Note**: After completing this phase and all automated
verification passes, pause here for manual confirmation from the human before
proceeding.

---

## Phase 2: Model & Agent Modules

### Overview

Extract the model factory into `model.ts`, then introduce `agent.ts` with the
reusable `createReviewAgent` factory and re-home `reviewCode` on top of it. This is
the phase that swaps `generateText` for `ToolLoopAgent`.

### Changes Required:

#### 1. Model module

**File**: `packages/code-reviewer/src/model.ts` (new)

**Intent**: Isolate provider/model construction so the agent and any eval config
can build a model without touching agent logic.

**Contract**: Export `DEFAULT_MODEL` constant, `CodeReviewerConfig` interface (from
`index.ts:31-38`), and `createReviewModel(config?): LanguageModel` (from
`index.ts:44-56`, verbatim behavior: key/model resolution + throw-on-missing-key).
Imports `createOpenRouter` from `@openrouter/ai-sdk-provider`, `type LanguageModel`
from `ai`, `process` from `node:process`.

#### 2. Agent module

**File**: `packages/code-reviewer/src/agent.ts` (new)

**Intent**: Provide the reusable `ToolLoopAgent` and the one-shot convenience
wrapper — the two entry points promptfoo will target later.

**Contract**:
- `createReviewAgent(config?: CodeReviewerConfig & { instructions?: string }): ToolLoopAgent`
  — lazily builds a fresh agent per call: `new ToolLoopAgent({ model: createReviewModel(config), instructions: config?.instructions ?? REVIEW_INSTRUCTIONS, output: Output.object({ schema: reviewResultSchema }) })`.
  No `tools` key (tool-less; structure allows adding one later).
- `reviewCode(input: ReviewCodeInput, config?: CodeReviewerConfig & { instructions?: string }): Promise<ReviewResult>`
  — builds the agent via `createReviewAgent(config)`, calls
  `const { output } = await agent.generate({ prompt: buildReviewPrompt(input) })`,
  returns `output`.

  Imports `ToolLoopAgent`, `Output` from `ai`; `createReviewModel`,
  `CodeReviewerConfig` from `./model.ts`; `reviewResultSchema`, `ReviewResult`
  from `./schemas.ts`; `REVIEW_INSTRUCTIONS`, `buildReviewPrompt`, `ReviewCodeInput`
  from `./prompts.ts`. Since the agent is tool-less, the default `stopWhen` yields
  a single generation producing the structured `output` — no loop-control override
  needed.

#### 3. Point the barrel at model + agent modules

**File**: `packages/code-reviewer/src/index.ts`

**Intent**: Remove the model factory and old `generateText`-based `reviewCode` from
the barrel; source them from the new modules.

**Contract**: Delete `createReviewModel`, `CodeReviewerConfig`, `DEFAULT_MODEL`, and
the old `reviewCode` body from `index.ts`; add re-exports from `./model.ts` and
`./agent.ts` (including new `createReviewAgent`). The CLI's `reviewCode` reference
now resolves through the barrel/agent module.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm --prefix packages/code-reviewer run typecheck`
- No remaining `generateText` import in the package: grep for `generateText`
  returns nothing under `src/`.

#### Manual Verification:

- With `OPENROUTER_API_KEY` set, a manual call to `reviewCode` on the sample
  snippet returns a populated `ReviewResult` (findings surface the off-by-one /
  uninitialized-`total` bugs), confirming the `ToolLoopAgent` path works
  end-to-end.
- `createReviewAgent().generate({ prompt })` returns `{ output }` matching the
  schema.

**Implementation Note**: After completing this phase and all automated
verification passes, pause here for manual confirmation from the human before
proceeding.

---

## Phase 3: Barrel & CLI

### Overview

Reduce `index.ts` to a pure re-export barrel and relocate the runnable demo into
`cli.ts`, repointing the package scripts. This makes the barrel side-effect-free
(safe for eval import) while keeping the smoke-run available.

### Changes Required:

#### 1. CLI module

**File**: `packages/code-reviewer/src/cli.ts` (new)

**Intent**: Keep the runnable sample review, but out of the import path.

**Contract**: Move `main()` and the `import.meta.url === process.argv[1]` guard
(from `index.ts:133-166`) into `cli.ts`. It imports `reviewCode` from
`./agent.ts` (or the barrel) and `process` from `node:process`. Behavior verbatim.

#### 2. Barrel becomes pure re-exports

**File**: `packages/code-reviewer/src/index.ts`

**Intent**: Single, side-effect-free public surface aggregating all modules.

**Contract**: `index.ts` contains only `export` / `export type` lines re-exporting
from `./schemas.ts`, `./prompts.ts`, `./model.ts`, `./agent.ts`. No `main()`, no
`import.meta` guard, no top-level statements. A module-level doc comment describing
the package may remain.

#### 3. Repoint package scripts

**File**: `packages/code-reviewer/package.json`

**Intent**: Run the demo from its new home.

**Contract**: Update `scripts.start` and `scripts.dev` to target `src/cli.ts`
instead of `src/index.ts` (keep the `--env-file-if-exists` / `--watch` flags).
`main`/`types` remain `src/index.ts`.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm --prefix packages/code-reviewer run typecheck`
- Build passes: `npm --prefix packages/code-reviewer run build`
- `src/index.ts` contains no executable top-level statements (grep: no
  `import.meta`, no `main(` in `index.ts`).

#### Manual Verification:

- `npm --prefix packages/code-reviewer run start` (with `OPENROUTER_API_KEY`) runs
  the sample review and prints the JSON result, matching prior behavior.
- Importing the barrel in a scratch file logs nothing / triggers no review —
  confirming zero import-time side effects.

**Implementation Note**: After completing this phase and all automated
verification passes, pause here for manual confirmation from the human that the
smoke run succeeded.

---

## Testing Strategy

### Unit Tests:

- None added in this change (package has no test harness today; out of scope).
  The type checker under `strict` + `noUncheckedIndexedAccess` is the automated
  guardrail.

### Integration Tests:

- Deferred to the future promptfoo eval change; this plan only ensures the export
  surface (`createReviewAgent`, `reviewCode`) is eval-drivable.

### Manual Testing Steps:

1. Set `OPENROUTER_API_KEY` in `packages/code-reviewer/.env`.
2. `npm --prefix packages/code-reviewer run start` → confirm a JSON `ReviewResult`
   prints with findings for the buggy `sum` sample.
3. In a scratch `.ts`, `import { createReviewAgent, reviewCode } from "./src/index.ts"`
   and confirm no side-effect output on import; call `createReviewAgent().generate({ prompt: "..." })`
   and confirm `{ output }` matches the schema.
4. Confirm every legacy import name still resolves from the barrel.

## Performance Considerations

Negligible. `createReviewAgent` builds a fresh agent per call; agent construction
is cheap (no network). Memoization can be added later if a hot path emerges. The
tool-less agent performs a single model generation, identical in cost to the
current `generateText` call.

## Migration Notes

No data or consumer migration. The barrel preserves all existing export names, so
any current importer of `@10x/code-reviewer` keeps working. The only externally
visible change is `scripts.start`/`scripts.dev` now pointing at `src/cli.ts`.

## References

- Change identity: `context/changes/tool-loop-agent/change.md`
- Source under refactor: `packages/code-reviewer/src/index.ts:1-166`
- AI SDK skill: `packages/code-reviewer/.claude/skills/ai-sdk/SKILL.md`
- `ToolLoopAgent` API (version-matched): `packages/code-reviewer/node_modules/ai/docs/03-agents/01-overview.mdx`, `.../02-building-agents.mdx`
- tsconfig constraints: `packages/code-reviewer/tsconfig.json`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Extract Schemas & Prompts

#### Automated

- [x] 1.1 Type checking passes: `npm --prefix packages/code-reviewer run typecheck` — 765bf74
- [x] 1.2 Barrel still exports all schema/prompt/type names — 765bf74

#### Manual

- [x] 1.3 schemas.ts / prompts.ts contain definitions verbatim (no wording/shape drift) — 765bf74

### Phase 2: Model & Agent Modules

#### Automated

- [x] 2.1 Type checking passes: `npm --prefix packages/code-reviewer run typecheck`
- [x] 2.2 No remaining `generateText` import under `src/`

#### Manual

- [x] 2.3 reviewCode on sample snippet returns populated ReviewResult via ToolLoopAgent
- [x] 2.4 createReviewAgent().generate({ prompt }) returns schema-matching `{ output }`

### Phase 3: Barrel & CLI

#### Automated

- [ ] 3.1 Type checking passes: `npm --prefix packages/code-reviewer run typecheck`
- [ ] 3.2 Build passes: `npm --prefix packages/code-reviewer run build`
- [ ] 3.3 index.ts has no executable top-level statements (no `import.meta` / `main(`)

#### Manual

- [ ] 3.4 `npm run start` runs sample review and prints JSON result
- [ ] 3.5 Importing the barrel triggers zero import-time side effects
