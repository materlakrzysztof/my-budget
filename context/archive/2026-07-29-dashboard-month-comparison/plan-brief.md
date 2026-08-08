# Dashboard Month-over-Month Comparison — Plan Brief

> Full plan: `context/changes/dashboard-month-comparison/plan.md`

## What & Why

Add a month-over-month comparison to the dashboard so the user can see how this
month's spending moved versus last month — a change badge on the headline total
and a delta on each per-category row. This is roadmap S-09 / PRD FR-018 / US-05,
extending the shipped monthly dashboard (S-08).

## Starting Point

The dashboard already renders the current month via `getMonthlySummary(supabase,
userId, referenceDate)`, which reads a `monthly_category_summary` view keyed by
month and — crucially — already accepts a reference date. The S-08 plan explicitly
left this as the hook for S-09, so previous-month data is one extra call away. No
comparison exists today.

## Desired End State

When the previous calendar month had spend, the dashboard shows the total's change
(`↑ 12% (+240,00 zł) vs last month`) and per-category deltas over any category
active in either month — including `new` categories (no percentage) and `dropped`
ones (a decrease to zero). Increases read red/↑, decreases green/↓. When the
previous month had no spend, the comparison is fully hidden and the dashboard looks
exactly as it does today.

## Key Decisions Made

| Decision            | Choice                                                        | Why (1 sentence)                                                        | Source |
| ------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------- | ------ |
| Presentation        | Delta badge on total + inline per-category deltas            | Reuses the existing headline and breakdown rows; minimal new UI.       | Plan   |
| Hide rule           | Hide when the previous calendar month has zero spend         | Matches PRD "previous month" wording; avoids misleading "up from 0".   | Plan   |
| Metric              | Percentage + absolute amount                                 | Proportion and real money together are unambiguous; both already loaded. | Plan   |
| Zero-base category  | Show `new` tag instead of a percentage                       | Avoids meaningless ∞%/+100% when last month was 0.                     | Plan   |
| Direction semantics | Up = red, down = green, with arrow + sign (not color-alone)  | Matches a budgeter's mental model; satisfies the a11y guardrail.       | Plan   |
| Per-category scope  | Any category with spend in either month (incl. `dropped`)    | Honors "per-category where available"; surfaces both rises and drop-offs. | Plan   |
| Testing             | Unit for delta + hide logic; extend one dashboard e2e        | Deterministic coverage of the risky math + the user-visible hide behavior. | Plan   |

## Scope

**In scope:** a pure comparison service (`getMonthlyComparison` + testable
`computeComparison` helper) over the existing aggregation; previous-month date math
(year-boundary safe, UTC); total + per-category deltas with `new`/`dropped`
classification and a `comparisonAvailable` flag; dashboard UI (total badge + inline
row deltas); unit tests + one dashboard e2e.

**Out of scope:** multi-month trends/forecasting; comparison in the donut; new/
changed API endpoint; schema/migration/dependencies; a month picker or settable
baseline; i18n (S-11).

## Architecture / Approach

`dashboard.astro` calls `getMonthlyComparison`, which calls `getMonthlySummary`
twice (this month + computed previous month) and diffs them into a
`MonthlyComparison` payload. The diff lives in a pure `computeComparison` helper
(unit-tested, no Supabase). `DashboardView` renders the total badge; the breakdown
list is fed from the comparison's category union (with deltas) when available, else
the current-month rows exactly as today. The donut stays current-month-only.

## Phases at a Glance

| Phase                        | What it delivers                                             | Key risk                                                          |
| ---------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------- |
| 1. Comparison service + types | `getMonthlyComparison` + pure diff helper + types + unit tests | Edge-case math: 0-base %, new/dropped, year-boundary date.       |
| 2. Dashboard wiring + UI     | Total badge + inline per-category deltas + hide + e2e         | Breakdown must switch to the category union (dropped rows) cleanly. |

**Prerequisites:** S-08 monthly-dashboard (shipped). **Estimated effort:** ~1–2
sessions across 2 phases.

## Open Risks & Assumptions

- Totals are decimal **strings** — all delta math must go through `Number(...)` and
  format via `formatAmount`.
- The breakdown currently filters to `total > 0`; showing `dropped` rows is a
  deliberate departure from that filter, gated on comparison availability.
- Previous-month date math must be UTC to match `getMonthlySummary`, and roll the
  year back correctly for January.

## Success Criteria (Summary)

- With two months of data, the dashboard shows a reconciling total delta and
  per-category deltas with correct direction colors/arrows and `new`/`dropped` rows.
- With no prior-month spend, the comparison is hidden and the dashboard is unchanged.
- Lint, build, unit tests, and the dashboard e2e all pass.
