---
project: MyBudget
version: 1
status: draft
created: 2026-07-21
updated: 2026-07-24
prd_version: 1
main_goal: low-complexity
top_blocker: capacity
---

# Roadmap: MyBudget

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Vision recap

A person managing their own household budget today tracks expenses in Excel — manually entering and categorizing every line item, with no automatic analysis and no way to see where the money went without extra, tedious work. MyBudget replaces that spreadsheet with structured expense entry, categorization, and a month-end summary, removing the manual friction that's the main reason people abandon spreadsheet-based budgeting after a few weeks.

## North star

**S-03: User can log an expense (today's date or backdated) and see it counted in a ranked monthly summary** — this is the smallest end-to-end flow that proves the core hypothesis: that structured entry plus a categorized summary actually answers "where did my money go," which a manual spreadsheet couldn't answer without extra work.

> "North star" here means the smallest end-to-end slice whose successful delivery would prove the core product hypothesis — placed as early as its Prerequisites allow, because everything else only matters if this works.

## At a glance

| ID   | Change ID                    | Outcome (user can …)                                                                            | Prerequisites | PRD refs                                     | Status   |
| ---- | ---------------------------- | ----------------------------------------------------------------------------------------------- | ------------- | -------------------------------------------- | -------- |
| S-01 | `account-signin-signout`     | create an account and sign in / sign out                                                        | —             | FR-001, FR-002                               | done     |
| S-02 | `expense-categories`         | view default expense categories and add a new one (with a similar-name warning)                 | S-01          | FR-003, FR-005                               | done     |
| S-03 | `log-and-summarize-expenses` | log an expense (auto or backdated date, manual category) and see it in a ranked monthly summary | S-02          | FR-006, FR-007, FR-008, FR-009, US-01, US-02 | done     |

(No `## Streams` section — three items in one straight dependency chain don't need a separate navigation view; the table above already reads cleanly top to bottom.)

## Baseline

What's already in place in the codebase as of `2026-07-21` (auto-researched + user-confirmed).
The Foundations section below assumes these are present and does not re-scaffold them.

- **Frontend:** present — Astro 6 SSR + React 19 islands, Tailwind 4, shadcn/ui (`src/components/ui/button.tsx`). Live and deployed.
- **Backend / API:** partial — Astro API routes exist only for auth (`src/pages/api/auth/{signin,signup,signout}.ts`); no categories/expenses/summary endpoints yet.
- **Data:** absent — no `supabase/migrations/` files exist; only Supabase's built-in `auth.users` table is in place. No schema for categories or expenses.
- **Auth:** present — full flow wired (`src/lib/supabase.ts`, `src/middleware.ts`, auth pages) and verified end-to-end in production (`context/deployment/deploy-plan.md`: signup → email confirmation → signin → protected `/dashboard`, live on Cloudflare Workers).
- **Deploy / infra:** present — Cloudflare Workers via `wrangler`, first deploy completed and verified live. CI (`.github/workflows/ci.yml`) currently runs lint+build only; the auto-deploy-on-merge flow named in `tech-stack.md` is not yet wired in (see `## Parked`).
- **Observability:** absent — no app-level logging or error tracking beyond default `wrangler tail` log streaming.

## Foundations

No standalone Foundations were needed for this roadmap. Auth, Frontend, and Deploy/infra are already `present` per Baseline above, so re-scaffolding them would be redundant. The one `absent` layer — the data schema for categories and expenses — is narrow enough to fold into the first slice that actually needs it (S-02's categories table, then S-03's expenses table) rather than pre-building the whole data layer ahead of user-facing work.

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

## Backlog Handoff

| Roadmap ID | Change ID                    | Suggested issue title                                                             | Ready for `/10x-plan` | Notes                                                                                              |
| ---------- | ---------------------------- | --------------------------------------------------------------------------------- | --------------------- | -------------------------------------------------------------------------------------------------- |
| S-01       | `account-signin-signout`     | Confirm account creation and sign-in/out cover FR-001/FR-002                      | done                  | Shipped and archived — see `## Done` below.                                                        |
| S-02       | `expense-categories`         | Build category viewing and creation with duplicate-name warning                   | done                  | Shipped and archived — see `## Done` below.                                                        |
| S-03       | `log-and-summarize-expenses` | Build expense logging (auto/backdated date + category) and ranked monthly summary | done                  | Shipped and archived — see `## Done` below.                                                        |

## Open Roadmap Questions

_None._ The PRD's own `## Open Questions` section was empty ("No open questions"), and all three sequencing anchors (main goal, north star, top blocker) were locked during the interview without any deferred cross-slice questions.

## Parked

- **No automatic bank-account import** — Why parked: PRD §Non-Goals — open-banking/bank-API integration is a large, security-sensitive undertaking out of scope for the MVP.
- **No shared/multi-user household budgets** — Why parked: PRD §Non-Goals — consistent with the flat, single-user access model; each account sees only its own data.
- **No AI-based automatic expense categorization in v1** — Why parked: PRD §Non-Goals — deferred to v2; v1 uses manual category selection only (FR-008).
- **No month-over-month trend analysis in v1** — Why parked: PRD §Non-Goals — deferred to v2; the monthly summary uses simple per-category sums for the current month only (FR-009).
- **No payment reminders for upcoming bills in v1** — Why parked: PRD §Non-Goals — present in the original idea as a nice-to-have, not selected as an MVP Secondary criterion.
- **No category editing (name/description) in v1 (FR-004, nice-to-have)** — Why parked: PRD §Non-Goals — default categories plus adding new ones cover MVP needs; demoted and deferred to v2.
- **No CSV/Excel export in v1** — Why parked: PRD §Non-Goals — considered but dropped entirely so all effort goes to the core account/categories/expenses/summary flow.
- **CI auto-deploy-on-merge** — Why parked: named in `tech-stack.md` hints but not yet wired into `.github/workflows/ci.yml` (lint+build only today); not required by any PRD FR, and the `low-complexity` sequencing goal argues against adding CI/CD investment before the core product loop (S-02, S-03) ships.

## Done

- **S-01: User can create an account and sign in / sign out** — Archived 2026-07-23 → `context/archive/2026-07-21-account-signin-signout/`. Lesson: —.
- **S-02: User can view and add expense categories** — Archived 2026-07-24 → `context/archive/2026-07-21-expense-categories/`. Lesson: —.
- **S-03: User can log an expense and see it in the monthly summary** — Archived 2026-07-24 → `context/archive/2026-07-22-log-and-summarize-expenses/`. Lesson: —.
