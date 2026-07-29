# Dashboard Month-over-Month Comparison Implementation Plan

## Overview

Add a month-over-month comparison to the dashboard: a change badge (percentage +
absolute amount) next to the headline total, and an inline delta on each
per-category breakdown row. The comparison covers the current month vs the
immediately-preceding calendar month, includes any category with spend in either
month (rises, `new`, and `dropped`-to-zero), and is **hidden entirely when the
previous calendar month had no spend** (so a misleading "up from zero" never
shows). This is roadmap S-09, PRD FR-018 and US-05. It builds directly on the
shipped S-08 dashboard and its existing aggregation — no schema, migration, or new
dependency.

## Current State Analysis

- **The previous-month figures are a solved query.** `getMonthlySummary(supabase,
  userId, referenceDate)` (`src/lib/services/expenses.ts:212`) already accepts a
  reference date and reads the `monthly_category_summary` view keyed by
  `date_trunc('month', e.date)::date` (`supabase/migrations/20260722090000_create_expenses.sql:29-37`).
  Passing a date in the prior month returns that month's per-category totals in the
  same `MonthlySummaryEntry[]` shape. The archived S-08 plan explicitly reserved
  this hook for S-09 (`context/archive/2026-07-27-monthly-dashboard/plan.md:32`).
- **The dashboard is presentation over `MonthlySummaryEntry[]`.**
  `src/components/dashboard/DashboardView.tsx` computes the headline total
  (`entries.reduce(... Number(entry.total) ...)`) and renders `SpendingDonut` +
  `MonthlySummary`. It filters to `spent = entries.filter(e => Number(e.total) > 0)`
  before passing to both — so `MonthlySummary` never currently shows a zero row.
- **`MonthlySummary`** (`src/components/dashboard/MonthlySummary.tsx`) renders per
  `categoryId`, colored by index (mirrors the donut palette via `colorForIndex`),
  each row linking to `/expenses?category=<id>`. This is where inline per-category
  deltas attach.
- **`MonthlySummaryEntry`** (`src/types.ts:50-55`) is `{ categoryId, categoryName,
  total: string, rank }`; `total` is a decimal **string**, so delta math must go
  through `Number(...)` and formatting through `formatAmount` (`src/lib/format.ts`).
- **The dashboard loads server-side.** `src/pages/dashboard.astro` builds the
  Supabase client and calls `getMonthlySummary` + `getOrCreateUserSettings`, then
  passes data to the `DashboardView` island via `client:load`. `/api/expenses/summary`
  serves only the current month and is **not** needed for this slice.

## Desired End State

On `/dashboard`, when the previous calendar month had any spend:

- The headline total shows a change indicator vs last month: an arrow + sign, a
  **percentage** and the **absolute amount** (e.g. `↑ 12% (+240,00 zł) vs last
  month`), styled **up = red / down = green** with the arrow and sign carrying the
  meaning (not color alone).
- Each per-category row shows its own delta with the same conventions. The
  breakdown lists **any category with spend in either month** — categories new
  this month are tagged `new` (no percentage), and categories that dropped to zero
  appear as a `dropped` row (a decrease to `0,00`).
- When the previous calendar month had **no** spend, none of the above renders —
  the dashboard looks exactly as it does today.

Verify via `npm run lint`, `npm run build`, `npm run test:unit`, an extended
dashboard e2e, and the manual steps below.

### Key Discoveries:

- Reuse `getMonthlySummary` with a prior-month reference date — no new query
  shape (`src/lib/services/expenses.ts:212`).
- The prior-month "history" signal is simply: does the previous month's summary
  have any `total > 0`? One call answers the hide rule.
- `DashboardView` filters to `total > 0` today; the comparison breakdown needs the
  **union** of categories across both months, so a `dropped` category (0 this
  month) can still get a row — a deliberate departure from the current filter.
- Delta math must go through `Number(entry.total)` (totals are strings) and format
  via `formatAmount` for the absolute amount.

## What We're NOT Doing

- **No multi-month trends / charts over time** — single previous-month comparison
  only (PRD Non-Goal: no trend lines or forecasting).
