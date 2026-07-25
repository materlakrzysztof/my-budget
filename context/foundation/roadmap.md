---
project: MyBudget
version: 1
status: draft
created: 2026-07-21
updated: 2026-07-25
prd_version: 2
main_goal: low-complexity
top_blocker: capacity
---

# Roadmap: MyBudget

> Derived from `context/foundation/prd.md` (v1, S-01–S-03 — all shipped, see `## Done`)
> and `context/foundation/prd-v2.md` (v2, S-04+ — this iteration) + auto-researched
> codebase baseline. `main_goal`/`top_blocker` above reflect the latest interview
> (v2); both PRDs happened to land on the same answers.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.
> **FR/US numbering is scoped per source PRD** — prd.md and prd-v2.md each restart
> at FR-001/US-01. Every v2-sourced ref below is written `FR-NNN (prd-v2.md)` to
> avoid collision with v1's own FR-001..FR-009.

## Vision recap

A person managing their own household budget today tracks expenses in Excel — manually entering and categorizing every line item, with no automatic analysis and no way to see where the money went without extra, tedious work. MyBudget replaces that spreadsheet with structured expense entry, categorization, and a month-end summary, removing the manual friction that's the main reason people abandon spreadsheet-based budgeting after a few weeks.

**v2 update (2026-07-24):** the MVP above shipped and is in daily use by its one real user. Four gaps only became visible from that day-to-day use — no persistent nav, no way to tell expenses apart beyond amount/category/date, no drill-down from a category total to its underlying expenses, and a hardcoded USD currency. `prd-v2.md` scopes closing those four gaps; S-04 onward below cover it.

## North star

**S-04: User can reach every core area through a persistent nav menu** — this iteration's validation milestone (the smallest end-to-end slice whose success proves the value of fast post-MVP polish): no schema change, pure wiring of routes that already exist, and it closes the #1 gap named in `prd-v2.md`'s Problem Statement (discoverability). Placed first among S-04+ as its Prerequisites (none) allow.

> "North star" means the smallest end-to-end slice whose successful delivery would prove the point of the current iteration — placed as early as its Prerequisites allow, because everything else only matters if this works. (v1's original north star was S-03, above — already shipped; see `## Done`.)

## At a glance

| ID   | Change ID                    | Outcome (user can …)                                                                            | Prerequisites | PRD refs                                     | Status   |
| ---- | ---------------------------- | ----------------------------------------------------------------------------------------------- | ------------- | -------------------------------------------- | -------- |
| S-01 | `account-signin-signout`     | create an account and sign in / sign out                                                        | —             | FR-001, FR-002                               | done     |
| S-02 | `expense-categories`         | view default expense categories and add a new one (with a similar-name warning)                 | S-01          | FR-003, FR-005                               | done     |
| S-03 | `log-and-summarize-expenses` | log an expense (auto or backdated date, manual category) and see it in a ranked monthly summary | S-02          | FR-006, FR-007, FR-008, FR-009, US-01, US-02 | done     |
| S-04 | `persistent-nav-menu`        | reach Dashboard, Expenses, Categories, and Settings through a persistent nav menu on every authenticated page | —   | FR-001 (prd-v2.md), FR-005 (prd-v2.md), US-01 (prd-v2.md) | ready |
| S-05 | `expense-name-description`   | add an optional name/description when creating or editing an expense                            | —             | FR-002 (prd-v2.md), FR-005 (prd-v2.md)       | ready    |
| S-06 | `category-expense-drilldown` | click a category to see the filtered list of expenses belonging to it                           | —             | FR-003 (prd-v2.md), FR-005 (prd-v2.md), US-01 (prd-v2.md) | done |
| S-07 | `user-currency-setting`      | set a currency once in settings and have it apply to all amount display/entry going forward     | —             | FR-004 (prd-v2.md), FR-005 (prd-v2.md), US-02 (prd-v2.md) | ready |

(No `## Streams` section — S-01–S-03 are one straight chain and S-04–S-07 are four mutually independent slices with no shared prerequisite chain; neither group benefits from a separate navigation view beyond the table above.)

## Baseline

What's already in place in the codebase as of `2026-07-21` for S-01–S-03 (auto-researched
+ user-confirmed), refreshed `2026-07-24` for S-04+.
The Foundations section below assumes these are present and does not re-scaffold them.

