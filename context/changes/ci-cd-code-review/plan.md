# CI/CD AI Code-Review Workflow Implementation Plan

## Overview

Add the repository's first pull-request code-review CI. On every PR to `main`, a
GitHub Actions job invokes a **composite action** that assembles the PR title +
body + diff, makes one structured AI call scoring the change on six 1–10 criteria
(implementation correctness, idiomaticity, complexity, test/risk coverage,
documentation, security & safety), then a **deterministic gate** decides pass/fail
by a per-criterion floor, posts a summary PR comment, and applies
`ai-cr:passed` / `ai-cr:failed` labels. Reviews re-run on demand when the
`ai-cr:review` label is added.

The AI engine is the existing `@10x/code-reviewer` package
(`packages/code-reviewer/`), extended with a PR-scoring path. The composite
action, its diff/comment/label glue, and the new workflow are the net-new CI
surface.

## Current State Analysis

- **`packages/code-reviewer/` is ~80% of the engine.** A side-effect-free,
  schema-validated reviewer on the Vercel AI SDK (`ToolLoopAgent` +
  `Output.object`) via OpenRouter. Two gaps for this feature:
  - Output schema is severity-based findings, not six 1–10 scores
    (`packages/code-reviewer/src/schemas.ts:25-28`).
  - Prompt input is a single code blob, not `{prTitle, prBody, diff}`
    (`packages/code-reviewer/src/prompts.ts:30`).
  - Provider is OpenRouter, `OPENROUTER_API_KEY` required, default model
    `anthropic/claude-sonnet-5` (`packages/code-reviewer/src/model.ts:20,37`).
  - The package is **not** in a workspace (root `package.json` declares none) and
    targets **Node ≥24**; CI pins **Node 22** (`.nvmrc:1`).
- **`.github/workflows/ci.yml` is the only workflow.** Triggers `push` +
  `pull_request` to `[main]`; jobs `ci`, `migration-safety`, `deploy`. **No
  `permissions:` block anywhere**, no `gh`/`GITHUB_TOKEN` usage yet. Secrets:
  `SUPABASE_*`, `CLOUDFLARE_*` — no `OPENROUTER_API_KEY`.
- **No `.github/actions/**` composite exists** — this change introduces that
  convention.
- **No `ai-cr:*` labels provisioned.**
- Requirements say "PR to master"; the repo's default branch is **`main`** (no
  `master` exists). Plan targets `main`.

### Key Discoveries:

- Structured output is enforced by `Output.object({ schema })`
  (`packages/code-reviewer/src/agent.ts:37`) — a new schema plugs straight in.
- Prompt text is a first-class swappable value (`prompts.ts:23-27`) — a new
  builder can sit alongside the existing one without touching agent internals.
- Reference CI mechanics to copy from the bundled skill template
  (`.claude/skills/10x-impl-review-ci/references/workflow-template.yml`,
  `.../SKILL.md`): `fetch-depth: 0` + three-dot diff, hidden-marker comment
  dedup, deterministic gate step separate from the AI step, label-event triggers.
- Label mutation via `gh` hits the **issues** endpoint → job needs
  `issues: write`, not just `pull-requests: write`.
- App conventions the reviewer judges against are catalogued in
  `context/changes/ci-cd-code-review/research.md` (lines 170-224) and feed the
  review instruction text (Phase 2).

## Desired End State

Opening or updating a PR against `main` triggers an `AI Code Review` check that,
within one job:

1. Posts (or updates, never duplicates) a PR comment with the six scores, an
   overall summary, and per-criterion notes.
2. Applies exactly one of `ai-cr:passed` (green) / `ai-cr:failed` (red),
   removing the other.
3. Exits non-zero when any criterion is below the floor, so the check shows red
   (advisory now — merge-blocking is a later branch-protection toggle, no code
   change needed to promote).

Adding the `ai-cr:review` label to a PR re-runs the review; other label changes
do not.

**Verification:** a deliberately weak PR earns a low score, a red check, an
`ai-cr:failed` label, and a scored comment; re-adding `ai-cr:review` re-runs it;
a clean PR earns `ai-cr:passed` and a green check.

## What We're NOT Doing

- **Not** merge-blocking via branch protection in this change (advisory red
  check only; block-ready via non-zero exit — turning it into a required check is
  a repo-settings action outside this plan).
