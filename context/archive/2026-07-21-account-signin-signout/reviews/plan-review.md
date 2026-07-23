<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Account Creation & Sign-In/Out — Confirmation, Redirect Fix, E2E Coverage

- **Plan**: context/changes/account-signin-signout/plan.md
- **Mode**: Deep
- **Date**: 2026-07-21
- **Verdict**: REVISE → SOUND (after fixes applied)
- **Findings**: 1 critical, 1 warning, 1 observation — all fixed

## Verdicts

| Dimension             | Verdict                             |
| --------------------- | ----------------------------------- |
| End-State Alignment   | PASS                                |
| Lean Execution        | PASS                                |
| Architectural Fitness | PASS                                |
| Blind Spots           | FAIL (pre-fix) → PASS (post-fix)    |
| Plan Completeness     | WARNING (pre-fix) → PASS (post-fix) |

## Grounding

9/9 paths ✓, 5/5 symbols ✓, brief↔plan ✓ (brief's "Docker running" prerequisite wasn't stated in the plan body — folded into F1's fix). Verified directly: `emailRedirectTo` absent from `signup.ts` (confirms the gap), `enable_confirmations = false` at `supabase/config.toml:209`, `isAutoConfirmed` at `confirm-email.astro:4`, `context.url` already used in `middleware.ts` (grounds the fix's approach), `@astrojs/check` present (grounds `npx astro check`), no existing test framework/config (grounds "first E2E infra" claim, no path conflict), single caller of `signUp()` (no blast radius beyond `signup.ts`), no port override in `astro.config.mjs` (grounds the `4321` webServer assumption). Also empirically confirmed (without exposing secrets) that `.dev.vars` matches `supabase.co`, not `localhost`/`127.0.0.1` — this became F1.

## Findings

### F1 — .dev.vars currently points at the cloud Supabase project, not local

- **Severity**: ❌ CRITICAL
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Blind Spots
- **Location**: Critical Implementation Details; Phase 1 Manual Verification; Phase 2
- **Detail**: The plan's testing strategy assumes local dev auto-confirms signups (`enable_confirmations = false`). Verified `.dev.vars` actually points at the cloud project (set up in `deploy-plan.md`'s one-time prod smoke test), not local Supabase. `confirm-email.astro`'s dev-mode copy is gated only on `import.meta.env.DEV`, not on which Supabase project is connected — so it would show "Registration successful" while the cloud project silently still requires real email confirmation, breaking Phase 1's manual check and Phase 2's E2E happy path.
- **Fix A ⭐ Recommended**: Repoint `.dev.vars` at local Supabase before Phase 1's manual checks.
  - Strength: Matches CLAUDE.md's documented workflow; keeps throwaway E2E signup accounts out of the real production user table.
  - Tradeoff: Developer must back up the current cloud `.dev.vars` values first; manual switching needed when testing against prod.
  - Confidence: HIGH — grounded in CLAUDE.md's convention and the local-only `enable_confirmations = false` setting the plan already relies on.
  - Blind spot: Haven't verified `npx supabase start` completes cleanly in this environment (Docker running, but local stack never started here).
- **Fix B**: Keep `.dev.vars` on cloud; confirm test users via the Supabase Admin API (`service_role` key).
  - Strength: No local Docker dependency for E2E runs.
  - Tradeoff: Introduces a materially more dangerous secret into the test environment; works around the mismatch instead of fixing it.
  - Confidence: MEDIUM — technically viable, adds a new secret-handling surface.
  - Blind spot: Whether there's already a safe place to keep a `service_role` key without risking a commit leak.
- **Decision**: FIXED (Fix A) — added an explicit precondition paragraph to Critical Implementation Details, a new Manual Verification item (Phase 1, now 1.5) and Progress row, and renumbered `Manual Testing Steps` to lead with repointing `.dev.vars`.

### F2 — Desired End State's verification command isn't a checked criterion

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Desired End State; Phase 2 Success Criteria
- **Detail**: Desired End State says "Verify via: `npm run test:e2e` passes," but no phase lists that command as an Automated Verification item — only the three individual spec files (2.1–2.3) were checked.
- **Fix**: Add "Full E2E suite passes: `npm run test:e2e`" as an Automated Verification item in Phase 2.
- **Decision**: FIXED — added as Phase 2 Automated Verification item + Progress row 2.4 (existing manual rows renumbered to 2.5/2.6).

### F3 — Happy-path spec doesn't verify /dashboard is inaccessible after sign-out

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2, Changes Required #1 (happy-path spec)
- **Detail**: The spec's Intent stopped at "confirm Topbar reverts to 'Not signed in'" — a UI-state check, not proof that sign-out actually revokes access. FR-002's "log out" needs a protected-route-becomes-unreachable assertion.
- **Fix**: Extend the happy-path spec's Contract to navigate to `/dashboard` after sign-out and assert the redirect to `/auth/signin` fires.
- **Decision**: FIXED — Intent updated in Phase 2, Changes Required #1.
