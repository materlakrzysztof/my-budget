<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Category Management in Settings (FR-023)

- **Plan**: context/changes/categories-in-settings/plan.md
- **Scope**: Phase 1 & 2 of 2 (full plan)
- **Date**: 2026-07-27
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 3 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | WARNING |
| Safety & Quality    | PASS    |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | WARNING |

Notes:

- **Plan Adherence PASS** — Settings composed with Currency + Categories sections; nav "Categories" link removed; old route redirects. The redirect *mechanism* changed from the planned page-file stub to an Astro config redirect, but this was an approved mid-implementation decision (the stub crashed ESLint's `no-misused-promises` on a top-level `.astro` return) and delivers the same contract. Verified empirically: `/categories` → `HTTP 301 Moved Permanently`, `location: /settings`.
- **Safety & Quality PASS** — no security/perf/reliability/data-safety concerns; no new logic, purely template + config + test wiring. Redirect status is a permanent 301 as intended.

## Findings

### F1 — categories.astro deleted despite plan's "What We're NOT Doing"

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/pages/categories.astro (deleted), context/changes/categories-in-settings/plan.md:40
- **Detail**: The plan's "What We're NOT Doing" states "No deletion of the categories.astro file — it is repurposed as a redirect stub." Implementation deleted the file and moved the 301 into `astro.config.mjs`, because a config redirect cannot coexist with a route file for the same path. This was surfaced and approved during implementation and is documented in commit f58304e, but the plan text now contradicts the shipped reality.
- **Fix**: Add a one-line addendum to the plan noting the redirect mechanism changed to a config redirect (categories.astro deleted), so the plan stays an accurate source of truth for future reviews/archive.
- **Decision**: FIXED — added addendum to plan.md "What We're NOT Doing" (uncommitted)

### F2 — Full E2E suite is red from pre-existing, unrelated failures

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Success Criteria
- **Location**: tests/e2e/{auth-happy-path,expenses-add-and-summary,expenses-edit-updates-summary,expenses-delete-updates-summary,expenses-backdated-attribution,category-expense-drilldown}.spec.ts
- **Detail**: Phase 2's automated criterion is "E2E suite passes." All 6 in-scope specs pass, but 6 unrelated specs fail. Root cause traced to the merged monthly-dashboard work: the "Welcome, <email>" greeting and old summary layout were removed in commit 1d32c28, and these specs were not updated. Confirmed absent at 92e3cba (immediately before this change), so the failures pre-date this work. User reviewed and accepted proceeding.
- **Fix**: Open a dedicated change to repair the stale monthly-dashboard E2E specs (that iteration's debt, not this one's).
- **Decision**: SKIPPED — out of scope; leave for a dedicated monthly-dashboard fix change

### F3 — Redundant "Categories" + "Your categories" headings on Settings

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/settings.astro (section `<h2>Categories</h2>`) + src/components/categories/CategoriesManager.tsx:106 (`<h2>Your categories</h2>`)
- **Detail**: The Settings page renders a section heading "Categories" immediately above the CategoriesManager island, which renders its own "Your categories" heading. Two near-identical headings stack. Harmless and both are used as stable E2E/section markers, but slightly redundant visually.
- **Fix**: Optional — either drop the page-level `<h2>Categories</h2>` and rely on the manager's own heading, or keep both (the "Categories" section heading mirrors the "Currency" section heading for visual symmetry). Low priority; leave as-is is defensible.
- **Decision**: FIXED — dropped the page-level `<h2>Categories</h2>` from settings.astro (uncommitted)

### F4 — /categories still listed in middleware PROTECTED_ROUTES

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: src/middleware.ts:4
- **Detail**: `PROTECTED_ROUTES` still includes `/categories`. Empirically the Astro config redirect fires before the middleware auth-gate matters (an unauthenticated `/categories` request 301s to `/settings`, which then 302s to signin), so the entry is now effectively dead — the route no longer resolves to a real page. Harmless, but slightly stale.
- **Fix**: Optional — remove `/categories` from PROTECTED_ROUTES; `/settings` (the redirect target) is already protected, so auth-gating is preserved. Low priority.
- **Decision**: FIXED — removed `/categories` from PROTECTED_ROUTES in src/middleware.ts (uncommitted)