- **Not** using `anthropics/claude-code-action@v1` (Backend A) — rejected in
  research as heavyweight and resistant to composite-action wrapping.
- **Not** switching the engine to Anthropic-direct — staying on OpenRouter to
  reuse `model.ts` as-is.
- **Not** adopting `packages/*` into a root workspace or changing root
  `package.json` — the action installs the package in its own step.
- **Not** scoring "business alignment" / "architectural fit" (parked in
  requirements — need broader context).
- **Not** re-flagging what ESLint/Prettier/`test:unit` already enforce — the
  review instructions steer the model to what CI *cannot* catch.
- **Not** modifying `ci.yml`'s existing jobs or triggers.

## Implementation Approach

Backend B from research: a direct structured model call inside a composite
action, maximally reusing `packages/code-reviewer/`. The AI returns **data**
(six integers + summary + notes); **bash the team owns** decides pass/fail and
performs all side effects (comment, labels, exit code). This keeps the rubric,
threshold, and labels fully deterministic and version-controlled.

Decisions locked during planning:

| Area          | Choice                                                                 |
| ------------- | --------------------------------------------------------------------- |
| Provider      | OpenRouter, reuse `model.ts` + `OPENROUTER_API_KEY`                    |
| Threshold     | Per-criterion floor — fail if **any** criterion `< FLOOR`             |
| Enforcement   | Advisory now (non-zero exit → red check), block-ready, no BP wiring   |
| Cost          | Include PR body; cap/truncate diff past a byte budget with a note      |
| Schema        | **Parallel** `scoredReviewSchema` — existing findings API untouched   |
| Packaging     | `npm ci` inside `packages/code-reviewer` at Node 24 in the action     |
| Workflow file | Separate `ai-code-review.yml` (not `ci.yml`)                           |

The per-criterion floor is a single workflow input (default proposed below) so
tuning it never touches code.

## Critical Implementation Details

- **Diff must use the three-dot range** `git diff origin/<base>...HEAD` after
  `checkout` with `fetch-depth: 0`; the two-dot form pulls in unrelated base
  commits. Base ref comes from `github.event.pull_request.base.ref`.
- **Comment dedup** relies on an invisible HTML marker
  (`<!-- ai-code-review -->`) as the first line of the body; the update step
  lists PR comments via `gh api --paginate`, finds the marker, and edits that
  comment id rather than posting a new one.
- **Gate step is separate from the AI call.** The scoring step writes JSON to a
  file / step output and always succeeds if the model responded; a later bash
  step parses scores, decides pass/fail, and owns the process exit code. This
  keeps model/transport errors distinguishable from a genuine review failure.
- **Node reconciliation:** the action runs its own `setup-node@v4` with
  `node-version: 24` scoped to its steps; it does not disturb the Node-22
  `ci`/`migration-safety` jobs (separate workflow anyway).
- **Retry guard:** the workflow triggers on `labeled` for all label adds, but the
  job `if:` runs only when `github.event.action != 'labeled'` OR
  `github.event.label.name == 'ai-cr:review'`. Remove `ai-cr:review` at the end
  of a run so it is immediately re-addable.

## Phase 1: Prerequisites & Provisioning

### Overview

Provision the secret and labels the workflow depends on, and confirm the target
branch. No application code. Mirrors the team's Phase-0 precedent from the
deploy-on-merge change.

### Changes Required:

#### 1. Repository secret

**Intent**: Give CI an OpenRouter key so the review call can authenticate.

**Contract**: Repo secret `OPENROUTER_API_KEY` present in GitHub Actions secrets.
Provisioned via `gh secret set OPENROUTER_API_KEY` or the repo settings UI (not
committed).

#### 2. Labels

**Intent**: Create the three labels the gate and retry mechanism reference so
`gh pr edit --add-label` never fails on a missing label.

**Contract**: Labels `ai-cr:passed` (green `2ea043`), `ai-cr:failed` (red
`d73a4a`), `ai-cr:review` (any neutral color) exist. Created idempotently:
`gh label create ai-cr:passed --color 2ea043 --force` (and the other two).

#### 3. Branch confirmation

**Intent**: Confirm the workflow trigger targets the real default branch.

**Contract**: Default branch is `main` (already verified — no `master` exists).
Documented in the requirements reconciliation (Phase 5).

