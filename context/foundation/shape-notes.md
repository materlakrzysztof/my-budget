---
project: MyBudget
context_type: greenfield
created: 2026-07-20
updated: 2026-07-20
product_type: web-app
target_scale:
  users: small
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 3
  hard_deadline: null
  after_hours_only: true
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  gray_areas_resolved:
    - topic: "pain category"
      decision: "workflow friction + missing capability (auto-reminders) + data trapped across sources + decision paralysis on trends (all apply)"
    - topic: "insight"
      decision: "automatic categorization removes the manual entry chore that causes people to abandon manual budgeting (Excel, notes) after a few weeks"
    - topic: "primary persona scope"
      decision: "single individual managing their own household budget"
    - topic: "auth model"
      decision: "login (email+password / OAuth / passwordless) — flat user model, no roles, each user sees only their own data"
    - topic: "MVP scope-cost"
      decision: "scoped down — AI auto-categorization deferred to v2 (manual category selection in v1); monthly analysis simplified to per-category sums (no month-over-month trends in v1)"
    - topic: "FR Socratic round"
      decision: "FR-004 (category editing) demoted to nice-to-have/deferred; FR-005 extended with similar-name warning; FR-008 (manual categorization) kept deliberately despite friction overlap with deferred AI; FR-010 (CSV export) dropped entirely from v1"
    - topic: "business logic rule vs v1 scope conflict"
      decision: "one-sentence rule = rank spending categories by total for the current month (surfacing biggest spend); month-over-month trend comparison stays deferred to v2, consistent with the Step 3 scope-down"
    - topic: "NFRs"
      decision: "sub-1s perceived response to any user action; usable on both mobile and desktop screen sizes"
    - topic: "product framing"
      decision: "web-app; small scale (just the user, or a handful); no hard deadline; after-hours-only work; 100x-scale probe surfaced no change to the category-ranking rule"
    - topic: "non-goals"
      decision: "no automatic bank-account import (manual expense entry only); no shared/multi-user household budgets"
  frs_drafted: 9
  quality_check_status: accepted
---

## Vision & Problem Statement

A person managing their own household budget today tracks expenses in Excel — manually entering and categorizing every line item. The spreadsheet doesn't analyze data automatically, has no built-in categories, and becomes unwieldy as entries accumulate. The pain hits hardest when they try to understand where the money went and which categories generated the biggest expenses — a question a manual spreadsheet can't answer without extra, tedious work.

Automatic expense capture and categorization removes exactly the manual work that is the main reason people abandon manual budgeting (spreadsheets, notes) after a few weeks.

## User & Persona

**Primary**: A single individual managing their own household budget, currently using Excel to manually track expenses. They reach for a new tool at the moment they want to understand where their money went in a given month and which categories drove the largest expenses.

## Access Control

Login (email + password / OAuth / passwordless — mechanism TBD downstream of stack selection). Flat user model: each authenticated user sees only their own data. No roles, no shared/household access in the MVP.

## Success Criteria

### Primary

- A user can create an account, set up categories (edit defaults, add new ones with a description), add an expense (auto or backdated date, manual category selection), and see a month-end summary showing the sum of expenses per category.

### Secondary

- None for v1 — CSV/Excel export was considered but cut entirely from the MVP during the FR Socratic round (see Scope note below).

### Guardrails

- A user's financial data is never visible to other users.
- Adding or editing an expense completes in a few seconds, not longer.
- The total shown in the monthly summary always reconciles with the sum of individual expense entries.

## User Stories

### US-01: User adds an expense and sees it in the monthly summary

- **Given** a logged-in user with at least one category
- **When** they add an expense with a manually selected category and today's date
- **Then** the expense appears in their expense list and is included in the current month's per-category summary

#### Acceptance Criteria

- The expense's amount is added to the correct category's running total for the month it was dated in
- The monthly summary total always equals the sum of the individual expense amounts

### US-02: User adds a backdated expense

- **Given** a logged-in user viewing the current month's summary
- **When** they add an expense dated in a previous month
- **Then** the expense is attributed to the summary of the month it was dated in, not the month it was entered in

