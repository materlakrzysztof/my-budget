<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Expense Categories — View Defaults & Add New

- **Plan**: context/changes/expense-categories/plan.md
- **Mode**: Deep
- **Date**: 2026-07-21
- **Verdict**: REVISE
- **Findings**: 1 critical, 2 warnings, 0 observations

## Verdicts

| Dimension             | Verdict |
| ---------------------- | ------- |
| End-State Alignment   | PASS    |
| Lean Execution        | PASS    |
| Architectural Fitness | PASS    |
| Blind Spots           | FAIL    |
| Plan Completeness     | WARNING |

## Grounding

7/7 citations verified (src/lib/supabase.ts:5, src/middleware.ts:4, src/pages/dashboard.astro:1-4, src/components/Banner.astro:9, src/env.d.ts:3, account-signin-signout/plan.md:29, deploy-plan.md:35), brief↔plan consistent.

## Findings

### F1 — Plan assumes a prerequisite that isn't actually ready

- **Severity**: CRITICAL
- **Impact**: MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1 (step 1.4), Phase 4, plan-brief.md Prerequisites
- **Detail**: plan-brief.md's Prerequisites assume `account-signin-signout`'s E2E Supabase project is "set up," and Phase 1 step 1.4 / all of Phase 4 depend on applying migrations to and running E2E specs against it. That change's own `change.md` still shows `status: implementing`, and its `plan.md` Progress section shows step 1.6 explicitly blocked ("blocked 2026-07-21: signup against the E2E project hits Supabase's built-in mailer rate limit... Not resolved; user asked to defer and move on"). Phase 2 of that plan (the actual auth E2E specs) is entirely unstarted. Reaching Phase 1's manual verification or Phase 4 of this plan will hit the same unresolved block.
- **Fix A ⭐ Recommended**: Add an explicit blocking prerequisite gate before Phase 1/4 manual steps that references the unresolved account-signin-signout blocker.
  - Strength: Makes the dependency visible before implementation starts; matches the repo's existing pause-between-phases convention.
  - Tradeoff: Doesn't unblock anything — work is genuinely stalled until the rate-limit issue resolves.
  - Confidence: HIGH — confirmed directly against the referenced plan.md/change.md.
  - Blind spot: Whether the rate limit is the mailer cap or a misconfigured toggle is still unresolved upstream.
- **Fix B**: Decouple Phases 1-3 from the E2E project, deferring that dependency to Phase 4 only.
  - Strength: Schema/service/UI work can proceed immediately via local Supabase or a scratch project.
  - Tradeoff: Reintroduces local Supabase for Phase 1 (see F2); Phase 4 still blocked.
  - Confidence: MEDIUM — reduces near-term blocking, doesn't remove the Phase 4 dependency.
  - Blind spot: Whether a throwaway scratch project is worth the setup cost is unevaluated.
- **Decision**: FIXED (via Fix A)

### F2 — Phase 1 automated verification reintroduces local Supabase/Docker

- **Severity**: WARNING
- **Impact**: MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1 — Success Criteria (Automated Verification)
- **Detail**: Step 1.1 uses `npx supabase start` + `npx supabase db reset`. The immediately prior change explicitly dropped local Supabase/Docker (user confirmed all three concerns applied, including "Wymóg Dockera/npx supabase start"), and its `change.md` frames the pivot as "avoids Docker." This plan reintroduces that tool for migration authoring without checking whether the objection was Docker specifically or scoped to repeated E2E runs.
- **Fix A ⭐ Recommended**: Verify the migration directly against the E2E Supabase project's SQL editor instead of local Supabase.
  - Strength: Zero Docker, consistent with the cloud-only direction already chosen.
  - Tradeoff: Loses the fast, resettable local iteration loop (`db reset`).
  - Confidence: MEDIUM — reasonable given stated preference, not confirmed for this narrower use case.
  - Blind spot: Unclear if the objection was Docker in general or specifically the repeated-E2E-run use case.
- **Fix B**: Keep local Supabase for this one-time schema-authoring step only.
  - Strength: Fast, resettable iteration while writing the first migration in the repo.
  - Tradeoff: Still requires Docker on the machine for at least this step.
  - Confidence: MEDIUM — same uncertainty, opposite bet.
  - Blind spot: Same as Fix A.
- **Decision**: FIXED (via Fix A)

### F3 — Ambiguous ownership of the duplicate-name error state across 3 components

- **Severity**: WARNING
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3, items #4 (CategoriesManager) and #6 (AddCategoryForm)
- **Detail**: Item #4 says CategoriesManager itself "surfaces the duplicate error inline" on a 409; item #6 says AddCategoryForm "catches a thrown duplicate error and renders it." Both claim ownership; `onCreate`'s `Promise<void>` signature doesn't indicate whether it rejects on 409 or swallows the error.
- **Fix**: Clarify that `CategoriesManager` owns `duplicateError: string | null` state, catches the fetch's 409 itself (no rethrow), and passes `duplicateError` down to `AddCategoryForm` for display via `DuplicateCategoryAlert`. Drop the "catches a thrown duplicate error" language from item #6.
- **Decision**: FIXED