### Success Criteria:

#### Automated Verification:

- Secret exists: `gh secret list` shows `OPENROUTER_API_KEY`
- Labels exist: `gh label list` shows `ai-cr:passed`, `ai-cr:failed`,
  `ai-cr:review`

#### Manual Verification:

- OpenRouter key is valid (has credit / correct scope) for the chosen model

**Implementation Note**: After completing this phase and all automated
verification passes, pause here for manual confirmation before proceeding.

---

## Phase 2: Extend `@10x/code-reviewer` with a PR-scoring path

### Overview

Add a parallel scored-review surface to the package: a scores schema, a PR prompt
builder, an agent function, and a thin CLI entrypoint the composite action calls.
The existing severity-findings API (`reviewCode`, `reviewResultSchema`) stays
byte-for-byte intact.

### Changes Required:

#### 1. Scored schema

**File**: `packages/code-reviewer/src/schemas.ts`

**Intent**: Describe the six-criterion scored result the gate consumes, as a new
schema separate from the findings schema.

**Contract**: Export `scoredReviewSchema` (and inferred `ScoredReview` type) with:
`summary: string`; a `scores` object of six fields
`{ correctness, idiomaticity, complexity, testRiskCoverage, documentation,
security }`, each `z.number().int().min(1).max(10)` with a `.describe()` naming
the criterion; and `notes` — a short per-criterion rationale, e.g. an array of
`{ criterion, comment }` or a parallel object — for the PR comment body. Do not
modify `reviewResultSchema`.

#### 2. PR prompt builder + instructions

**File**: `packages/code-reviewer/src/prompts.ts`

**Intent**: Build the review prompt from PR metadata and diff, and steer the
model toward what this repo's CI cannot already catch.

**Contract**: Export `PullRequestReviewInput` (`{ prTitle: string; prBody?:
string; diff: string }`) and `buildPullRequestReviewPrompt(input)` returning a
string that embeds title, optional body, and a fenced diff. Export
`PR_REVIEW_INSTRUCTIONS` describing the six criteria with their 1–10 anchors
(from `requirements.md:16-38`) and the repo conventions to judge against +
what NOT to re-flag (condensed from `research.md:170-224`: RLS/`security_invoker`,
`.eq("user_id")` defense-in-depth, auth guard first line, `prerender = false`,
`t()` for user-facing strings, thin routes, DTO drift, Postgres-error-code
mapping; do NOT re-flag ESLint/Prettier-enforced style). Leave existing
`REVIEW_INSTRUCTIONS` / `buildReviewPrompt` unchanged.

#### 3. Agent function

**File**: `packages/code-reviewer/src/agent.ts`

**Intent**: Provide a one-shot call that returns a schema-validated scored review.

**Contract**: Export `reviewPullRequest(input: PullRequestReviewInput, config?:
ReviewAgentConfig): Promise<ScoredReview>` — builds a `ToolLoopAgent` with
`instructions: config.instructions ?? PR_REVIEW_INSTRUCTIONS` and
`output: Output.object({ schema: scoredReviewSchema })`, generates with
`buildPullRequestReviewPrompt(input)`, returns `output`. Mirror the existing
`reviewCode` shape.

#### 4. Barrel export

**File**: `packages/code-reviewer/src/index.ts`

**Intent**: Make the new surface importable.

**Contract**: Re-export `reviewPullRequest`, `scoredReviewSchema`, `ScoredReview`,
`PullRequestReviewInput`, `buildPullRequestReviewPrompt`, `PR_REVIEW_INSTRUCTIONS`
alongside existing exports. (Verify the barrel path — add exports wherever the
package currently re-exports its public API.)

#### 5. Scoring entrypoint (CI-facing)

**File**: `packages/code-reviewer/src/review-pr.ts` (new)

**Intent**: A thin, runnable script the composite action calls: read PR title,
body, and diff from the environment / a file, call `reviewPullRequest`, print the
`ScoredReview` as JSON to stdout, exit non-zero only on transport/validation
error (never on a low score — the gate owns that).

**Contract**: Reads inputs from env vars (e.g. `PR_TITLE`, `PR_BODY`, and a diff
file path `PR_DIFF_FILE`) so large diffs aren't passed as argv. Emits a single
JSON object matching `scoredReviewSchema` on stdout; diagnostics on stderr.
Guarded by the direct-invocation check pattern from `cli.ts:48-50`. Add an npm
script (e.g. `"review:pr": "node src/review-pr.ts"`) in the package
`package.json`.