#### Acceptance Criteria

- Adding a backdated expense updates the previous month's summary, not the current month's, if that summary is viewed
- The current month's summary is unaffected by a backdated entry

## Functional Requirements

### Authentication

- FR-001: User can create an account. Priority: must-have
  > Socratic: No counter-argument considered; stands as written.
- FR-002: User can log in and log out. Priority: must-have
  > Socratic: Counter-argument considered: "persistent login (no explicit logout) reduces friction in a daily-use personal app." Resolution: kept as written; logout is a cheap, small UI affordance, no reason to cut it.

### Categories

- FR-003: User can view a set of default expense categories. Priority: must-have
  > Socratic: No counter-argument considered; stands as written.
- FR-004: User can edit an existing category's name/description. Priority: nice-to-have
  > Socratic: Counter-argument considered: "not necessary in MVP if default categories + adding new ones suffice." Resolution: demoted to nice-to-have, deferred to v2.
- FR-005: User can add a new category with a description; the system warns if a similar category name already exists. Priority: must-have
  > Socratic: Counter-argument considered: "unlimited custom categories could lead to overlapping categories that hurt analysis quality." Resolution: kept, extended with a simple similar-name warning on creation.

### Expenses

- FR-006: User can add an expense with an automatic (today's) date. Priority: must-have
  > Socratic: No counter-argument considered; stands as written.
- FR-007: User can add an expense with a backdated (past) date. Priority: must-have
  > Socratic: No counter-argument considered; stands as written — an explicit requirement from the original idea.
- FR-008: User can manually select a category for an expense. Priority: must-have
  > Socratic: Counter-argument considered: "manual categorization on every expense is exactly the friction AI-categorization was meant to solve — worth doing manually now?" Resolution: kept manual for v1; AI categorization is deliberately deferred to v2 to protect the 3-week timeline. Manual entry is still faster than the current unstructured Excel workflow.

### Monthly summary

- FR-009: User can view a month-end summary showing total expenses per category for the current month. Priority: must-have
  > Socratic: No counter-argument considered; stands as written — a deliberate scope-down from month-over-month trends (see Scope note).

## Scope note (deferred to v2)

- AI auto-categorization of expenses — deferred; v1 uses manual category selection only (see FR-008 Socratic).
- Month-over-month trend analysis — deferred; v1 uses simple per-category sums for the current month only (see FR-009 Socratic).
- Payment reminders for upcoming bills — captured as a nice-to-have from the original idea, not selected as MVP Secondary; revisit post-MVP.
- Category editing (name/description) — demoted to nice-to-have; default categories + add-new cover MVP needs (see FR-004 Socratic).
- CSV/Excel export — removed from v1 entirely and moved to the v2 backlog. Socratic counter-argument: "every hour spent on export is an hour not spent on the core flow." Resolution: dropped from v1; all effort goes to account/categories/expenses/summary.

## Business Logic

The application ranks the user's spending categories by total amount for the current month, surfacing which categories drove the largest share of spending.

The rule consumes the expenses the user has logged during the current month, each carrying a category and an amount. Its output is an ordered view of categories from largest to smallest total spend for that month. The user encounters this ranking in the month-end summary — instead of a flat, unordered list of category sums, the categories that consumed the most money surface first.

Month-over-month trend comparison (how a category's spending changes across months) is a related but separate rule, deliberately deferred to v2 (see Scope note above and the Step 5 resolution) to protect the 3-week MVP timeline.

## Non-Functional Requirements

- A user perceives acknowledgement of any action (adding an expense, switching views, editing a category) within 1 second.
- The application remains usable on both mobile and desktop screen sizes.

## Non-Goals

- **No automatic bank-account import.** Expenses are entered manually only. Open-banking / bank-API integration is a large, security-sensitive undertaking out of scope for the MVP.
- **No shared/multi-user household budgets.** Consistent with the flat, single-user access model locked in Phase 2 — each account sees only its own data; no budget sharing or multi-member households in v1.
