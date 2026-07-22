# Log and Summarize Expenses — Plan Brief

> Full plan: `context/changes/log-and-summarize-expenses/plan.md`
> Research: `context/changes/log-and-summarize-expenses/research.md`

## What & Why

Build the MVP's north star: a signed-in user logs an expense (today's date or backdated, positive amount, a category they own) and sees it reflected in a ranked, month-end per-category summary. This closes roadmap slice S-03 (FR-006–FR-009, US-01, US-02) and is the largest slice in the project — the second data table, the first full CRUD surface, the first SQL view, and the first dialog UI primitive.

## Starting Point

The `expense-categories` feature (S-02) shipped a complete, reusable template: a Supabase table with per-operation RLS, a `src/lib/services/` module, JSON API routes, and a Manager/List/Form/Alert React-island composition. No expense, date-math, or aggregation code exists anywhere yet — this plan builds on that template from a clean slate on those axes. `dashboard.astro` remains an untouched placeholder; the new feature gets its own route.

## Desired End State

Visiting `/expenses` shows every one of the user's categories in a ranked summary (largest spend first, `$0.00` with a zero-width bar for unused categories) and a list of logged expenses. Adding, editing, or deleting an expense via a dialog updates both the list and the summary immediately, with no page reload. A backdated expense never affects the current month's total. RLS and a composite foreign key together guarantee no user can read, write, or mis-attribute another user's data.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Amount column type | `numeric(12,2)`, kept as a string end-to-end in the app | DB-native decimal avoids float drift on the summed total; matches the "always reconciles" guardrail | Plan (user-confirmed) |
| Expense mutability | Full edit + delete | User chose full CRUD over the leaner add-only precedent categories used | Plan (user-confirmed) |
| Feature placement | New dedicated `/expenses` page | Mirrors the `/categories` precedent; leaves `dashboard.astro` untouched | Plan (user-confirmed) |
| Aggregation | A `security_invoker` Postgres view, `GROUP BY` per user/category/month | DB-side single source of truth avoids the "oracle problem" and JS float drift | Plan (user-confirmed) |
| Backdating bound | No lower bound; future dates blocked via a DB check constraint | Matches FR-006/FR-007's literal wording, no invented limit | Plan (user-confirmed) |
| Empty categories in summary | Shown at `$0.00`, not omitted | User chose completeness over a leaner "only categories with spend" view | Plan (user-confirmed) |
| Add/edit UX | Dialog overlay (first dialog primitive in this codebase) | User chose a modal flow over inline/on-page form | Plan (user-confirmed) |
| Amount validity | Strictly positive only, no zero/negative | Matches "expense" semantics; no PRD signal for refunds | Plan (user-confirmed) |
| Summary visualization | Ordered list + CSS proportional bar, no chart library | At-a-glance magnitude comparison with zero new dependencies | Plan (user-confirmed) |
| Category ownership | Composite FK `(user_id, category_id) → categories(user_id, id)` | RLS alone doesn't stop a client posting another user's category_id; closes a real data-integrity gap found during planning | Plan |
| Category picker | Native `<select>`, not a new shadcn component | Keeps this slice's new-dependency surface to just the dialog | Plan |
| Delete confirmation | In-app dialog, not native `confirm()` | Keeps delete testable and consistent with browser-automation guidance against native dialogs | Plan |

## Scope

**In scope:**
- `expenses` table, full RLS (select/insert/update/delete), ownership-enforcing composite FK, `monthly_category_summary` view
- CRUD service layer + JSON API routes (`/api/expenses`, `/api/expenses/[id]`, `/api/expenses/summary`)
- `/expenses` page: expense list, add/edit dialog, ranked summary with CSS bars
- Unit tests for the pure ranking/validation logic
- 4 risk-tied E2E specs (add+summary reconciliation, backdated attribution, edit, delete)

**Out of scope:**
- Month-over-month trends, a month selector, CSV export, AI categorization, bank import, shared budgets (all PRD Non-Goals)
- Zero/negative amounts, a backdating lower bound, pagination/search/filtering, bulk operations
- A general DB-level integration-test layer (that's the sibling `testing-data-isolation-summary` change's job)

## Architecture / Approach

Same four-layer template as `expense-categories`: migration → types → service (zod + row-mapper + typed errors) → API routes (auth-first, status mapping) → SSR page (direct service call) → React island. Two new patterns: a `security_invoker` SQL view is the single source of truth for the summary total (never re-summed in JS), and a composite FK enforces that an expense's category always belongs to its own user — a gap plain RLS doesn't close on its own.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Database schema | `expenses` table, full RLS, ownership FK, summary view | `security_invoker` omitted → view leaks cross-user totals |
| 2. Service, types, API | CRUD + summary endpoints, unit-tested ranking logic | Amount/date handled as a JS number/float somewhere, reintroducing drift |
| 3. UI | `/expenses` page, dialog, ranked summary with bars | Optimistic UI patches summary without refetching after an edit that changes month/category |
| 4. E2E coverage | 4 risk-tied Playwright specs | Category-mixup or month-attribution bugs invisible without ≥2 categories / boundary dates in the test |

**Prerequisites:** `expense-categories` (S-02) shipped and reviewed — confirmed. E2E Supabase project from `account-signin-signout` — confirmed working.
**Estimated effort:** ~4 sessions across 4 phases — the largest slice in the project so far.

## Open Risks & Assumptions

- Assumes the Supabase project's Postgres session timezone is UTC (verified manually in Phase 1); if it isn't, the `date <= current_date` check constraint and the app's "today" could disagree.
- The composite FK's `on delete restrict` on `category_id` is currently untestable end-to-end (categories have no delete path yet) — verified only as "the constraint exists," not exercised against a real delete.
- Full CRUD (the user's chosen scope) is meaningfully larger than the categories precedent; if time is tight, edit/delete could be descoped to delete-only or add-only in a follow-up decision, but the plan below is written for full CRUD as decided.

## Success Criteria (Summary)

- A user can add an expense (today or backdated), see it in their list, and see the correct category's summary total update immediately.
- A backdated expense never changes the current month's summary; the summary total always equals the sum of that month's entries for each category.
- No user can read, write, or misattribute another user's expenses or categories, verified via RLS and the composite FK.