- **No comparison in the donut** — the donut keeps visualizing the current month's
  composition; comparison lives on the total and the breakdown rows.
- **No new API endpoint / no change to `/api/expenses/summary`** — the dashboard
  loads server-side via the service. (An optional `?month=` extension to the API
  is explicitly out of scope here.)
- **No schema, migration, or new dependency** — pure service + presentation.
- **No Polish translation of the new copy beyond matching the current app
  language** — i18n is roadmap S-11; this slice uses the app's current copy
  conventions.
- **No settable comparison baseline / month picker** — the baseline is always the
  immediately-preceding calendar month.

## Implementation Approach

Build the comparison as a pure, unit-testable service layer first (Phase 1):
compute the previous-month reference date (correct across the January→December
year boundary), fetch both months via `getMonthlySummary`, and produce a
`MonthlyComparison` value carrying the total delta, per-category deltas over the
union of categories, `new`/`dropped` classification, and a `comparisonAvailable`
flag driven by whether the previous month had any spend. Then wire it into the
dashboard and render it (Phase 2), reusing the headline total and `MonthlySummary`
rows rather than adding a parallel section.

## Critical Implementation Details

- **Previous-month date across the year boundary.** The prior reference date for a
  date in January must land in December of the previous year. Derive it from the
  current reference month (e.g. first-of-this-month minus one day, or
  `getUTCMonth()-1` with year rollover) using UTC to match `getMonthlySummary`'s
  existing UTC month-start logic (`src/lib/services/expenses.ts:217`) — do not mix
  local and UTC.
- **Accessibility (PRD guardrail): direction must not rely on color alone.** Each
  delta pairs an arrow (↑/↓) and an explicit sign with the color, and `new`/`dropped`
  use text tags — so the meaning survives without color perception.
- **Totals must reconcile (PRD guardrail).** The total delta is computed from the
  same summed `MonthlySummaryEntry.total` arrays the breakdown uses (current sum −
  previous sum), never a separately queried figure, so the headline delta can
  never disagree with the per-category deltas.

## Phase 1: Comparison service + types

### Overview

Add the pure comparison computation and its types, with unit tests covering the
delta math, `new`/`dropped` classification, the previous-month date math, and the
`comparisonAvailable` hide rule. No UI yet.

### Changes Required:

#### 1. Comparison + delta types

**File**: `src/types.ts`

**Intent**: Describe the comparison payload the service returns and the view
consumes, so both share one contract.

**Contract**: Add a `CategoryDelta` type — the per-category row for the breakdown
union: `{ categoryId, categoryName, current: string, previous: string, changeAmount: string, changePercent: number | null, status: "changed" | "new" | "dropped", rank }` (exact field set may be refined during implementation, but must carry current/previous totals, the absolute change, a percentage that is `null` when the previous base is 0, and the new/dropped classification). Add a `MonthlyComparison` type: `{ currentTotal: string, previousTotal: string, totalChangeAmount: string, totalChangePercent: number | null, categories: CategoryDelta[], comparisonAvailable: boolean }`.

#### 2. Comparison computation service

**File**: `src/lib/services/expenses.ts`

**Intent**: Given the current month's summary, produce the full `MonthlyComparison`
by also loading the previous month and diffing the two — reusing
`getMonthlySummary` for both months so aggregation logic is not duplicated.

**Contract**: Add `getMonthlyComparison(supabase, userId, referenceDate = new
Date()): Promise<MonthlyComparison>`. It calls `getMonthlySummary` for
`referenceDate` and for the computed previous-month date, then diffs. Also extract
a **pure** helper (e.g. `computeComparison(current: MonthlySummaryEntry[],
previous: MonthlySummaryEntry[]): MonthlyComparison`) that the unit tests target
directly (no Supabase). Rules the helper enforces:
- `comparisonAvailable = sum(previous.total) > 0`.
- `categories` = union by `categoryId` over both months; each entry carries its
  current and previous totals (missing side = `"0.00"`).
