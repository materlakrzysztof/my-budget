# Monthly Dashboard — Plan Brief

> Full plan: `context/changes/monthly-dashboard/plan.md`

## What & Why

Build the monthly **dashboard** — a per-category spending chart, a headline total, and a per-category breakdown for the current month — and have it absorb the flat summary that lives on the Expenses page today. This is roadmap S-08, the iteration-3 north star (PRD FR-015/016/017, US-05): the user needs to see the shape of their month at a glance, which a flat ranked list doesn't give.

## Starting Point

`dashboard.astro` is a placeholder welcome card. The monthly summary already exists — server-side aggregation (`getMonthlySummary`) rendered on the Expenses page via `ExpensesManager` → `MonthlySummary.tsx` (a per-category bar list with drill-down). Currency and the page/island pattern are established. No charting library is installed.

## Desired End State

`/dashboard` shows an SVG donut split by category, a headline total in the user's currency, and a per-category breakdown list (each row linking to that category's expenses), with a friendly empty state when there's no spend this month. The Expenses page becomes a focused expense list with no summary block.

## Key Decisions Made

| Decision                     | Choice                                             | Why (1 sentence)                                                        | Source |
| ---------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------- | ------ |
| Chart implementation         | Hand-rolled SVG donut + reused per-category bars   | No new dependency, fits Cloudflare Workers + low-complexity goal.       | Plan   |
| Absorb the summary           | Move to dashboard, remove from Expenses page       | Matches PRD "dashboard absorbs the summary"; Expenses becomes list-only.| Plan   |
| Zero-spend categories        | Show only categories with spend > 0                | Keeps the donut and list clean, no empty slices.                        | Plan   |
| Empty state                  | Message + link to `/expenses?action=add`           | Clear next action; rich quick-add is a separate slice (S-10).           | Plan   |
| Data source                  | Reuse `getMonthlySummary` server-side, no new API  | Presentation over existing aggregation; no migration.                   | Plan   |

## Scope

**In scope:** dashboard page + island; SVG donut (spend > 0); headline total; per-category breakdown; empty state; removing the summary from the Expenses page; relocating `MonthlySummary` to the dashboard.

**Out of scope:** month-over-month comparison (S-09); quick-add-from-dashboard (S-10); Polish i18n (S-11); any charting library; new API/migration; changes to aggregation/totals.

## Architecture / Approach

`dashboard.astro` loads `getMonthlySummary` + currency server-side (same pattern as `expenses.astro`) and passes `MonthlySummaryEntry[]` + `Currency` to a new `DashboardView` island. `DashboardView` filters to spend > 0, computes the headline total from that same array (so it always reconciles), and renders `SpendingDonut` (pure SVG arcs) + the reused `MonthlySummary` bar list. Phase 2 then strips the summary out of `ExpensesManager` + `expenses.astro` and moves the shared component under `src/components/dashboard/`.

## Phases at a Glance

| Phase                 | What it delivers                                              | Key risk                                              |
| --------------------- | ------------------------------------------------------------ | ----------------------------------------------------- |
| 1. Dashboard view     | `/dashboard` with donut, total, per-category list, empty state | SVG arc math for the donut (the only non-trivial bit) |
| 2. Absorb the summary | Summary removed from Expenses; component relocated           | Cleanly unwiring `summary` state/prop/fetch w/o regressions |

**Prerequisites:** none — data layer, currency, and page/island pattern already exist; dashboard is already in the nav.
**Estimated effort:** ~1 session across 2 phases.

## Open Risks & Assumptions

- Donut slice math (proportions + arc offsets) is the one piece worth a focused check; a small helper + unit test de-risks it.
- Assumes `MonthlySummary` is used only by `ExpensesManager` (verified) so relocating it is safe.
- Accessibility guardrail: color is decorative — the bar list carries name + amount for every slice.

## Success Criteria (Summary)

- The dashboard shows a per-category donut, a headline total that reconciles with the breakdown, and a per-category list — with an empty state when there's no spend.
- The Expenses page no longer shows a summary and its list/add/edit/delete/filter all still work.
- `npm run lint`, `npm run build`, `npm run test:unit` all pass.
