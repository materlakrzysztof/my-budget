# Monthly Dashboard Implementation Plan

## Overview

Turn the placeholder `dashboard.astro` into a real monthly dashboard: a per-category spending chart (hand-rolled SVG donut), a headline total for the current month, and a per-category breakdown list. Then remove the "This month's summary" block from the Expenses page so the dashboard truly **absorbs** the existing summary. This is roadmap S-08 (the iteration-3 north star), covering PRD FR-015, FR-016, FR-017, and US-05.

## Current State Analysis

- **`dashboard.astro`** (`src/pages/dashboard.astro`) is a placeholder — a welcome card showing the user's email, nothing data-driven.
- **The monthly summary already exists and renders on the Expenses page.** `expenses.astro:18` loads it via `getMonthlySummary(supabase, user.id)` and passes it to `ExpensesManager` (`initialSummary`), which renders a "This month's summary" heading + `<MonthlySummary>` (`ExpensesManager.tsx:148-152`) and re-fetches it in `refresh()` (`ExpensesManager.tsx:65,72-75`).
- **Aggregation is done server-side.** `getMonthlySummary` (`src/lib/services/expenses.ts:212`) reads a `monthly_category_summary` view for the current month, merges with all categories, and returns `MonthlySummaryEntry[]` — `{ categoryId, categoryName, total (string), rank }`, sorted by total desc. It accepts an optional `referenceDate` (this is what S-09 month-comparison will use later).
- **`MonthlySummary.tsx`** (`src/components/expenses/MonthlySummary.tsx`) is already a per-category horizontal-bar visualization with drill-down links (`/expenses?category=<id>`). It renders **all** entries, including `0.00` ones. It is used **only** by `ExpensesManager`.
- **Currency**: `getOrCreateUserSettings` (`src/lib/services/settings.ts:28`) → `settings.currency`; `formatAmount(total, currency)` (`src/lib/format.ts`, called as `formatAmount(entry.total, currency)`) renders amounts.
- **Page/island pattern**: `.astro` frontmatter builds a Supabase client, calls services, and passes data to a React island via `client:load` (see `expenses.astro:9-38`). Dashboard is already reachable from the persistent nav (S-04).
- **No charting library** is installed (verified against `package.json`).

## Desired End State

Visiting `/dashboard` shows, for the current month:

- A **donut chart** of spending split by category (only categories with spend > 0).
- A **headline total** — the sum of all of this month's expenses, in the user's currency.
- A **per-category breakdown list** (reusing the existing bar-list component), each row linking to that category's filtered expenses.
- When there are no expenses this month, a friendly **empty state** with a link to add an expense.

The Expenses page (`/expenses`) no longer shows a summary — it is a focused expense list. Verify via `npm run lint`, `npm run build`, `npm run test:unit`, and the manual steps below.

### Key Discoveries:

- Aggregation, currency, and the page/island pattern all already exist — this slice is presentation over existing data (`src/lib/services/expenses.ts:212`, `src/lib/services/settings.ts:28`, `expenses.astro:9-38`).
- `MonthlySummary.tsx` is reusable as the per-category list, but renders `0.00` entries — the dashboard must filter to `total > 0` before passing entries.
- `getMonthlySummary` already takes a `referenceDate` — S-09 (month-over-month) will reuse it; no change needed here.
- `MonthlySummary` has exactly one caller (`ExpensesManager`); once absorbed, it belongs under the dashboard.

## What We're NOT Doing

- **No month-over-month comparison** — that is FR-018 / roadmap S-09, a separate slice. The dashboard is built to make it easy to add later (via `getMonthlySummary(referenceDate)`), but the comparison UI is out of scope.
- **No quick-add-from-dashboard** — that is FR-019 / roadmap S-10. The empty state links to the existing `/expenses?action=add`; no new add flow is built here.
- **No charting library** — the chart is a hand-rolled SVG donut. No new dependency.
- **No new API endpoint and no migration** — the dashboard loads server-side via the existing service; `/api/expenses/summary` is left as-is.
- **No Polish translation** — copy stays in the current app language; i18n is roadmap S-11.
- **No change to the aggregation logic or totals** — the dashboard re-presents the same numbers.

## Implementation Approach

Build the dashboard first (Phase 1) so the summary exists in both places transiently — never a moment where no summary is reachable — then remove it from the Expenses page and relocate the shared component (Phase 2). Reuse `getMonthlySummary`, `formatAmount`, and `MonthlySummary` rather than reimplementing. The donut is pure SVG driven by the same `MonthlySummaryEntry[]`.

## Critical Implementation Details