- `status`: `"new"` when previous = 0 and current > 0; `"dropped"` when previous > 0
  and current = 0; else `"changed"`.
- `changePercent` = `null` when the previous base is 0 (rendered as `new`), else
  `(current − previous) / previous * 100`.
- Preserve/derive a `rank`/order consistent with the current breakdown
  (current-month spend desc, then name) so row order matches today's dashboard.

#### 3. Previous-month date helper

**File**: `src/lib/services/expenses.ts` (same module)

**Intent**: Compute the first-of-previous-month date to pass as the reference,
correct across the year boundary and in UTC.

**Contract**: A small helper deriving the previous month's reference date from a
given `Date` in UTC (January → December of the prior year). Used by
`getMonthlyComparison`; may be unit-tested directly.

#### 4. Unit tests

**File**: `src/lib/services/expenses.test.ts`

**Intent**: Lock the comparison math and edge cases without hitting Supabase.

**Contract**: Cover `computeComparison` for: both-months-present increase and
decrease (percentage + absolute correct); `new` category (previous 0 → percentage
`null`, status `new`); `dropped` category (current 0 → row present, status
`dropped`); `comparisonAvailable = false` when previous month sums to 0;
total delta reconciles with the sum of per-category current/previous. Cover the
previous-month date helper for a mid-year month and for January (→ prior-year
December).

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Type check + production build succeeds: `npm run build`
- Unit tests pass: `npm run test:unit`

#### Manual Verification:

- (Deferred to Phase 2 — no user-visible surface yet.)

**Implementation Note**: After completing this phase and all automated
verification passes, pause here for manual confirmation before proceeding to
Phase 2.

---

## Phase 2: Dashboard wiring + comparison UI

### Overview

Load the comparison on the dashboard and render it: the total delta badge, inline
per-category deltas over the union of categories (incl. `new`/`dropped`), with
up=red / down=green plus arrow+sign, hidden entirely when
`comparisonAvailable` is false. Extend a dashboard e2e to assert show/hide.

### Changes Required:

#### 1. Load the comparison on the dashboard page

**File**: `src/pages/dashboard.astro`

**Intent**: Replace (or supplement) the current-month-only load with the
comparison payload so the island receives both this month's data and the deltas.

**Contract**: Call `getMonthlyComparison(supabase, user.id)` in frontmatter
(guarded like the existing `getMonthlySummary` call) and pass the result to
`<DashboardView … />`. Keep currency loading unchanged. The donut/headline still
derive from the current-month entries carried inside the comparison payload (or
continue passing `entries` alongside `comparison` — implementer's call, as long as
totals reconcile).

#### 2. Total delta badge

**File**: `src/components/dashboard/DashboardView.tsx`

**Intent**: Show the headline total's change vs last month when the comparison is
available.

**Contract**: When `comparison.comparisonAvailable`, render a badge near the
headline total with an arrow (↑/↓), sign, `totalChangePercent` and the formatted
`totalChangeAmount` (via `formatAmount`), plus a "vs last month" label. Up = red,
down = green; arrow + sign carry meaning independent of color. When unavailable,
render nothing (dashboard unchanged). No change to the donut.

#### 3. Inline per-category deltas (breakdown union)

**File**: `src/components/dashboard/MonthlySummary.tsx` (and how `DashboardView`
feeds it)

**Intent**: Annotate each breakdown row with its delta and include `new`/`dropped`
categories so meaningful decreases are visible.

**Contract**: Feed the breakdown from `comparison.categories` (the union) instead
of the current filtered `spent` list when the comparison is available; each row
shows its per-category delta using the same arrow/sign/color + percentage/absolute
convention, with a `new` tag (no percentage) and a `dropped` row rendering the
decrease to `0,00`. Preserve the existing per-row drill-down link and palette
swatch. When the comparison is unavailable, render the breakdown exactly as today
(current-month `spent` rows, no deltas). Keep the donut fed by current-month
spend > 0 only.

#### 4. Extend dashboard e2e

**File**: `tests/e2e/` (extend an existing dashboard/expenses-summary spec or add
a focused `dashboard-month-comparison.spec.ts`)

