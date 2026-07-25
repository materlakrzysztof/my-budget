---
project: MyBudget
version: 3
status: draft
created: 2026-07-20
updated: 2026-07-25
context_type: brownfield
product_type: web-app
supersedes:
  - archive/prd-v1-2026-07-20.md
  - archive/prd-v2-2026-07-23.md
target_scale:
  users: small
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 3
  hard_deadline: null
  after_hours_only: true
---

> Consolidated PRD — single source of truth for what MyBudget is today. It merges
> the v1 MVP scope (`prd.md` v1) with the v2 post-MVP iteration (`prd-v2.md`) into one
> authoritative product spec with a single, collision-free FR/US numbering. The two
> originals are preserved verbatim under `context/foundation/archive/`
> (`prd-v1-2026-07-20.md`, `prd-v2-2026-07-23.md`) as historical decision records.
> Current build status per requirement is in `## Implementation Status`.

## Vision & Problem Statement

A person managing their own household budget today tracks expenses in Excel — manually entering and categorizing every line item. The spreadsheet doesn't analyze data automatically, has no built-in categories, and becomes unwieldy as entries accumulate. The pain hits hardest when they try to understand where the money went and which categories generated the biggest expenses — a question a manual spreadsheet can't answer without extra, tedious work.

Automatic expense capture and categorization removes exactly the manual work that is the main reason people abandon manual budgeting (spreadsheets, notes) after a few weeks.

**v2 update (2026-07-24):** the MVP shipped and is in daily use by its one real user. Four gaps only became visible from that day-to-day use — none was discoverable at initial shaping since they require having real expenses logged and a real habit of checking them:

1. **Navigation** — no organized menu; reaching "add expense" or "categories" wasn't discoverable through consistent nav.
2. **Expense identity** — an expense had no name/description field, so entries were hard to tell apart later beyond amount/category/date.
3. **Category drill-down** — no way to browse the list of expenses filtered to a single category; the monthly summary only showed totals, not the underlying entries.
4. **Currency** — amounts were always shown/entered in USD; the user could not set their own currency.

## User & Persona

**Primary**: A single individual managing their own household budget, currently using Excel to manually track expenses. They reach for the tool at the moment they want to understand where their money went in a given month and which categories drove the largest expenses. As of v2 they are an existing, daily user of the shipped product rather than a prospective one — the v2 gaps affect their day-to-day navigation and expense-entry experience, not new user types.

## Success Criteria

### Primary

- A user can create an account, set up categories (add new ones with a description), add an expense (auto or backdated date, manual category selection, optional name/description), and see a month-end summary showing the sum of expenses per category, ranked largest-first.
- A logged-in user can reach core areas through a persistent nav menu, set a currency once in settings that applies app-wide (relabel-only), and click into a category to see the filtered list of expenses within it.

### Secondary

- None — CSV/Excel export was considered but cut entirely from the MVP; the v2 iteration deliberately kept scope to the four core gaps above.

### Guardrails

- A user's financial data is never visible to other users; per-user data isolation is unaffected by any change.
- Adding or editing an expense completes in a few seconds, not longer; the user perceives acknowledgement of any action (adding an expense, switching views, editing a category, opening nav, filtering by category, changing currency) within 1 second.
- The total shown in the monthly summary always reconciles with the sum of individual expense entries — including in the selected currency after a currency change, and in a category's drill-down list.
- Existing expense/category data and the monthly summary totals remain correct across changes (name/description and currency use safe defaults for pre-existing records).
- The nav does not remove or break any existing bookmarked route; current login/session behavior is preserved.
- The application remains usable on both mobile and desktop screen sizes.

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

### US-03: User finds "add expense" through nav and browses a category's expenses

- **Given** a logged-in user on any page of the app
- **When** they open the nav menu and select "Add expense", then later select a category from the summary or categories page
- **Then** they reach the add-expense form directly from nav, and see the filtered list of expenses belonging to that category

#### Acceptance Criteria

- The nav menu is reachable from every authenticated page and links to Dashboard, Expenses (add), Categories, and Settings
- Selecting a category shows only expenses tagged with that category, not the full list

### US-04: User sets currency once and it applies everywhere

- **Given** a logged-in user who has not yet set a currency (defaults to USD)
- **When** they set their currency in settings
- **Then** all expense amounts, forms, and the monthly summary display and accept that currency going forward

#### Acceptance Criteria

- Changing currency does not convert or alter previously logged amounts — it only changes the unit going forward (no FX conversion)
- The monthly summary total still reconciles with the sum of individual expense amounts in the selected currency

## Functional Requirements

FR/US numbering is a single authoritative space. FR-001–FR-009 originate in v1; FR-010–FR-014 are the v2 iteration, renumbered here from `prd-v2.md`'s FR-001–FR-005 to remove the historical collision. Socratic rationale is condensed to a one-line resolution; full rounds live in the archived originals.

### Authentication

- FR-001: User can create an account. Priority: must-have
- FR-002: User can log in and log out. Priority: must-have
  > Logout kept as written — a cheap, small UI affordance; no reason to cut it.

### Categories

- FR-003: User can view a set of default expense categories. Priority: must-have
- FR-004: User can edit an existing category's name/description. Priority: nice-to-have (deferred — see Non-Goals)
  > Demoted: default categories plus adding new ones cover current needs.
- FR-005: User can add a new category with a description; the system warns if a similar category name already exists. Priority: must-have
  > Kept, extended with a simple similar-name warning on creation to limit overlapping categories.