- **Accessibility (PRD guardrail): the chart must not rely on color alone.** The per-category bar list beneath the donut carries the category name + amount for every slice, so color is decorative, not the sole signal. Keep that list present whenever the donut is shown.
- **Totals must reconcile (PRD guardrail).** The headline total is the sum of the same `MonthlySummaryEntry.total` values the list/donut use — compute it once from that array (`entries.reduce((s, e) => s + Number(e.total), 0)`), do not query a second source, so the headline can never disagree with the breakdown.

## Phase 1: Dashboard view

### Overview

Build `dashboard.astro` to load the summary + currency server-side and render a new `DashboardView` React island: donut (spend > 0), headline total, per-category bar list, and empty state.

### Changes Required:

#### 1. Dashboard page — server-side data load

**File**: `src/pages/dashboard.astro`

**Intent**: Replace the placeholder card with a data-driven page that loads the current-month summary and the user's currency, mirroring `expenses.astro`, and renders the dashboard island.

**Contract**: In frontmatter, build the Supabase client (`createClient`), then `const summary = await getMonthlySummary(supabase, user.id)` and `const settings = await getOrCreateUserSettings(supabase, user.id)` (guard on `supabase && user` like `expenses.astro`, defaulting `currency` to `"USD"`). Render `<DashboardView entries={summary} currency={settings.currency} client:load />` inside the existing `Layout`. Keep the page under the same auth-protected route (no middleware change).

#### 2. Dashboard island — donut + total + breakdown + empty state

**File**: `src/components/dashboard/DashboardView.tsx` (new)

**Intent**: Render the full dashboard from `MonthlySummaryEntry[]` + `Currency`: a headline total, an SVG donut of categories with spend, and the per-category bar list, or an empty state when there is no spend this month.

**Contract**: Props `{ entries: MonthlySummaryEntry[]; currency: Currency }`. Derive `spent = entries.filter(e => Number(e.total) > 0)`. If `spent.length === 0`, render the empty state (see change 4). Otherwise render: (a) headline total = `formatAmount(entries.reduce((s,e)=>s+Number(e.total),0).toFixed(2), currency)`; (b) `<SpendingDonut entries={spent} />`; (c) `<MonthlySummary entries={spent} currency={currency} />` for the per-category breakdown. Match the existing cosmic/glass card styling used on other pages.

#### 3. SVG donut chart

**File**: `src/components/dashboard/SpendingDonut.tsx` (new)

**Intent**: Draw a pure-SVG donut where each category's arc is proportional to its share of the month's total, with a small distinct-color palette.

**Contract**: Props `{ entries: MonthlySummaryEntry[] }` (already filtered to spend > 0). Compute each slice's fraction of the sum and render arc segments (stroke-dasharray on concentric circle segments, or path arcs) around a ring. Define a fixed palette array and assign colors by index; the same index/color is mirrored as a swatch in the breakdown rows so color maps to category. Non-interactive/decorative (the bar list carries the accessible name + amount). This is the one non-obvious piece — SVG arc math:

```tsx
// stroke-dash approach: one <circle> per slice on a shared ring,
// offset by the cumulative fraction so slices sit end-to-end.
const R = 60, C = 2 * Math.PI * R;
let offset = 0;
// for each entry: len = (Number(e.total)/sum) * C;
//   <circle r={R} strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset} .../>
//   offset += len;
```

#### 4. Empty state

**File**: `src/components/dashboard/DashboardView.tsx` (same file as change 2)

**Intent**: When there is no spend this month, show a friendly message and a link to add an expense.