- **Frontend:** present — Astro 6 SSR + React 19 islands, Tailwind 4, shadcn/ui (`src/components/ui/button.tsx`). Live and deployed. **2026-07-24 refresh:** `src/layouts/Layout.astro` renders no nav at all, and `/dashboard`, `/expenses`, `/categories` have zero `href` links between them — this is the concrete gap S-04 closes.
- **Backend / API:** present for categories/expenses (`src/pages/api/{categories,expenses}.ts`) as of S-02/S-03; absent for settings/currency — no such endpoint exists yet (S-07 gap).
- **Data:** present — `categories` and `expenses` tables exist (`supabase/migrations/2026072*`). **2026-07-24 refresh:** `expenses` has no name/description column (S-05 gap); no currency field exists anywhere, per-user or per-expense (S-07 gap).
- **Auth:** present — full flow wired (`src/lib/supabase.ts`, `src/middleware.ts`, auth pages) and verified end-to-end in production (`context/deployment/deploy-plan.md`: signup → email confirmation → signin → protected `/dashboard`, live on Cloudflare Workers). Unchanged by v2.
- **Deploy / infra:** present — Cloudflare Workers via `wrangler`, first deploy completed and verified live. CI (`.github/workflows/ci.yml`) runs lint+build+unit/integration tests+migration-safety (see `context/foundation/test-plan.md`). Auto-deploy-on-merge still not wired in (see `## Parked`).
- **Observability:** absent — no app-level logging or error tracking beyond default `wrangler tail` log streaming. Unchanged by v2.

## Foundations

No standalone Foundations were needed for this roadmap, for either PRD version. Auth, Frontend, and Deploy/infra were already `present` per Baseline above for v1, so re-scaffolding them would have been redundant; the absent data-schema layer folded into S-02/S-03 instead of pre-building it ahead of user-facing work.

**v2 update:** likewise no Foundations for S-04–S-07. All four gaps (nav, name/description, category drill-down, currency) are self-contained additive changes with no shared technical prerequisite — none needs scaffolding before another can proceed, so each folds its own minimal data/logic/UI work into its own slice.

## Slices

### S-01: User can create an account and sign in / sign out

- **Outcome:** user can create an account and sign in / sign out.
- **Change ID:** `account-signin-signout`
- **PRD refs:** FR-001, FR-002
- **Prerequisites:** —
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Already implemented and verified end-to-end in production (`context/deployment/deploy-plan.md`: signup → email confirmation → signin → `/dashboard`). Listed first only to preserve PRD traceability for FR-001/FR-002 — expect a confirmation pass against the PRD wording, not new build work.
- **Status:** done

### S-02: User can view and add expense categories