### Expenses

- FR-006: User can add an expense with an automatic (today's) date. Priority: must-have
- FR-007: User can add an expense with a backdated (past) date. Priority: must-have
  > An explicit requirement from the original idea.
- FR-008: User can manually select a category for an expense. Priority: must-have
  > Manual for v1; AI categorization deliberately deferred to protect the timeline (see Non-Goals). Still faster than the unstructured Excel workflow.
- FR-011: User can add a name/description when creating or editing an expense (optional field). Priority: must-have
  > Kept optional to avoid adding friction to every entry, while making entries easier to tell apart later.

### Monthly summary & drill-down

- FR-009: User can view a month-end summary showing total expenses per category for the current month, ranked largest-first. Priority: must-have
  > A deliberate scope-down from month-over-month trends (see Non-Goals).
- FR-012: User can select a category (from the summary or categories page) and view the list of expenses belonging to that category. Priority: must-have
  > Totals alone don't show which expenses made up a category; explicitly requested.

### Navigation & settings

- FR-010: User can access a persistent nav menu from any authenticated page, linking to Dashboard, Add Expense, Categories, and Settings. Priority: must-have
  > A persistent nav directly solves the stated discoverability pain and is low-cost.
- FR-013: User can set their currency once in settings; it applies to all amount display/entry going forward, with no conversion of previously logged amounts. Priority: must-have
  > Relabel-only; currency changes are expected to be rare (set once, near account creation), so simplicity wins over the historical-conversion edge case.
- FR-014: Existing expense list, category management, monthly summary, and login/session behavior continue working exactly as before. Priority: must-have
  > Explicit defensive requirement — makes preservation a first-class item for implementation, not an implicit assumption.

## Non-Functional Requirements

- A user perceives acknowledgement of any action (adding an expense, switching views, editing a category, opening nav, filtering by category, changing currency) within 1 second.
- The application remains usable on both mobile and desktop screen sizes — the nav must not break this.

## Business Logic

The application ranks the user's spending categories by total amount for the current month, surfacing which categories drove the largest share of spending. The rule consumes the expenses the user has logged during the current month, each carrying a category and an amount, and outputs an ordered view of categories from largest to smallest total spend for that month. The user encounters this ranking in the month-end summary — the categories that consumed the most money surface first, instead of a flat, unordered list of category sums.

This is the only domain rule the app runs. Nav, the name/description field, category drill-down, and the currency setting are all presentation/data-shape additions — not new decisions the app makes for the user. Month-over-month trend comparison (how a category's spending changes across months) is a related but separate rule, deliberately deferred (see Non-Goals).

## Access Control

Login (email + password / OAuth / passwordless — mechanism resolved downstream of stack selection). Flat user model: each authenticated user sees only their own data, enforced by per-user RLS at the database level. No roles, no shared/household access.

## Non-Goals

- **No automatic bank-account import.** Expenses are entered manually only; open-banking / bank-API integration is a large, security-sensitive undertaking out of scope.
- **No shared/multi-user household budgets.** Each account sees only its own data; no budget sharing or multi-member households.
- **No AI-based automatic expense categorization.** Manual category selection only; AI categorization deferred.
- **No month-over-month trend analysis.** The monthly summary uses simple per-category sums for the current month only.
- **No payment reminders for upcoming bills.** Present in the original idea as a nice-to-have but not selected; revisit post-MVP.
- **No category name/description editing (FR-004).** Nice-to-have, deferred; default categories plus adding new ones cover current needs.
- **No CSV/Excel export.** Considered but dropped entirely so all effort goes to the core flow.
- **No multi-currency / FX conversion.** Single currency label per user account, relabel-only on change; no exchange-rate lookups, no per-expense currency, no historical conversion.
- **No expense keyword/full-text search.** Category-filtered browsing only; keyword search across name/description is out of scope.
- **No role/permission changes.** Auth and access control stay flat as they are today.
- **No redesign of the monthly summary itself.** The ranked category-summary view/logic is untouched; drill-down only adds a way to see a category's underlying expenses.

## Implementation Status

Current build state per requirement (mapped to roadmap slices in `context/foundation/roadmap.md`). All slices are shipped except S-04.

| FR                     | Capability                              | Roadmap slice                     | Status  |
| ---------------------- | --------------------------------------- | --------------------------------- | ------- |
| FR-001, FR-002         | Account create + sign in / out          | S-01 `account-signin-signout`     | done    |
| FR-003, FR-005         | View default + add categories           | S-02 `expense-categories`         | done    |
| FR-006–FR-009          | Log expense + ranked monthly summary    | S-03 `log-and-summarize-expenses` | done    |
| FR-011                 | Optional expense name/description        | S-05 `expense-name-description`    | done    |
| FR-012                 | Category → expenses drill-down          | S-06 `category-expense-drilldown` | done    |
| FR-013                 | Per-user currency (relabel-only)        | S-07 `user-currency-setting`      | done    |
| FR-014                 | Preserved behavior (cross-cutting)      | guardrail across S-04–S-07        | ongoing |
| **FR-010**             | **Persistent nav menu**                 | **S-04 `persistent-nav-menu`**    | **ready — not yet shipped** |
| FR-004                 | Edit category name/description          | — (parked, nice-to-have)          | not planned |

## Open Questions

None. Both source PRDs closed with empty `## Open Questions` sections, and consolidation introduced no new cross-requirement questions.
