---
project: MyBudget
version: 2
status: active
created: 2026-07-27
updated: 2026-07-30
prd_version: 4
main_goal: low-complexity
top_blocker: decisions
---

# Roadmap: MyBudget

> Derived from `context/foundation/prd.md` (v4) + auto-researched codebase baseline.
> Supersedes the archived roadmap at `context/foundation/archive/2026-07-27-roadmap.md`.
> This regeneration sequences **iteration 3** (dashboard, UX improvements, AI-assisted
> entry). Everything from v1 + v2 and the `category-editing` change is shipped and
> lives in `## Done`; PRD FR-001–FR-014 and FR-004 are therefore covered by completed
> work, and the new slices below cover FR-015–FR-028.
> Slices are listed in dependency order. The "At a glance" table is the index.

## Vision recap

MyBudget is a live personal expense tracker in daily use by one household budgeter. The shipped app lets the user log expenses, categorize them, set a currency, and read a flat month-end summary that ranks categories by total spend. Three gaps surfaced from real use and form this iteration: no visual monthly **dashboard** (chart, headline total, month-over-month movement), UX/navigation friction (English-only UI, no landing page, non-sticky header, category management off in its own page, no quick add, no in-page expense filter), and fully manual expense entry the user wants to speed up with AI-assisted parsing of free text.

## North star

**S-08: user can open a monthly dashboard showing this month's spending as a per-category chart, a headline total, and per-category totals** — it is the headline value of the iteration, it absorbs the existing flat summary, and it traces directly to the v3 primary Success Criterion and US-05.

> "North star" here means the smallest end-to-end, user-visible slice whose successful delivery proves the iteration was worth doing — placed as early as its prerequisites allow because the rest of the iteration only matters once the user can actually *see* their month at a glance.

## At a glance

| ID   | Change ID                   | Outcome (user can …)                                             | Prerequisites | PRD refs                | Status   |
| ---- | --------------------------- | ---------------------------------------------------------------- | ------------- | ----------------------- | -------- |
| S-08 | monthly-dashboard           | see a monthly dashboard: per-category chart, total, per-category | —             | FR-015, FR-016, FR-017, US-05 | done     |
| S-09 | dashboard-month-comparison  | see current vs previous month (hidden when no history)           | S-08          | FR-018, US-05           | done     |
| S-10 | dashboard-quick-add         | start adding an expense in one click from the dashboard          | S-08          | FR-019                  | done     |
| S-11 | polish-ui                   | see the entire UI in Polish (message-key layer)                  | —             | FR-020                  | ready    |
| S-12 | landing-page                | (visitor) see a public landing page; authed users go to dashboard| —             | FR-021                  | done     |
| S-13 | sticky-nav-header           | keep the nav header visible while scrolling                      | —             | FR-022                  | done     |
| S-14 | categories-in-settings      | manage categories from Settings (old route redirects)            | —             | FR-023                  | done     |
| S-15 | expenses-category-filter    | filter the expenses list via an in-page category picker          | —             | FR-024                  | ready    |
| S-16 | add-expense-dialog          | add an expense through a modal/dialog                            | —             | FR-025                  | ready    |
| S-17 | ai-assisted-expense-entry   | parse free text into reviewable expenses before saving           | S-16          | FR-026, FR-027, FR-028, US-06 | blocked  |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this is the proposed reading order across parallel tracks.

| Stream | Theme            | Chain                          | Note                                                             |
| ------ | ---------------- | ------------------------------ | --------------------------------------------------------------- |
| A      | Dashboard        | `S-08` → `S-09` / `S-10`       | North-star chain; S-09 and S-10 run in parallel after S-08.     |
| B      | UX & navigation  | `S-11`, `S-12`, `S-13`, `S-14`, `S-15` | Independent quick wins — all parallel, no cross-dependencies.   |
| C      | Assisted entry   | `S-16` → `S-17`                | S-17 blocked on AI-provider decisions; S-16 ships independently. |

## Baseline

What's already in place in the codebase as of 2026-07-27 (auto-researched + user-confirmed). Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present — Astro 6 SSR + React 19 islands (`src/pages`, `src/components`).
- **Backend / API:** present — API routes under `src/pages/api/{auth,expenses,categories,settings}`.
- **Data:** present — Supabase Postgres with 6 migrations in `supabase/migrations/`, per-user RLS.
- **Auth:** present — Supabase SSR + `src/middleware.ts` (PROTECTED_ROUTES redirect).
- **Deploy / infra:** present — `@astrojs/cloudflare` (Workers) + GitHub Actions CI (lint + build + migration-safety), gated deploy-on-merge.
- **Observability:** absent — no logging/error-tracking library in `src/`. Not required by this iteration's PRD.
- **i18n:** absent — no message-key layer today; introduced within S-11 (Polish UI), not as a standalone foundation.

