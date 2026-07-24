# Category Expense Drilldown — Plan Brief

> Full plan: `context/changes/category-expense-drilldown/plan.md`

## What & Why

Let a user click a category — from the monthly summary or the categories page — to see the filtered list of expenses belonging to it. Totals alone don't show which expenses made up a category; this closes that gap (`prd-v2.md` FR-003, US-01, roadmap S-06).

## Starting Point

`MonthlySummary.tsx` and `CategoryList.tsx` render fully static rows today — no links, no click handlers. `listExpenses` takes no filter, and `/expenses` always shows every expense. The one existing URL-driven pattern in this codebase is `expenses.astro`'s `?action=add` deep link (Astro reads the query param, passes it as a prop, a `useEffect` acts on it once).

## Desired End State

Clicking a category row (either entry point) navigates to `/expenses?category=<id>` showing only that category's expenses, with a "Filtered by: <name>" banner and a "Clear filter" link back to the full list. A category with no matching expenses shows a distinct empty message. The filtered list's sum always reconciles with that category's total in the summary.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Routing strategy | Query param `/expenses?category=<id>` | Reuses the only existing URL-deep-link pattern; a page-level `[id].astro` route would be a brand-new convention in this repo | Plan |
| Click entry points | Both `MonthlySummary` and `CategoryList` | PRD US-01 explicitly names both ("from the summary or categories page") | Plan |
| Filter shape | Optional `filter` param on `listExpenses`, read from `?category=` in the API route | Minimal, reuses existing select/mapping path; RLS + existing `user_id` scoping already make a foreign `categoryId` safe (returns empty, not a leak) | Plan |
| Clearing the filter | Persistent query param + visible "Clear filter" link (not auto-stripped like `?action=add`) | The filtered view should be shareable/bookmarkable, unlike the one-shot add-dialog case | Plan |
| Empty state | Distinct "No expenses in this category." message | Avoids the user thinking they lost all their data when just one category is empty | Plan |
| List column | Category name stays visible in filtered rows (no hiding) | Banner already gives context; hiding it would be a cosmetic-only branch not worth the extra code | Plan |
| Test coverage | Unit (filter logic) + integration (incl. cross-user safety) + 1 new e2e (click-through + reconciliation) | Matches PRD's explicit reconciliation guardrail; MEDIUM-complexity slice touching 2 entry points warrants real e2e coverage, unlike S-05 | Plan |

## Scope

**In scope:**
- Optional category filter on `listExpenses` + `GET /api/expenses`
- Clickable rows in `MonthlySummary` and `CategoryList`
- Filtered-view banner, clear-filter link, distinct empty state on `/expenses`
- Unit + integration + 1 new e2e test

**Out of scope:**
- New page route (`/categories/[id].astro`) or modal/inline expansion
- Any change to the monthly summary's totals/ranking logic
- Full-text/keyword search
- Hiding the category text in filtered `ExpenseList` rows

## Architecture / Approach

Bottom-up: extend `listExpenses`/`GET /api/expenses` with an optional category filter first, then wire the two click entry points and the filtered `/expenses` view on top, then test. `expenses.astro` resolves the raw `?category=` id against the already-fetched `categories` list (unrecognized/missing → treated as no filter), so `ExpensesManager` always receives a real `Category | null`, never a bare id.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Service & API Filter | Optional category filter on `listExpenses` + the endpoint | Must not change behavior when no filter is passed (regression risk for the unfiltered `/expenses` view) |
| 2. UI — Entry Points & Filtered View | Clickable summary/category rows, banner, clear link, empty state | Cross-user `categoryId` must degrade safely (empty list), not leak or error |
| 3. Testing | Unit, integration, and a new e2e covering the PRD reconciliation guardrail | None — purely additive test coverage |

**Prerequisites:** None — independent of S-04/S-05/S-07 per roadmap.
**Estimated effort:** ~1-2 sessions across 3 phases (touches more surface than S-05 but no schema change).

## Open Risks & Assumptions

- Assumes a full-page navigation (`<a href>`) is acceptable UX for the drill-down click, rather than a client-side/instant filter — consistent with this app's current zero-SPA-routing architecture.

## Success Criteria (Summary)

- User can click a category (from either entry point) and see exactly that category's expenses
- The filtered list's total always matches the summary's total for that category
- The unfiltered `/expenses` view and monthly summary are unaffected when no filter is active