#### 6. Unit tests

**File**: `packages/code-reviewer/` test location (match existing test setup)

**Intent**: Lock the schema bounds and prompt assembly without hitting the network.

**Contract**: Tests assert: `scoredReviewSchema` rejects out-of-range (0, 11) and
non-integer scores and accepts a valid object; `buildPullRequestReviewPrompt`
includes title, body, and diff and omits the body cleanly when absent. Model call
itself is not exercised in unit tests (network-free).

### Success Criteria:

#### Automated Verification:

- Package type-checks / lints: `npm run lint` in `packages/code-reviewer`
- Unit tests pass: `npm test` (or the package's test script) in
  `packages/code-reviewer`
- Entrypoint runs against a fixture and emits valid JSON:
  `PR_TITLE=... PR_DIFF_FILE=... node src/review-pr.ts` with
  `OPENROUTER_API_KEY` set (smoke, run manually)

#### Manual Verification:

- A real sample PR diff produces sensible, correctly-bounded scores and a useful
  summary/notes
- Existing `reviewCode` demo (`npm run start`) still works unchanged

**Implementation Note**: After completing this phase and all automated
verification passes, pause here for manual confirmation before proceeding.

---

## Phase 3: Composite action

### Overview

Create `.github/actions/ai-code-review/` — a composite action that assembles the
PR input, runs the scoring entrypoint at Node 24, applies the deterministic gate,
and performs all side effects (comment, labels, exit code).

### Changes Required:

#### 1. Composite action definition

**File**: `.github/actions/ai-code-review/action.yml` (new)

**Intent**: Encapsulate the whole review so the workflow stays a thin caller.

**Contract**: `runs.using: "composite"`. Inputs: `github-token` (for `gh`),
`openrouter-api-key`, `criterion-floor` (default proposed: `5`),
`diff-max-bytes` (default proposed: a sane cap, e.g. `200000`), optional `model`.
Steps below run as `shell: bash` with `env` wiring `GH_TOKEN` and
`OPENROUTER_API_KEY`.

#### 2. Diff & metadata assembly (step)

**Intent**: Produce the model input, bounded for cost.

**Contract**: Requires the workflow to checkout with `fetch-depth: 0`. Fetch base
ref, compute `git diff origin/<base.ref>...HEAD` into a file; truncate to
`diff-max-bytes` and append a visible `…[diff truncated]…` note when capped. Get
title/body via `gh pr view "$PR_NUMBER" --json title,body`. Export `PR_TITLE`,
`PR_BODY`, `PR_DIFF_FILE` for the scoring step.

#### 3. Scoring (step)

**Intent**: Run the engine and capture structured scores.

**Contract**: `setup-node@v4` with `node-version: 24`; `npm ci` in
`packages/code-reviewer`; run the `review:pr` entrypoint; capture stdout JSON to a
file / step output. This step fails only on transport/validation error.

#### 4. Deterministic gate (step)

**Intent**: Turn scores into a verdict the team owns.

**Contract**: Parse the six integers (e.g. `jq`); `PASS` iff **every** criterion
`>= criterion-floor`, else `FAIL`. Emit `verdict` as a step output. No model
involvement.

#### 5. Comment (step)

**Intent**: Communicate the result once, updating in place.

**Contract**: Render a markdown body led by the hidden marker
`<!-- ai-code-review -->`: a scores table (criterion → score), overall verdict,
summary, and per-criterion notes; flag diff truncation if it occurred. Dedup:
`gh api --paginate repos/{owner}/{repo}/issues/{pr}/comments`, find the marker,
`gh api --method PATCH` that comment if present else `gh pr comment --body-file`.

#### 6. Labels (step)

**Intent**: Reflect the verdict as a single mutually-exclusive label and clear
the retry trigger.

**Contract**: On `PASS`: `gh pr edit "$PR" --add-label ai-cr:passed
--remove-label ai-cr:failed`; on `FAIL`: the inverse. Always
`--remove-label ai-cr:review` so it can be re-added to retry.

#### 7. Exit code (step)

**Intent**: Make the check red on failure without blocking on transport errors.

**Contract**: `exit 1` when `verdict == FAIL`, else `exit 0`. Runs after comment
+ labels so side effects always land regardless of verdict.

### Success Criteria:

#### Automated Verification:

- Action YAML is valid: `actionlint .github/actions/ai-code-review/action.yml`
  (or workflow-level actionlint in Phase 4)
- `jq`/bash gate logic unit-tested via a fixture JSON (any-below-floor → FAIL;
  all-at-or-above → PASS) — a small bats/bash test or a checked scratch run

#### Manual Verification:

- Run end-to-end on a scratch PR: comment appears with a scores table; correct
  label applied; re-running updates the same comment (no duplicate)
- Truncation note appears for an artificially large diff
- Transport error (e.g. bad key) surfaces as a step failure distinct from a
  `FAIL` verdict

**Implementation Note**: After completing this phase and all automated
verification passes, pause here for manual confirmation before proceeding.

---

## Phase 4: Workflow wiring

### Overview

Add a dedicated workflow that triggers the composite action on PRs to `main` and
on `ai-cr:review` label adds, with the first scoped `permissions:` block in the
repo. Kept separate from `ci.yml` so label events don't re-run lint/build/tests.

### Changes Required:

#### 1. New workflow

**File**: `.github/workflows/ai-code-review.yml` (new)

**Intent**: Trigger and permission-scope the review.

**Contract**:
- `name: AI Code Review`.
- `on: pull_request: { branches: [main], types: [opened, synchronize, reopened,
  labeled] }`.
- Workflow-level `permissions: {}`; job-level `permissions: { pull-requests:
  write, issues: write, contents: read }`.
- Job `if:` guard: run when `github.event.action != 'labeled'` OR
  `github.event.label.name == 'ai-cr:review'`.
- Optional `concurrency` per-PR to cancel superseded runs.
- Steps: `actions/checkout@v4` with `fetch-depth: 0`, then
  `uses: ./.github/actions/ai-code-review` passing `github-token:
  ${{ secrets.GITHUB_TOKEN }}`, `openrouter-api-key:
  ${{ secrets.OPENROUTER_API_KEY }}`, and the floor/cap inputs.

### Success Criteria:

#### Automated Verification:

- Workflow parses: `actionlint .github/workflows/ai-code-review.yml`
- On a test PR, the `AI Code Review` check is created and runs the action

#### Manual Verification:

- New PR to `main` → review runs, comments, labels, and sets check status
- Adding `ai-cr:review` re-runs; adding any other label does **not**
- Pushing a new commit (`synchronize`) re-runs and updates the same comment
- `ci.yml` jobs are unaffected by label events

**Implementation Note**: After completing this phase and all automated
verification passes, pause here for manual confirmation before proceeding.

---

## Phase 5: Docs reconciliation

### Overview

Bring project docs and env samples in line with the new feature and resolve the
"master" → `main` wording.

### Changes Required:

#### 1. CLAUDE.md CI section

**File**: `CLAUDE.md`

**Intent**: Document the new PR review workflow alongside the existing CI
description.

**Contract**: Add a short subsection under `## CI` describing
`ai-code-review.yml`, the `OPENROUTER_API_KEY` secret, the `ai-cr:*` labels, the
per-criterion floor gate, and the `ai-cr:review` retry.

#### 2. Env sample

**File**: `packages/code-reviewer/.env.example`

**Intent**: Keep the sample current (verify existing keys; no new engine env var
is introduced — provider stays OpenRouter).

**Contract**: Confirm `OPENROUTER_API_KEY` (and optional `OPENROUTER_MODEL`) are
present and documented; add a comment noting CI consumes the same key via repo
secret.

#### 3. Requirements note

**File**: `context/changes/ci-cd-code-review/requirements.md`

**Intent**: Record that "master" resolves to `main`.

**Contract**: A one-line note (or inline correction) that the workflow targets
`main`, the repo's default branch.

### Success Criteria:

#### Automated Verification:

- Markdown lints/formats clean: `npm run format` (Prettier over `*.md`)

#### Manual Verification:

- CLAUDE.md CI section accurately reflects the shipped workflow, labels, and
  secret

**Implementation Note**: After completing this phase and all automated
verification passes, this change is complete.

---

## Testing Strategy

### Unit Tests:

- `scoredReviewSchema` bounds: rejects 0 / 11 / non-integer; accepts valid.
- `buildPullRequestReviewPrompt`: includes title/body/diff; omits body cleanly.
- Gate bash logic: any criterion below floor → FAIL; all at/above → PASS
  (fixture JSON).

### Integration Tests:

- Scoring entrypoint against a real sample diff with a live key (smoke) → valid,
  in-range JSON.
- Full composite action on a scratch PR: comment + labels + check status; retry
  via `ai-cr:review`; comment update (no duplicate) on `synchronize`.

### Manual Testing Steps:

1. Open a PR with a deliberately weak change → expect low score(s), red check,
   `ai-cr:failed`, scored comment.
2. Open a clean PR → expect `ai-cr:passed`, green check.
3. Add `ai-cr:review` to a failed PR → expect a re-run updating the same comment.
4. Add an unrelated label → expect no re-run.
5. Force a large diff → expect a truncation note in the comment.
6. Temporarily set a bad key → expect a step failure distinct from a FAIL verdict.

## Performance Considerations

- One model call per run; cost bounded by `diff-max-bytes` cap and the PR-body
  include decision. Per-PR `concurrency` cancels superseded runs to avoid stacking
  calls on rapid pushes.
- Node 24 `npm ci` in the package adds install time to the job; isolated to this
  workflow, does not slow `ci.yml`.

## Migration Notes

- No data migration. New repo secret + three labels are the only stateful
  provisioning (Phase 1).
- Promoting from advisory to merge-blocking later requires only enabling
  `AI Code Review` as a required check in branch protection — no code change.

## References

- Requirements: `context/changes/ci-cd-code-review/requirements.md`
- Research: `context/changes/ci-cd-code-review/research.md`
- Engine to extend: `packages/code-reviewer/src/{schemas,prompts,agent,model,cli}.ts`
- CI conventions: `.github/workflows/ci.yml`
- Reference CI mechanics:
  `.claude/skills/10x-impl-review-ci/references/workflow-template.yml`,
  `.claude/skills/10x-impl-review-ci/SKILL.md`
- App conventions the reviewer judges: `research.md:170-224`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step
> lands. Do not rename step titles.

### Phase 1: Prerequisites & Provisioning

#### Automated

- [x] 1.1 Secret exists: `gh secret list` shows `OPENROUTER_API_KEY` — 8a3792f
- [x] 1.2 Labels exist: `gh label list` shows `ai-cr:passed`, `ai-cr:failed`, `ai-cr:review` — 8a3792f

#### Manual

- [x] 1.3 OpenRouter key is valid for the chosen model — 8a3792f

### Phase 2: Extend `@10x/code-reviewer` with a PR-scoring path

#### Automated

- [x] 2.1 Package type-checks / lints — c5cfc92
- [x] 2.2 Unit tests pass — c5cfc92
- [x] 2.3 Entrypoint emits valid JSON against a fixture (smoke) — c5cfc92

#### Manual

- [x] 2.4 Real sample PR diff produces sensible, in-range scores + summary/notes — c5cfc92
- [x] 2.5 Existing `reviewCode` demo still works unchanged — c5cfc92

### Phase 3: Composite action

#### Automated

- [x] 3.1 Action YAML valid (`actionlint`) — c659f78
- [x] 3.2 Gate logic unit-tested via fixture (below-floor → FAIL; at/above → PASS) — c659f78

#### Manual

- [x] 3.3 End-to-end scratch PR: scored comment, correct label, in-place update
- [x] 3.4 Truncation note appears for large diff
- [x] 3.5 Transport error surfaces distinctly from FAIL verdict

### Phase 4: Workflow wiring

#### Automated

- [x] 4.1 Workflow parses (`actionlint`) — 641e48b
- [x] 4.2 `AI Code Review` check created and runs on a test PR

#### Manual

- [x] 4.3 New PR to `main` runs, comments, labels, sets check status
- [x] 4.4 `ai-cr:review` re-runs; other labels do not
- [x] 4.5 `synchronize` re-runs and updates the same comment
- [x] 4.6 `ci.yml` jobs unaffected by label events

### Phase 5: Docs reconciliation

#### Automated

- [ ] 5.1 Markdown lints/formats clean

#### Manual

- [ ] 5.2 CLAUDE.md CI section reflects shipped workflow, labels, secret