**Contract**: Render a short message plus a link/anchor to `/expenses?action=add` (the existing add-expense entry point honored by `ExpensesManager`'s `autoOpenAdd`). No new add flow — a plain link.

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Type check + production build succeeds: `npm run build`
- Unit tests pass: `npm run test:unit`

#### Manual Verification:

- `/dashboard` shows a donut, a correct headline total, and a per-category list for the current month.
- The headline total equals the sum of the per-category amounts (reconciles with the Expenses page numbers).
- Categories with no spend this month do not appear in the donut or the list.
- With no expenses this month, the empty state shows and its link opens the add-expense flow.
- Each per-category row still links to that category's filtered expenses.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 2.

---

## Phase 2: Absorb the summary (remove from Expenses)

### Overview

Remove the summary from the Expenses page so the dashboard is the single home for it, and relocate the shared `MonthlySummary` component under the dashboard.

### Changes Required:

#### 1. Drop the summary from the Expenses manager

**File**: `src/components/expenses/ExpensesManager.tsx`

**Intent**: Stop rendering and fetching the monthly summary here; the Expenses page becomes a focused expense list.

**Contract**: Remove the "This month's summary" block (`ExpensesManager.tsx:148-152`), the `summary`/`setSummary` state, the `initialSummary` prop (and its type-usage), and the summary fetch in `refresh()` (drop the `/api/expenses/summary` call and its `Promise.all` pairing, leaving the expenses fetch). Remove the now-unused `MonthlySummary`, `MonthlySummaryEntry`, `MonthlySummaryResponse` imports.

#### 2. Stop loading the summary on the Expenses page

**File**: `src/pages/expenses.astro`

**Intent**: Remove the summary data-load and prop now that the manager no longer needs it.

**Contract**: Delete the `getMonthlySummary` import and the `const summary = ...` line, and remove `initialSummary={summary}` from the `<ExpensesManager>` props. Leave categories, expenses, currency, filter, and `autoOpenAdd` untouched.

#### 3. Relocate the shared component to the dashboard

**File**: `src/components/expenses/MonthlySummary.tsx` → `src/components/dashboard/MonthlySummary.tsx`

**Intent**: The summary bar-list now belongs to the dashboard (its only remaining caller); move it there and repoint the import.

**Contract**: Move the file to `src/components/dashboard/MonthlySummary.tsx` (contents unchanged) and update the import in `DashboardView.tsx` to the new path. No other caller remains after change 1.

### Success Criteria:

#### Automated Verification:

- Linting passes (no unused imports/vars): `npm run lint`
- Type check + production build succeeds: `npm run build`
- Unit tests pass: `npm run test:unit`

#### Manual Verification:

- The Expenses page no longer shows a "This month's summary" block; the expense list, add, edit, delete, and category filter still work.
- The dashboard still renders correctly after the component relocation.
- No console errors on either page.

**Implementation Note**: Final phase — after automated + manual verification, the change is ready for `/10x-impl-review`.

---

## Testing Strategy

### Unit Tests:

- Existing `expenses`/`settings`/`format` unit suites remain green (no service changes here).
- If a pure helper is extracted for the donut slice math or the total sum, add a focused unit test for it (proportions sum to the whole; empty input handled).

### Integration Tests:

- None required — no new API or data-model surface. The existing summary integration behavior is unchanged (same service).

### Manual Testing Steps:

1. Sign in, log a few expenses across 2-3 categories this month.
2. Open `/dashboard`: confirm the donut splits by category, the headline total matches the sum, and the per-category list matches the Expenses numbers.
3. Confirm a category with zero spend this month is absent from the dashboard.
4. Delete all of this month's expenses (or use a fresh month): confirm the empty state + add link.
5. Open `/expenses`: confirm no summary block, and list/add/edit/delete/filter all still work.
6. Click a per-category row on the dashboard: confirm it opens that category's filtered expenses.

## Performance Considerations

Negligible — one already-existing aggregation query per dashboard load, and a client-side sum over a handful of category entries. The donut is O(categories) SVG nodes.

## Migration Notes

None — no schema or data changes. Purely presentational relocation.

## References

- Roadmap slice: `context/foundation/roadmap.md` → S-08 `monthly-dashboard`
- PRD: `context/foundation/prd.md` → FR-015, FR-016, FR-017, US-05
- Aggregation service: `src/lib/services/expenses.ts:212` (`getMonthlySummary`)
- Currency: `src/lib/services/settings.ts:28`, `src/lib/format.ts` (`formatAmount`)
- Page/island pattern: `src/pages/expenses.astro:9-38`
- Component being absorbed: `src/components/expenses/MonthlySummary.tsx`, used at `src/components/expenses/ExpensesManager.tsx:148-152`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Dashboard view

#### Automated

- [x] 1.1 Linting passes (`npm run lint`)
- [x] 1.2 Type check + production build succeeds (`npm run build`)
- [x] 1.3 Unit tests pass (`npm run test:unit`)

#### Manual

- [x] 1.4 `/dashboard` shows donut, correct headline total, and per-category list
- [x] 1.5 Headline total equals the sum of per-category amounts (reconciles with Expenses)
- [x] 1.6 Zero-spend categories are absent from donut and list
- [x] 1.7 Empty state shows with a working add-expense link when no expenses this month
- [x] 1.8 Each per-category row links to that category's filtered expenses

### Phase 2: Absorb the summary (remove from Expenses)

#### Automated

- [ ] 2.1 Linting passes, no unused imports/vars (`npm run lint`)
- [ ] 2.2 Type check + production build succeeds (`npm run build`)
- [ ] 2.3 Unit tests pass (`npm run test:unit`)

#### Manual

- [ ] 2.4 Expenses page no longer shows the summary; list/add/edit/delete/filter still work
- [ ] 2.5 Dashboard still renders correctly after the component relocation
- [ ] 2.6 No console errors on either page
