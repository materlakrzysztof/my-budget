<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Expense Categories — View Defaults & Add New

- **Plan**: context/changes/expense-categories/plan.md
- **Scope**: Full plan (Phases 1-4)
- **Date**: 2026-07-22
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 2 warnings, 3 observations

## Verdicts

| Dimension           | Verdict            |
| -------------------- | ------------------ |
| Plan Adherence       | PASS                |
| Scope Discipline     | WARNING             |
| Safety & Quality     | WARNING             |
| Architecture         | PASS                |
| Pattern Consistency  | PASS                |
| Success Criteria     | PASS                |

## Automated checks (re-run during review)

- `npm run lint` — pass (0 errors)
- `npm run test:unit` — pass (6/6)
- `npx astro check` — pass (0 errors, 0 warnings, 4 hints)
- `npm run build` — pass
- `npm run test:e2e` (categories specs) — pass; full-suite run at max parallelism has a known, pre-existing, unrelated flake in `auth-wrong-password.spec.ts` (from `account-signin-signout`), already triaged with the user during Phase 4 and accepted as out of scope.

## Findings

### F1 — DB unique-index normalization doesn't match app normalization; the hard-block duplicate rule can be bypassed for internal-whitespace variants

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural/operational stakes; think carefully before deciding
- **Dimension**: Safety & Quality
- **Location**: `supabase/migrations/20260721120000_create_categories.sql:19-20` vs `src/lib/services/categories.ts:30-32`
- **Detail**: The unique index is `lower(trim(name))` — Postgres `trim()` strips only leading/trailing whitespace, it does not collapse internal repeated spaces. `normalizeCategoryName` in `categories.ts` additionally does `.replace(/\s+/g, " ")` to collapse internal whitespace, and `categories.test.ts` explicitly asserts internal-whitespace variants normalize to the same value. Since the hard-block relies entirely on the DB raising `23505` (by design — plan.md's Critical Implementation Details section explicitly rejects a separate pre-check `SELECT` to avoid a TOCTOU race), a name like `"Food   Truck"` (extra internal spaces) will NOT collide with `"Food Truck"` at the DB level: the insert succeeds and a duplicate the app's own `normalizeCategoryName` considers identical is created without ever triggering `DuplicateCategoryError`. This breaks the plan's own stated invariant: "since both operate on the same normalized definition of 'similar'... the constraint stays, and the warning becomes a hard block" — the constraint and the app's definition of "similar" are not actually the same.
- **Fix A ⭐ Recommended**: Update the unique index to also collapse internal whitespace (e.g. `lower(regexp_replace(trim(name), '\s+', ' ', 'g'))`) via a **new** migration file (never edit an already-applied migration), then manually re-apply to the E2E and production Supabase projects per this project's established manual-apply convention.
  - Strength: Makes DB enforcement match the app's own definition of "same name" (already unit-tested via `normalizeCategoryName`), closing the exact gap the plan's design assumed didn't exist.
  - Tradeoff: Requires a new migration plus another manual SQL-editor apply to 2 live Supabase projects — an operational step, not just a code change.
  - Confidence: HIGH — `regexp_replace` is standard Postgres and the existing unique-index mechanism is already proven to work.
  - Blind spot: If any existing rows already have internal-whitespace-duplicate names, the new index would fail to apply until those rows are deduplicated — worth checking current data first.
- **Fix B**: Simplify `normalizeCategoryName` to drop internal-whitespace collapsing (trim + lowercase only), matching what the DB actually guarantees, and update the unit test accordingly.
  - Strength: Pure code + test change — no migration or manual production step needed.
  - Tradeoff: Weakens the "similar name" protection the test suite currently documents (a double-spaced typo would no longer be caught).
  - Confidence: MEDIUM — technically correct, but a step back from the stricter behavior the plan and tests currently express.
  - Blind spot: None significant.
- **Decision**: FIXED via Fix B — `normalizeCategoryName` simplified to trim+lowercase only (`src/lib/services/categories.ts`), unit test updated to reflect the DB's actual guarantee (`src/lib/services/categories.test.ts`). No migration needed; `npm run test:unit` re-verified green (6/6).

### F2 — `tests/e2e/helpers.ts` was modified beyond Phase 4's named file list

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: `tests/e2e/helpers.ts`
- **Detail**: Phase 4's "Changes Required" names only the three new spec files. During implementation, `helpers.ts` gained `signUpAndSignIn` (shared setup, low-risk) and `waitForCategoriesFormHydration` (works around a real SSR-hydration race on the categories form's native-submit button). Both are justified and necessary for the specs to be reliable, but they're unplanned relative to the plan's explicit scope.
- **Fix**: No code change needed — accept as legitimate supporting test infrastructure; this review note is the record.
- **Decision**: ACCEPTED — no code change; this review entry is the record.

## Observations (non-blocking)

- **O1** — `listCategories`'s seeding race guard (`categories.ts:66-72`) catches a `23505` from a plain multi-row `.insert()` rather than using an explicit `ON CONFLICT ... DO NOTHING` clause as plan.md's contract literally describes. Behaviorally equivalent (Postgres aborts the whole multi-row insert atomically on any row conflict, so the re-select after catching returns the winner's rows) — not a bug, just a documentation/implementation wording drift worth knowing about.
- **O2** — No explicit error handling around service calls at the SSR/API boundary: `categories.astro:9` calls `listCategories` with no try/catch, and `api/categories.ts` lets non-duplicate DB errors propagate as a generic 500. Consistent with how `dashboard.astro` already behaves in this codebase; flagged for awareness, not a defect.
- **O3** — `AddCategoryForm` has no progressive-enhancement fallback (`<form onSubmit={...}>` with no `method`/`action`), unlike the auth forms' real `<form method="POST" action="...">`. This is an intentional, plan-acknowledged trade-off (the plan calls the JSON/fetch contract new) and is already worked around in `tests/e2e/helpers.ts` (`waitForCategoriesFormHydration`) — surfaced here only because a pre-hydration click still causes a real page reload for slow-hydration users in production, not just in tests.

## What We're NOT Doing — verified honored

No category editing, no DELETE route/policy, no fuzzy/trigram similarity matching, no CI migration wiring. Confirmed absent from the diff.
