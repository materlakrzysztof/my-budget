<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Monthly Dashboard

- **Plan**: context/changes/monthly-dashboard/plan.md
- **Scope**: All phases (1–2 of 2)
- **Date**: 2026-07-27
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 4 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | PASS    |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

All 12 planned changes MATCH the plan. Automated success criteria verified green across both phases (`npm run lint`, `npm run build`, `npm run test:unit` — 47/47); all manual Progress rows confirmed and SHA-stamped. Donut arc math is correct, the headline total reconciles with the per-category breakdown, the accessibility guardrail (color not the sole signal) is met, and `ExpensesManager` is fully cleaned up after the Phase-2 summary removal with no dangling references.

## Findings

### F1 — Headline total computed from `entries`, not the visible `spent` list

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/dashboard/DashboardView.tsx:28
- **Detail**: The headline total is `entries.reduce(...)` over all categories, while the donut and per-category list use `spent` (total > 0). The plan's Critical Implementation Details said to compute the total from "the same values the list/donut use" (i.e. `spent`) so the headline can never disagree with the breakdown. They are equal today because expense amounts are DB-constrained to be positive (no negatives) and 0.00 entries contribute nothing — but if refunds/negative adjustments ever entered the aggregation, the headline (including negatives) would diverge from the list (excluding ≤ 0). The plan text itself was internally inconsistent (its inline snippet wrote `entries.reduce` while the prose said the list's values), and the implementation followed the snippet.
- **Fix**: Change `entries.reduce(...)` to `spent.reduce(...)` — matches the guardrail intent and future-proofs against negative adjustments. One-word change.
- **Decision**: SKIPPED — reconciles today (amounts are DB-constrained positive); not worth changing now.

### F2 — Five e2e specs still assert the summary on `/expenses`

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: tests/e2e/{expenses-add-and-summary,expenses-edit-updates-summary,expenses-delete-updates-summary,expenses-backdated-attribution,category-expense-drilldown}.spec.ts
- **Detail**: Phase 2 moved the summary off `/expenses` onto `/dashboard`; these specs assert it on `/expenses` via the `summaryRowFor` helper and will now fail. CI runs lint + unit + build + migration-safety only (no e2e), so they are stale-but-non-blocking. **Already tracked and deferred by explicit user decision** — see `context/changes/monthly-dashboard/follow-ups/e2e-updates.md`; recommended to bundle with roadmap S-15 (`expenses-category-filter`), which also reshapes the Expenses page.
- **Fix**: No new action — resolve via the recorded follow-up (repoint the specs to `/dashboard` for the summary/drill-down, keep list actions on `/expenses`).
- **Decision**: DEFERRED — confirmed; tracked in follow-ups/e2e-updates.md, to be done with S-15.

### F3 — Island export style differs from the sibling

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/dashboard/DashboardView.tsx:11
- **Detail**: `DashboardView` is a named export used as the `client:load` island, whereas the sibling island `ExpensesManager` is a default export (`expenses.astro:3`). Both work in Astro; purely a stylistic inconsistency. Sub-components (`SpendingDonut`, `MonthlySummary`) are named, which is fine.
- **Fix**: Optional — make it a default export to match `ExpensesManager` if you want island exports uniform. Not worth changing otherwise.
- **Decision**: FIXED — `DashboardView` is now a default export; `dashboard.astro` import updated.

### F4 — Donut palette wraps at more than 8 categories

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/dashboard/SpendingDonut.tsx:6-19
- **Detail**: The 8-color palette is indexed by `index % length`, so with more than 8 spending categories two slices share a color. Harmless for accessibility (the legend text disambiguates) and cosmetic only; relevant only if many categories are expected in a single month.
- **Fix**: Optional — expand the palette or generate colors if >8 categories become common.
- **Decision**: FIXED — `colorForIndex` now falls back to golden-angle HSL past the 8-color palette (no modulo collisions).
