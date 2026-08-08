## Overall concept

- GHA workflow run for every new pull request to master
- composite action for the review itself so that main workflow is easy to reason about

> **Note:** "master" resolves to `main` — the repo's default branch (no `master` exists). The shipped workflow targets `main`.

## Input parameters

- pull request title
- pull request description (?? cost tradeoff)
- git diff

## Code Review Criteria

Each criterion is scored on a 1–10 scale, where 1 is the worst outcome and 10 is the best.

1. **implementation correctness** — Does the code do what it claims, handling edge cases, error paths, and boundary conditions without introducing regressions?
   - _1_: logic is broken or produces wrong results, unhandled errors and obvious edge-case failures.
   - _10_: logic is provably correct, all edge cases and failure paths handled, no regressions.

2. **idiomaticity** — Does the code follow the language, framework, and project conventions rather than fighting them?
   - _1_: ignores established patterns, reinvents built-ins, inconsistent style that clashes with the codebase.
   - _10_: uses idiomatic constructs and project conventions naturally, reads like the surrounding code.

3. **complexity** — Is the solution as simple as the problem allows, without needless abstraction or convolution?
   - _1_: over-engineered or tangled, hard to follow, unnecessary indirection and dead complexity.
   - _10_: minimal and clear, each piece justified, easy to reason about and change.

4. **test/risk coverage** — Are the change's risky paths exercised by tests proportionate to their blast radius?
   - _1_: no meaningful tests for risky behavior, high-impact paths left unverified.
   - _10_: risk-weighted coverage, critical and edge paths tested, failures would be caught before merge.

5. **documentation** — Are non-obvious decisions, public interfaces, and usage explained where a reader would need them?
   - _1_: no comments or docs where they are needed, intent and contracts left opaque.
   - _10_: intent, trade-offs, and interfaces clearly documented exactly where relevant, nothing over- or under-explained.

6. **security and safety** — Does the change avoid introducing vulnerabilities and handle untrusted input, secrets, and permissions responsibly?
   - _1_: introduces exploitable flaws, leaks secrets, or trusts unvalidated input.
   - _10_: input validated, secrets and permissions handled correctly, no new attack surface.

## Parked for later

- business alignment (require broader context)
- architectural fit (require broader context)

## Expected side-effects

- PR comment with summary
- labels: `ai-cr:failed` (red) OR `ai-cr:passed` (green)

## Expected behavior

- on-demand retry when label `ai-cr:review` is added