## Foundations

None for this iteration. Every application layer is already present (see `## Baseline`); the one cross-cutting technical element this iteration adds — the i18n message-key layer — is introduced inside the first slice that needs it (S-11), and the external AI dependency is introduced inside S-17. Progressive disclosure over pre-built layers.

## Slices

### S-08: Monthly dashboard (chart + total + per-category)

- **Outcome:** user can open a monthly dashboard and see this month's spending as a per-category chart, a headline total, and per-category totals; the existing flat summary is absorbed here.
- **Change ID:** monthly-dashboard
- **PRD refs:** FR-015, FR-016, FR-017, US-05
- **Prerequisites:** — (expense/category data and the current aggregation already exist)
- **Parallel with:** S-11, S-12, S-13, S-14, S-15, S-16
- **Blockers:** —
- **Unknowns:** —
- **Risk:** absorbs the existing monthly summary — the dashboard's total and per-category figures must reconcile exactly with the underlying records; low risk since the aggregation already exists and is only re-presented.
- **Status:** done

### S-09: Month-over-month comparison

- **Outcome:** user can see the current month's spending compared against the previous month (total, and per-category where available); the comparison is hidden when there is no prior-month history.
- **Change ID:** dashboard-month-comparison
- **PRD refs:** FR-018, US-05
- **Prerequisites:** S-08
- **Parallel with:** S-10
- **Blockers:** —
- **Unknowns:** — (empty-state resolved in PRD: hide when no history)
- **Risk:** adds a prior-month aggregation; the empty state must not mislead (hidden, not shown as a zero/false drop).
- **Status:** done

### S-10: Quick add from dashboard

- **Outcome:** user can start adding an expense in one click from the dashboard.
- **Change ID:** dashboard-quick-add
- **PRD refs:** FR-019
- **Prerequisites:** S-08
- **Parallel with:** S-09
- **Blockers:** —
- **Unknowns:** —
- **Risk:** trivial entry point; low risk. If S-16 lands first, this opens the add-expense dialog rather than a separate page.
- **Status:** done

### S-11: Polish UI

- **Outcome:** user sees the entire UI in Polish; strings are served from a lightweight message-key layer (no language-switcher UI).
- **Change ID:** polish-ui
- **PRD refs:** FR-020
- **Prerequisites:** —
- **Parallel with:** S-08, S-12, S-13, S-14, S-15, S-16
- **Blockers:** —
- **Unknowns:** —
- **Risk:** introduces a message-key layer touching all existing views — mechanical but broad; sequencing this early lets later slices adopt keys from the start (a soft preference, not a hard prerequisite).
- **Status:** done

### S-12: Landing page

