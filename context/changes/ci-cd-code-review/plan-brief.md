# CI/CD AI Code-Review Workflow — Plan Brief

> Full plan: `context/changes/ci-cd-code-review/plan.md`
> Research: `context/changes/ci-cd-code-review/research.md`

## What & Why

Add the repository's first PR code-review CI. On every pull request to `main`, a
GitHub Actions composite action scores the change on six 1–10 criteria
(correctness, idiomaticity, complexity, test/risk coverage, documentation,
security), then a deterministic gate posts a summary comment and applies
`ai-cr:passed` / `ai-cr:failed` labels. The goal is an automated, consistent
quality signal on PRs that catches what lint/build/unit tests cannot.

## Starting Point

The repo already ships `@10x/code-reviewer` (`packages/code-reviewer/`) — an
AI-SDK reviewer with schema-validated structured output over OpenRouter. It's
~80% of the engine, but outputs severity findings (not scores) and takes a code
blob (not a PR diff). CI today is a single `ci.yml` (lint + tests + build +
migration-safety + deploy) with no `permissions:` block, no `.github/actions/`
composite, and no `ai-cr:*` labels.

## Desired End State

Opening or updating a PR against `main` runs an `AI Code Review` check that posts
(or updates in place) a scored comment, applies exactly one pass/fail label, and
shows red when any criterion is below the floor. Adding the `ai-cr:review` label
re-runs the review on demand.

## Key Decisions Made

| Decision           | Choice                                              | Why (1 sentence)                                                        | Source   |
| ------------------ | --------------------------------------------------- | ---------------------------------------------------------------------- | -------- |
| Backend            | Direct model call in composite action (Backend B)   | Fixed-rubric scorer, not an agent; matches the "composite action" ask.  | Research |
| Provider           | OpenRouter, reuse `model.ts` + `OPENROUTER_API_KEY` | Zero engine rework; model swappable via env.                            | Plan     |
| Threshold          | Per-criterion floor (fail if any `< FLOOR`)         | Simple, transparent; no weak dimension slips through.                   | Plan     |
| Enforcement        | Advisory now (red check), block-ready               | Immediate signal without branch-protection gymnastics; easy to promote. | Plan     |
| Cost               | Include PR body; cap/truncate diff                  | Body gives intent; cap bounds worst-case token cost.                    | Plan     |
| Schema shape       | Parallel `scoredReviewSchema`                       | Existing findings API + smoke run stay intact.                          | Plan     |
| Packaging          | `npm ci` in package dir at Node 24                  | Honors package's Node≥24 without root-workspace surgery.                | Plan     |
| Workflow file      | Separate `ai-code-review.yml`                        | Label events don't re-run lint/build/tests.                            | Plan     |
| Target branch      | `main` (not "master")                               | Repo default branch; no `master` exists.                                | Research |

## Scope

**In scope:** scored-review path in `@10x/code-reviewer`; a composite action
(diff assembly, scoring, gate, comment dedup, labels); a dedicated workflow with
PR + `ai-cr:review` triggers and the repo's first `permissions:` block; secret +
label provisioning; docs reconciliation.

**Out of scope:** merge-blocking branch protection; `claude-code-action`;
Anthropic-direct provider; root-workspace adoption; "business alignment" /
"architectural fit" criteria; changes to `ci.yml`'s existing jobs.

## Architecture / Approach

Composite action `.github/actions/ai-code-review` runs: assemble diff
(`fetch-depth: 0`, three-dot, `gh pr view` title/body, cap large diffs) → Node 24
`npm ci` + scoring entrypoint → JSON with six integers + summary + notes →
deterministic bash gate (any `< floor` → FAIL) → marker-based comment dedup →
apply labels → exit non-zero on FAIL. The AI returns **data**; team-owned bash
decides the verdict and side effects.

## Phases at a Glance

| Phase                       | What it delivers                                  | Key risk                                            |
| --------------------------- | ------------------------------------------------- | --------------------------------------------------- |
| 1. Prerequisites            | `OPENROUTER_API_KEY` secret + three `ai-cr:*` labels | Missing label → `gh pr edit` fails                  |
| 2. Extend engine            | Scored schema, PR prompt, agent fn, CLI entrypoint | Prompt quality; keeping findings API intact         |
| 3. Composite action         | Diff→score→gate→comment→labels                     | Diff range/dedup correctness; Node 24 reconciliation |
| 4. Workflow wiring          | `ai-code-review.yml` triggers + permissions        | Retry guard logic; `issues: write` for labels        |
| 5. Docs reconciliation      | CLAUDE.md / env / requirements updated             | Low                                                 |

**Prerequisites:** GitHub admin to add a repo secret and labels; a valid
OpenRouter key with credit.
**Estimated effort:** ~2–3 sessions across 5 phases (Phase 2–3 are the bulk).

## Open Risks & Assumptions

- Prompt/rubric quality determines score usefulness — needs a real-PR manual pass
  (Phase 2 manual criteria).
- Diff truncation gives large PRs a partial review; mitigated by a visible note.
- Advisory-only means a determined author can merge a red PR until branch
  protection is turned on (intended for MVP).
- `GITHUB_TOKEN` on forked-PR runs has reduced permissions — first validation
  should be a same-repo branch PR.

## Success Criteria (Summary)

- A weak PR → low scores, red check, `ai-cr:failed`, scored comment; a clean PR →
  green check + `ai-cr:passed`.
- Adding `ai-cr:review` re-runs and updates the same comment (no duplicates);
  other labels do not trigger.
- `ci.yml` and its jobs remain unaffected.
