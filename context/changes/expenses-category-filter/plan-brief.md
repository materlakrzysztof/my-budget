# Category Filter on Expenses List — Plan Brief

> Full plan: `context/changes/expenses-category-filter/plan.md`

## What & Why

Add an **in-page category picker** to the expenses page so the user filters the
expenses list by category without leaving the page (roadmap S-15 / PRD FR-024).
Category filtering already works — but only via URL drill-down from the
categories page. This slice adds the missing on-page control.

## Starting Point

`/expenses?category=<id>` is already SSR-filtered, the API and `listExpenses`
service already filter, and `ExpensesManager.refresh()` already refetches by
category. The only gap: `categoryFilter` is a fixed prop resolved once at SSR
with no browser control to change it, so filtering means leaving for the
categories page or editing the URL, and clearing is a full-page navigation.

## Desired End State

A native `<select>` above the list offers "All categories" + one per category.
Picking one filters in place (no reload) and sets `?category=<id>`; picking "All"
clears both. Deep-linking `/expenses?category=<id>` renders filtered SSR and
preselects the picker. The old "Filtered by / Clear filter" banner is gone.

## Key Decisions Made

| Decision              | Choice                                             | Why (1 sentence)                                                                     | Source |
| --------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------ | ------ |
| Filter state model    | Client state + URL sync (`history.replaceState`)   | Instant in-place filtering while staying bookmarkable and preserving drill-down links | Plan   |
| Picker UI             | Native `<select>` (not shadcn Radix)               | Consistency with the expense form's native select + Playwright `selectOption` in E2E  | Plan   |
| Existing banner       | Removed — picker value is the single filter control | Avoids redundant controls for one piece of state                                     | Plan   |
| Empty state           | Reuse category-specific `emptyMessage`             | Already supported by `ExpenseList`; no new work                                       | Plan   |
| Test coverage         | E2E only; unit stays at service layer              | No React component-test infra exists; matches repo's E2E-for-interaction convention   | Plan   |
| Backend               | No API/service/DB changes                          | Filtering is already implemented server-side                                          | Plan   |

## Scope

**In scope:** In-page native `<select>` category picker; client filter state
seeded from SSR; refetch on change; `?category=` URL sync; remove banner; E2E
coverage.

**Out of scope:** API/service/DB changes; keyword/full-text search; multi-select
filtering; shadcn Select; new component-test stack; loading spinner on refetch.

## Architecture / Approach

`expenses.astro` keeps resolving `?category=` for the initial SSR list but passes
`initialCategoryId` instead of the resolved object. `ExpensesManager` holds
`selectedCategoryId` (seeded from it), renders the `<select>`, and on change
updates state → `refresh()` (existing) → `history.replaceState`. The empty
message derives from active-filter state; the banner is deleted. No new
components or endpoints.

## Phases at a Glance

| Phase                              | What it delivers                                        | Key risk                                                         |
| ---------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------- |
| 1. Picker + client filter state    | In-page select, refetch, URL sync, banner removed       | Refetch must use the newly-selected id, not stale state         |
| 2. E2E coverage                    | Playwright spec: filter, clear, deep-link preselect     | Flakiness — mitigated by state-based waits + unique ids          |

**Prerequisites:** None — API/service filtering already shipped.
**Estimated effort:** ~1 session across 2 phases.

## Open Risks & Assumptions

- Assumes small per-user datasets, so in-place refetch (no spinner) meets the
  <1s perceived-acknowledgement goal — no pagination needed.
- On filter change, the refetch must read the just-selected id explicitly rather
  than relying on React state being current within the same tick.

## Success Criteria (Summary)

- User filters and clears the expenses list from the page itself, no reload.
- `?category=` URL stays in sync; drill-down deep-links and bookmarks still work.
- E2E covers filter / clear / deep-link-preselect; lint, unit, and build green.