- **Outcome:** an unauthenticated visitor sees a public landing page describing the app's capabilities; authenticated users are routed to the dashboard.
- **Change ID:** landing-page
- **PRD refs:** FR-021
- **Prerequisites:** — (soft: the dashboard is the authed redirect target; falls back to the existing home if S-08 hasn't landed)
- **Parallel with:** S-08, S-11, S-13, S-14, S-15, S-16
- **Blockers:** —
- **Unknowns:** —
- **Risk:** adds a public route + an auth-aware redirect; must not break the existing auth redirect behavior (guardrail).
- **Status:** done

### S-13: Sticky nav header

- **Outcome:** the navigation header stays visible (sticky) as the user scrolls any page.
- **Change ID:** sticky-nav-header
- **PRD refs:** FR-022
- **Prerequisites:** —
- **Parallel with:** S-08, S-11, S-12, S-14, S-15, S-16
- **Blockers:** —
- **Unknowns:** —
- **Risk:** layout change to the shared header; low risk, must remain usable on mobile.
- **Status:** done

### S-14: Category management in Settings

- **Outcome:** user manages categories (add/edit/delete) from within Settings; the old standalone category route redirects to the new location.
- **Change ID:** categories-in-settings
- **PRD refs:** FR-023
- **Prerequisites:** —
- **Parallel with:** S-08, S-11, S-12, S-13, S-15, S-16
- **Blockers:** —
- **Unknowns:** —
- **Risk:** relocating an existing route — a redirect must be added so current bookmarks don't break (guardrail).
- **Status:** ready

### S-15: Category filter on expenses list

- **Outcome:** user filters the expenses list by choosing a category from an in-page picker.
- **Change ID:** expenses-category-filter
- **PRD refs:** FR-024
- **Prerequisites:** —
- **Parallel with:** S-08, S-11, S-12, S-13, S-14, S-16
- **Blockers:** —
- **Unknowns:** —
- **Risk:** builds on the existing URL-based drill-down (`?category=`); low risk, additive affordance.
- **Status:** ready

### S-16: Add-expense dialog

- **Outcome:** user can add an expense through a modal/dialog, unifying the entry point.
- **Change ID:** add-expense-dialog
- **PRD refs:** FR-025
- **Prerequisites:** —
- **Parallel with:** S-08, S-11, S-12, S-13, S-14, S-15
- **Blockers:** —
- **Unknowns:** —
- **Risk:** reworks the add-expense entry into a dialog (a pattern already used for category/expense editing); low risk. It is the prerequisite for the AI free-text mode (S-17).
- **Status:** ready

### S-17: AI-assisted expense entry

- **Outcome:** user switches the add-expense dialog to free-text mode, types e.g. "lidl 200zł, orlen 150zł", and reviews/adjusts/confirms one or more AI-parsed expenses (amount, description, category from existing categories) before any are saved.
- **Change ID:** ai-assisted-expense-entry
- **PRD refs:** FR-026, FR-027, FR-028, US-06
- **Prerequisites:** S-16
- **Parallel with:** —
- **Blockers:** external AI provider not yet selected or contracted
- **Unknowns:**
  - Which external AI service performs the parsing + classification, and does it fit the deployment runtime's constraints? — Owner: user (with stack selection). Block: yes.
  - Acceptable parsing accuracy for amounts / currency symbols / multi-item lines before the review step becomes a burden? — Owner: user. Block: no.
  - Does assisted entry need any new expense data fields (assumed none)? — Owner: user. Block: no.
- **Risk:** the only slice adding an outbound third-party dependency and a genuinely new classification rule; gated behind a mandatory review step so bad parses never persist. Blocked until the provider decision resolves.
- **Status:** blocked

## Backlog Handoff

| Roadmap ID | Change ID                  | Suggested issue title                                  | Ready for `/10x-plan` | Notes                                  |
| ---------- | -------------------------- | ------------------------------------------------------ | --------------------- | -------------------------------------- |
| S-08       | monthly-dashboard          | Monthly dashboard: per-category chart, total, breakdown | no                    | Done — archived 2026-07-28             |
| S-09       | dashboard-month-comparison | Dashboard: month-over-month comparison                 | no                    | Needs S-08 first                       |
| S-10       | dashboard-quick-add        | Dashboard: one-click add expense                       | no                    | Needs S-08 first                       |
| S-11       | polish-ui                  | Polish UI via message-key layer                        | yes                   | Run `/10x-plan polish-ui`              |
| S-12       | landing-page               | Public landing page + authed redirect to dashboard     | no                    | Done — archived 2026-07-28             |
| S-13       | sticky-nav-header          | Sticky navigation header                               | no                    | Done — archived 2026-07-28             |
| S-14       | categories-in-settings     | Move category management into Settings (+ redirect)    | no                    | Done — archived 2026-07-28             |
| S-15       | expenses-category-filter   | In-page category filter on the expenses list           | yes                   | Run `/10x-plan expenses-category-filter` |
| S-16       | add-expense-dialog         | Add-expense modal/dialog                               | yes                   | Run `/10x-plan add-expense-dialog`     |
| S-17       | ai-assisted-expense-entry  | AI-assisted expense entry from free text               | no                    | Blocked — resolve AI Open Questions    |

## Open Roadmap Questions

1. **AI provider & data handling** — which external service performs parsing + classification, whether it fits the deployment runtime's constraints, and its data-handling / retention terms. Owner: user (with downstream stack selection). Block: S-17.
2. **AI parsing accuracy & amount/currency formats** — how reliably free text like "lidl 200zł" is parsed (amount, currency symbol, multiple items per line) and the acceptable error rate before the review step becomes a burden. Owner: user. Block: S-17 (planning).
3. **AI data-shape impact** — confirm assisted entry needs no new expense fields (assumed none). Owner: user. Block: S-17 (planning).

## Parked

- **No automatic bank-account import** — Why parked: PRD §Non-Goals — open-banking/bank-API integration is out of scope.
- **No shared/multi-user household budgets** — Why parked: PRD §Non-Goals — flat single-user model.
- **No fully automatic (unsupervised) AI categorization** — Why parked: PRD §Non-Goals — AI-assist (S-17) only ever proposes into existing categories and never saves without confirmation; unattended auto-categorization/auto-create is out of scope.
- **No month-over-month trend analysis beyond a single previous-month comparison** — Why parked: PRD §Non-Goals — no trend lines, forecasting, or multi-month analytics.
- **No budgets, spending limits, alerts, payment reminders, or notifications** — Why parked: PRD §Non-Goals — the app reports spend; it doesn't set targets or push.
- **No multiple shipped languages / no language-switcher UI** — Why parked: PRD §Non-Goals — strings are key-based, but only Polish ships this iteration.
- **No CSV/Excel export** — Why parked: PRD §Non-Goals — dropped so effort goes to the core flow.
- **No multi-currency / FX conversion** — Why parked: PRD §Non-Goals — single currency label per user, relabel-only.
- **No expense keyword/full-text search** — Why parked: PRD §Non-Goals — category-filtered browsing only.
- **No role/permission changes** — Why parked: PRD §Non-Goals — auth stays flat.

## Done

- **S-01: User can create an account and sign in / sign out** — Archived 2026-07-23 → `context/archive/2026-07-21-account-signin-signout/`. Lesson: —.
- **S-02: User can view and add expense categories** — Archived 2026-07-24 → `context/archive/2026-07-21-expense-categories/`. Lesson: —.
- **S-03: User can log an expense and see it in the monthly summary** — Archived 2026-07-24 → `context/archive/2026-07-22-log-and-summarize-expenses/`. Lesson: —.
- **S-06: User can click into a category and see its underlying expenses** — Archived 2026-07-25 → `context/archive/2026-07-24-category-expense-drilldown/`. Lesson: —.
- **S-07: User can set a currency once and have it apply everywhere** — Archived 2026-07-25 → `context/archive/2026-07-24-user-currency-setting/`. Lesson: —.
- **S-05: User can add a name/description to an expense** — Archived 2026-07-25 → `context/archive/2026-07-24-expense-name-description/`. Lesson: —.
- **S-04: User can reach every core area through a persistent nav menu** — Archived 2026-07-25 → `context/archive/2026-07-24-persistent-nav-menu/`. Lesson: —.
- **FR-004: User can edit a category's name/description and delete a category** — Archived 2026-07-27 → `context/archive/2026-07-26-category-editing/`. Promoted out of `## Parked` (was: nice-to-have deferred to v2). Lesson: —.
- **Infra: CI auto-deploy-on-merge to Cloudflare Workers** — 2026-07-25 → `context/changes/deploy-on-merge/`. Gated `deploy` job in `.github/workflows/ci.yml` publishes on merge to `main` after `ci` + `migration-safety` pass. Lesson: —.
- **S-09: user can see the current month's spending compared against the previous month (total, and per-category where available); the comparison is hidden when there is no prior-month history.** — Archived 2026-07-30 → `context/archive/2026-07-29-dashboard-month-comparison/`. Lesson: —.
- **S-10: user can start adding an expense in one click from the dashboard.** — Archived 2026-07-30 → `context/archive/2026-07-29-dashboard-quick-add/`. Lesson: —.
- **S-14: user manages categories (add/edit/delete) from within Settings; the old standalone category route redirects to the new location.** — Archived 2026-07-28 → `context/archive/2026-07-27-categories-in-settings/`. Lesson: —.
- **S-08: user can open a monthly dashboard and see this month's spending as a per-category chart, a headline total, and per-category totals; the existing flat summary is absorbed here.** — Archived 2026-07-28 → `context/archive/2026-07-27-monthly-dashboard/`. Lesson: —.
- **S-12: an unauthenticated visitor sees a public landing page describing app capabilities; authenticated users visiting `/` are redirected to `/dashboard`.** — Archived 2026-07-28 → `context/archive/2026-07-28-landing-page/`. Lesson: redirect guards must exit before rendering page markup.
- **S-13: navigation header stays pinned to the top while scrolling on all pages, preserving readability and dialog layering.** — Archived 2026-07-28 → `context/archive/2026-07-28-sticky-nav-header/`. Lesson: —.
