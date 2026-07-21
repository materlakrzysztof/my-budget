# Account Creation & Sign-In/Out — Plan Brief

> Full plan: `context/changes/account-signin-signout/plan.md`

## What & Why

Roadmap slice `S-01` targets FR-001 (create account) and FR-002 (log in/out) — both already built and verified live in production. This change is a confirmation pass: close the one real gap found (a fragile email-confirmation redirect), and lock in Playwright E2E coverage for the critical auth path before S-02 (`expense-categories`) and S-03 build on top of it.

## Starting Point

`src/pages/api/auth/{signup,signin,signout}.ts`, the `SignUpForm`/`SignInForm` React islands, `middleware.ts`'s route protection, and `Topbar.astro`'s signed-in/out UI are all implemented and were manually verified end-to-end in production (`context/deployment/deploy-plan.md`). The one known gap: `signup()` doesn't pass `emailRedirectTo`, so Supabase falls back to a manually-maintained dashboard "Site URL" setting — fine for one environment, fragile the moment a second one exists. There is no automated test coverage anywhere in the repo yet.

## Desired End State

The signup confirmation link always resolves against the environment that issued it, with no manual per-environment dashboard step. The account-creation/sign-in/sign-out path has a green, risk-tied Playwright suite (`npm run test:e2e`) that fails the instant auth or middleware regresses — the first automated safety net future slices can build on.

## Key Decisions Made

| Decision                | Choice                                                           | Why (1 sentence)                                                                                                                             |
| ----------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Overall scope           | Confirm + close real gaps + add first automated coverage         | Every future slice depends on auth; locking in a regression check now is cheap while the surface is small.                                   |
| Edge cases to harden    | Duplicate email, wrong password                                  | The two most likely real-world stumbles; declined double-submit and redirect-target as lower value.                                          |
| Testing approach        | Playwright E2E for the critical path                             | Manual checklists get skipped under capacity pressure; E2E catches what middleware/session regressions a unit test can't.                    |
| Edge-case test coverage | Both edge cases get their own E2E tests, not just the happy path | Automating only the happy path after choosing E2E coverage would leave the two chosen risks unprotected.                                     |
| `emailRedirectTo` fix   | Fix now, derived from request origin                             | Cheap fix while touching this exact file; removes a manual, easy-to-forget per-environment dashboard step.                                   |
| CI wiring for E2E       | Deferred (local-only for this slice)                             | Running Playwright in CI needs a local Supabase instance in the runner — real added complexity against the `low-complexity` sequencing goal. |

## Scope

**In scope:**

- Fix the `emailRedirectTo` gap in `signup.ts`
- Install and configure Playwright (`playwright.config.ts`, `test:e2e` script)
- Three risk-tied E2E specs: happy path, duplicate email, wrong password

**Out of scope:**

- Categories/expenses (`S-02`, `S-03`)
- CI wiring for E2E
- Double-submit protection, post-login redirect-target hardening
- Password policy, MFA, OAuth providers
- Auth page restyling

## Architecture / Approach

Phase 1 is ordinary build work: a one-line signup fix plus standing up Playwright against the existing `npm run dev` local workflow. Phase 2 hands off to the project's own `/10x-e2e` skill to generate, review, and verify the three specs against the running local dev stack + local Supabase — reusing the dev-mode auto-confirm behavior (`enable_confirmations = false` locally) the scaffold already anticipates in `confirm-email.astro`.

## Phases at a Glance

| Phase                               | What it delivers                                                       | Key risk                                                                                                                                                                     |
| ----------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Redirect fix + Playwright infra  | `emailRedirectTo` fix; Playwright installed and configured             | Manually verifying the redirect fix needs a real confirmation email, which local dev doesn't send by default — worked around by temporarily flipping `enable_confirmations`. |
| 2. E2E-cover the critical auth path | 3 green, risk-tied specs (happy path, duplicate email, wrong password) | E2E is flake-prone if run against the wrong Supabase instance — must target local, not cloud.                                                                                |

**Prerequisites:** Docker running (for `npx supabase start`), local `.dev.vars` pointed at the local Supabase instance.
**Estimated effort:** 2 phases, small — no data model or architecture work.

## Open Risks & Assumptions

- Assumes local Supabase's `enable_confirmations = false` default hasn't been changed; if it has, Phase 2's happy-path test needs the Inbucket email-click step instead of the dev-mode auto-confirm assumption.
- Assumes `npm run dev` reliably serves on port 4321 for Playwright's `webServer`; if the port is ever made configurable, `playwright.config.ts` needs updating alongside it.

## Success Criteria (Summary)

- `npm run test:e2e` passes locally, covering signup → signin → protected dashboard → signout, plus duplicate-email and wrong-password error handling.
- A new signup's confirmation link resolves against the issuing environment's own origin, with no manual dashboard step required.