- **Outcome:** user can view the default expense categories and add a new one with a description; the system warns if a similar name already exists.
- **Change ID:** `expense-categories`
- **PRD refs:** FR-003, FR-005
- **Prerequisites:** S-01
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** First real build slice — introduces the categories table and its RLS policy (per this repo's per-user-data convention). Sequenced before expense logging because FR-008 requires an existing category to select from when adding an expense.
- **Status:** done

### S-03: User can log an expense and see it in the monthly summary

- **Outcome:** user can add an expense with an automatic (today's) or backdated date and a manually selected category, and see it reflected in a month-end summary ranked from largest to smallest category spend.
- **Change ID:** `log-and-summarize-expenses`
- **PRD refs:** FR-006, FR-007, FR-008, FR-009, US-01, US-02
- **Prerequisites:** S-02
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** This is the north star and the largest slice — it bundles FR-006/007/008/009 and both user stories because the PRD's own Primary Success Criterion and both Given/When/Then blocks treat "add expense" and "see it summarized" as one atomic outcome, not two independently valuable steps. Splitting further would be premature complexity for a 3-week solo, after-hours MVP.
- **Status:** done

### S-04: User can reach every core area through a persistent nav menu

- **Outcome:** user can open a persistent nav menu from any authenticated page, linking to Dashboard, Add Expense, Categories, and Settings.
- **Change ID:** `persistent-nav-menu`
- **PRD refs:** FR-001 (prd-v2.md), FR-005 (prd-v2.md), US-01 (prd-v2.md)
- **Prerequisites:** —
- **Parallel with:** S-05, S-06, S-07
- **Blockers:** —
- **Unknowns:** —
- **Risk:** North star and smallest slice here — no schema change, pure wiring of routes that already exist (`/dashboard`, `/expenses`, `/categories`). The one wrinkle: the nav's Settings destination has no real page yet until S-07 ships — land it as a minimal placeholder so the link isn't dead, and don't let this slice grow into building S-07's content early. Guardrail: must not remove or break any existing bookmarked route.
- **Status:** ready

### S-05: User can add a name/description to an expense

- **Outcome:** user can optionally add a name/description when creating or editing an expense.
- **Change ID:** `expense-name-description`
- **PRD refs:** FR-002 (prd-v2.md), FR-005 (prd-v2.md)
- **Prerequisites:** —
- **Parallel with:** S-04, S-06, S-07
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Smallest data change here — one additive optional column, no backfill needed. Keep it optional per PRD explicitly to avoid adding friction to every entry; resist scope creep into making it required.
- **Status:** ready

### S-06: User can click into a category and see its underlying expenses

- **Outcome:** user can select a category (from the summary or categories page) and see the filtered list of expenses belonging to it.
- **Change ID:** `category-expense-drilldown`
- **PRD refs:** FR-003 (prd-v2.md), FR-005 (prd-v2.md), US-01 (prd-v2.md)
- **Prerequisites:** —
- **Parallel with:** S-04, S-05, S-07
- **Blockers:** —
- **Unknowns:** —
- **Risk:** New route/view over existing `expenses`/`categories` tables — no schema change, just a filtered query. Guardrail: the existing monthly summary's per-category totals must keep reconciling exactly as before; verify the drill-down list's own sum matches the total already shown for that category.
- **Status:** done

### S-07: User can set a currency once and have it apply everywhere

- **Outcome:** user can set their currency once in settings; all expense amounts, forms, and the monthly summary display and accept that currency going forward, with no conversion of previously logged amounts.
- **Change ID:** `user-currency-setting`
- **PRD refs:** FR-004 (prd-v2.md), FR-005 (prd-v2.md), US-02 (prd-v2.md)
- **Prerequisites:** —
- **Parallel with:** S-04, S-05, S-06
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Broadest touch surface of the four (every place an amount is entered or displayed) and the only one needing a new per-user settings surface. Guardrail is explicit and easy to violate by accident: relabel-only, no FX conversion of historical amounts, and the monthly summary total must still reconcile with the sum of individual expenses in the newly selected currency. Sequenced last among S-04–S-07 per the low-complexity bias (smallest slices first).
- **Status:** ready

## Backlog Handoff

| Roadmap ID | Change ID                    | Suggested issue title                                                             | Ready for `/10x-plan` | Notes                                                                                              |
| ---------- | ---------------------------- | --------------------------------------------------------------------------------- | --------------------- | -------------------------------------------------------------------------------------------------- |
| S-01       | `account-signin-signout`     | Confirm account creation and sign-in/out cover FR-001/FR-002                      | done                  | Shipped and archived — see `## Done` below.                                                        |
| S-02       | `expense-categories`         | Build category viewing and creation with duplicate-name warning                   | done                  | Shipped and archived — see `## Done` below.                                                        |
| S-03       | `log-and-summarize-expenses` | Build expense logging (auto/backdated date + category) and ranked monthly summary | done                  | Shipped and archived — see `## Done` below.                                                        |
| S-04       | `persistent-nav-menu`        | Add a persistent nav menu (Dashboard/Expenses/Categories/Settings)                 | yes                   | North star of this iteration. Run `/10x-plan persistent-nav-menu`.                                 |
| S-05       | `expense-name-description`   | Add optional name/description field to expense create/edit                        | yes                   | Independent of S-04/S-06/S-07 — can run in parallel.                                                |
| S-06       | `category-expense-drilldown` | Add category-filtered expense list view                                           | yes                   | Independent of S-04/S-05/S-07 — can run in parallel.                                                |
| S-07       | `user-currency-setting`      | Add per-user currency setting applied app-wide (relabel-only, no FX)              | yes                   | Independent of S-04/S-05/S-06 — can run in parallel. Needs its own settings page/route.             |

## Open Roadmap Questions

_None._ Both PRD's own `## Open Questions` sections were empty ("No open questions" / "None identified at this time"), and all sequencing anchors (main goal, north star, top blocker) were locked during their respective interviews without any deferred cross-slice questions.

## Parked

- **No automatic bank-account import** — Why parked: PRD §Non-Goals — open-banking/bank-API integration is a large, security-sensitive undertaking out of scope for the MVP.
- **No shared/multi-user household budgets** — Why parked: PRD §Non-Goals — consistent with the flat, single-user access model; each account sees only its own data.
- **No AI-based automatic expense categorization in v1** — Why parked: PRD §Non-Goals — deferred to v2; v1 uses manual category selection only (FR-008).
- **No month-over-month trend analysis in v1** — Why parked: PRD §Non-Goals — deferred to v2; the monthly summary uses simple per-category sums for the current month only (FR-009).
- **No payment reminders for upcoming bills in v1** — Why parked: PRD §Non-Goals — present in the original idea as a nice-to-have, not selected as an MVP Secondary criterion.
- **No category editing (name/description) in v1 (FR-004, nice-to-have)** — Why parked: PRD §Non-Goals — default categories plus adding new ones cover MVP needs; demoted and deferred to v2.
- **No CSV/Excel export in v1** — Why parked: PRD §Non-Goals — considered but dropped entirely so all effort goes to the core account/categories/expenses/summary flow.
- **CI auto-deploy-on-merge** — Why parked: named in `tech-stack.md` hints but not yet wired into `.github/workflows/ci.yml` (lint+build+test today); not required by any PRD FR, and the `low-complexity` sequencing goal argues against adding CI/CD investment before the core product loop ships.
- **Multi-currency / FX conversion** — Why parked: `prd-v2.md` §Non-Goals — single currency label per account, relabel-only; no exchange-rate lookups, no per-expense currency, no historical conversion.
- **Expense search/full-text search** — Why parked: `prd-v2.md` §Non-Goals — S-06 adds category-filtered browsing only; keyword search across name/description is out of scope.
- **Role/permission changes** — Why parked: `prd-v2.md` §Non-Goals — auth and access control stay exactly as they are today.
- **Redesign of the monthly summary itself** — Why parked: `prd-v2.md` §Non-Goals — the existing ranked category-summary view/logic is untouched; S-06 only adds a way to drill into a category's underlying expense list.

## Done

- **S-01: User can create an account and sign in / sign out** — Archived 2026-07-23 → `context/archive/2026-07-21-account-signin-signout/`. Lesson: —.
- **S-02: User can view and add expense categories** — Archived 2026-07-24 → `context/archive/2026-07-21-expense-categories/`. Lesson: —.
- **S-03: User can log an expense and see it in the monthly summary** — Archived 2026-07-24 → `context/archive/2026-07-22-log-and-summarize-expenses/`. Lesson: —.
- **S-06: User can click into a category and see its underlying expenses** — Archived 2026-07-25 → `context/archive/2026-07-24-category-expense-drilldown/`. Lesson: —.