**Intent**: Verify the comparison shows with two months of data and is hidden with
only current-month data.

**Contract**: Using unique per-run identifiers and role/text locators (per project
E2E rules — no `waitForTimeout`, wait on visible state): seed prior-month + current
-month expenses and assert the comparison badge/deltas appear; in a fresh
single-month scenario assert the comparison is absent. Follow the `/10x-e2e`
conventions and existing `tests/e2e/helpers.ts` seeding.

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Type check + production build succeeds: `npm run build`
- Unit tests pass: `npm run test:unit`
- E2E passes: `npm run test:e2e` (the extended/added dashboard comparison spec)

#### Manual Verification:

- With expenses in both the current and previous month, the dashboard shows a
  total delta (percentage + absolute) and per-category deltas.
- Increases render red with ↑, decreases green with ↓; meaning is clear without
  color.
- A category new this month shows a `new` tag (no percentage); a category active
  last month but not this month appears as a `dropped` row.
- With only current-month data (previous month empty), the comparison is fully
  hidden — the dashboard matches its pre-change appearance.
- The total delta reconciles with the per-category deltas.

**Implementation Note**: Final phase — after automated + manual verification, the
change is ready for `/10x-impl-review`.

---

## Testing Strategy

### Unit Tests:

- `computeComparison`: increase/decrease percentages + absolutes; `new` (base 0 →
  `null` percent); `dropped` row present; `comparisonAvailable` false when previous
  month sums to 0; total delta reconciles with per-category.
- Previous-month date helper: mid-year month and January→prior-year-December.

### Integration Tests:

- None required — no new API or data-model surface; the underlying aggregation is
  unchanged and already covered.

### Manual Testing Steps:

1. Seed a few expenses last month and this month across 2-3 categories.
2. Open `/dashboard`: confirm the total delta and per-category deltas, correct
   direction colors/arrows, and that the total reconciles with the rows.
3. Add a category with spend only this month → confirm `new` tag (no percentage).
4. Ensure a category had spend last month but none this month → confirm a
   `dropped` row showing the decrease to zero.
5. Use a fresh account / a month with no prior-month spend → confirm the whole
   comparison is hidden and the dashboard looks unchanged.

## Performance Considerations

Negligible — one additional `monthly_category_summary` read for the previous month
(the same indexed query already used for the current month), plus O(categories)
client-side diffing. No new round-trips on the client.

## Migration Notes

None — no schema or data changes.

## References

- Roadmap slice: `context/foundation/roadmap.md` → S-09 `dashboard-month-comparison`
- PRD: `context/foundation/prd.md` → FR-018, US-05
- Aggregation service (reused): `src/lib/services/expenses.ts:212` (`getMonthlySummary`)
- Summary view (month grouping): `supabase/migrations/20260722090000_create_expenses.sql:29-37`
- Dashboard presentation: `src/components/dashboard/DashboardView.tsx`,
  `src/components/dashboard/MonthlySummary.tsx`
- Prior slice that reserved this hook: `context/archive/2026-07-27-monthly-dashboard/plan.md:32`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Comparison service + types

#### Automated

- [x] 1.1 Linting passes: `npm run lint`
- [x] 1.2 Type check + production build succeeds: `npm run build`
- [x] 1.3 Unit tests pass: `npm run test:unit`

### Phase 2: Dashboard wiring + comparison UI

#### Automated

- [ ] 2.1 Linting passes: `npm run lint`
- [ ] 2.2 Type check + production build succeeds: `npm run build`
- [ ] 2.3 Unit tests pass: `npm run test:unit`
- [ ] 2.4 E2E passes: `npm run test:e2e` (dashboard comparison spec)

#### Manual

- [ ] 2.5 Both-month data shows total + per-category deltas
- [ ] 2.6 Increase = red ↑, decrease = green ↓; meaning clear without color
- [ ] 2.7 `new` category tagged (no percentage); `dropped` category shows a row
- [ ] 2.8 With no prior-month spend, the comparison is fully hidden
- [ ] 2.9 Total delta reconciles with per-category deltas
