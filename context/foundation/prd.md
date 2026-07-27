---
project: MyBudget
version: 4
status: draft
created: 2026-07-20
updated: 2026-07-27
context_type: brownfield
product_type: web-app
supersedes:
  - archive/prd-v1-2026-07-20.md
  - archive/prd-v2-2026-07-23.md
merges:
  - prd-v4.md (iteration 3 — dashboard, UX, AI-assisted entry)
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
> the v1 MVP scope, the v2 post-MVP iteration, and the v3 (iteration-3) delta
> (dashboard, UX improvements, AI-assisted entry) into one authoritative product
> spec with a single, collision-free FR/US numbering. Source PRDs are preserved
> under `context/foundation/archive/` (`prd-v1-2026-07-20.md`, `prd-v2-2026-07-23.md`)
> and the iteration-3 delta at `context/foundation/prd-v4.md`. Current build status
> per requirement is in `## Implementation Status`.

## Vision & Problem Statement

A person managing their own household budget today tracks expenses in Excel — manually entering and categorizing every line item. The spreadsheet doesn't analyze data automatically, has no built-in categories, and becomes unwieldy as entries accumulate. The pain hits hardest when they try to understand where the money went and which categories generated the biggest expenses — a question a manual spreadsheet can't answer without extra, tedious work.

Automatic expense capture and categorization removes exactly the manual work that is the main reason people abandon manual budgeting (spreadsheets, notes) after a few weeks.

**v2 update (2026-07-24):** the MVP shipped and is in daily use by its one real user. Four gaps only became visible from that day-to-day use:

1. **Navigation** — no organized menu; reaching "add expense" or "categories" wasn't discoverable.
2. **Expense identity** — an expense had no name/description field, so entries were hard to tell apart.
3. **Category drill-down** — no way to browse the list of expenses filtered to a single category.
4. **Currency** — amounts were always shown/entered in USD; the user could not set their own currency.

**v3 update (2026-07-27):** with the v2 gaps shipped, three further gaps surfaced from continued daily use, forming this iteration:

1. **No visual monthly dashboard** — the summary is a flat ranked list of totals; there's no chart, headline total, or comparison to the previous month, so spending shape and month-over-month movement aren't visible at a glance.
2. **UX / navigation friction** — the UI is English (Polish wanted); there's no landing page; the nav header isn't sticky; category management sits on its own page rather than in Settings; there's no quick "add expense" from the main view; and the expenses list has no category picker.
3. **Fully manual expense entry** — the user wants an assisted path: type free text like "lidl 200zł" and have the app extract the amount + description and categorize it, then review before saving.

## User & Persona

**Primary**: A single individual managing their own household budget, originally using Excel to manually track expenses. They reach for the tool at the moment they want to understand where their money went in a given month and which categories drove the largest expenses. As of v2 they are an existing, daily user of the shipped product; the v3 changes affect their day-to-day viewing, navigation, and expense-entry experience, not new user types.

## Success Criteria

### Primary

- A user can create an account, set up categories (add new ones with a description; edit and delete existing ones), add an expense (auto or backdated date, manual category selection, optional name/description), and see a month-end summary of spending per category, ranked largest-first.
- A logged-in user can reach core areas through a persistent nav menu, set a currency once in settings that applies app-wide (relabel-only), and click into a category to see the filtered list of expenses within it.
- **(v3)** With the UI in Polish, a user lands on a home page explaining the app; reaches a **dashboard** showing this month's spending as a per-category chart, the total sum, per-category totals, and a comparison against the previous month; navigates via a **sticky** header; adds an expense in one click from the dashboard; filters the expenses list by category; and finds category management under **Settings**.
- **(v3, later slice)** A user opens an "add expense" dialog, switches it to free-text mode, types something like "lidl 200zł", and the app proposes one or more parsed expenses (amount, description, category) to review and confirm before any are saved.

### Secondary

- None — CSV/Excel export was cut entirely; each iteration deliberately kept scope to its core gaps.

### Guardrails

- A user's financial data is never visible to other users; per-user data isolation is unaffected by any change.
- The user perceives acknowledgement of any local (non-AI) action within 1 second; the AI-assisted path (later slice) shows continuous visible progress while analysis is in flight and never appears frozen, even though it may take several seconds.
- The total shown in the monthly summary / dashboard always reconciles with the sum of individual expense entries — including in the selected currency, in a category's drill-down list, and in the dashboard's per-category and headline figures.
- Existing expense/category data and monthly totals remain correct across changes (name/description and currency use safe defaults for pre-existing records; the dashboard is a new presentation over the same numbers, not a recalculation).
- Navigation changes (including relocating category management to Settings) do not remove or break any existing bookmarked route — a redirect or equivalent path is preferred; current login/session behavior is preserved.
- The application remains usable on both mobile and desktop; the dashboard chart is legible on small screens and does not rely on color alone to convey category.
- The AI-assisted path sends only the free text the user explicitly submits for analysis — never the user's expense history or account data — and persists nothing without explicit confirmation.

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

### US-05: User sees the monthly dashboard and navigates fluidly (v3)

- **Given** a logged-in user with expenses logged this month, UI in Polish
- **When** they open the app and reach the dashboard
- **Then** they see a chart of this month's spending broken down by category, the total sum, per-category totals, and a comparison to the previous month; a sticky header lets them move anywhere; and one click starts adding a new expense

#### Acceptance Criteria

- The dashboard's total and per-category figures reconcile exactly with the sum of the underlying expense records for the month
- The comparison shows this month vs the previous month; when there is no prior-month history, it is hidden rather than shown as zero/misleading
- The header remains visible while scrolling any page
- All labels and copy render in Polish

### US-06: User adds expenses from free text via assisted analysis (v3, later slice)

- **Given** a logged-in user with existing categories
- **When** they open the add-expense dialog, switch to free-text mode, type e.g. "lidl 200zł, orlen 150zł", and submit for analysis
- **Then** the app returns a review list of parsed expenses — each with an amount, a description, and a category chosen from the user's existing categories — which the user can adjust and must confirm before any are saved

#### Acceptance Criteria

- One free-text input may yield multiple parsed expenses
- Each proposed category is one of the user's existing categories (no new categories are created)
- Nothing is persisted until the user confirms the review list

## Functional Requirements

FR/US numbering is a single authoritative space. FR-001–FR-009 originate in v1; FR-010–FR-014 are the v2 iteration; FR-015–FR-028 are the v3 iteration (dashboard, UX, AI-assisted entry). Socratic rationale is condensed to a one-line resolution; full rounds live in the archived originals and in `prd-v4.md`.

### Authentication

- FR-001: User can create an account. Priority: must-have
- FR-002: User can log in and log out. Priority: must-have

### Categories

- FR-003: User can view a set of default expense categories. Priority: must-have
- FR-004: User can edit and delete an existing category (name/description); deletion is blocked while the category still has expenses. Priority: must-have
  > Promoted from a deferred nice-to-have and shipped (see Implementation Status).
- FR-005: User can add a new category with a description; the system warns if a similar category name already exists. Priority: must-have

### Expenses

- FR-006: User can add an expense with an automatic (today's) date. Priority: must-have
- FR-007: User can add an expense with a backdated (past) date. Priority: must-have
- FR-008: User can manually select a category for an expense. Priority: must-have
- FR-011: User can add a name/description when creating or editing an expense (optional field). Priority: must-have

### Monthly summary & drill-down

- FR-009: User can view a month-end summary showing total expenses per category for the current month, ranked largest-first. Priority: must-have
  > v3: this summary is absorbed into the dashboard (FR-015–FR-018); the underlying ranking rule is unchanged.
- FR-012: User can select a category (from the summary or categories page) and view the list of expenses belonging to that category. Priority: must-have

### Navigation & settings

- FR-010: User can access a persistent nav menu from any authenticated page, linking to Dashboard, Add Expense, Categories, and Settings. Priority: must-have
- FR-013: User can set their currency once in settings; it applies to all amount display/entry going forward, with no conversion of previously logged amounts. Priority: must-have
- FR-014: Existing expense list, category management, monthly summary/dashboard, currency behavior, and login/session behavior continue working exactly as before across every iteration. Priority: must-have
  > Explicit defensive requirement — makes preservation a first-class item for implementation, not an implicit assumption.

### Dashboard (v3)

- FR-015: User can view a monthly dashboard showing a chart of the current month's spending broken down by category. Priority: must-have
  > A visual chart was explicitly requested; per-category breakdown chosen over spend-over-time.
- FR-016: User can see the total sum of all expenses for the current month on the dashboard. Priority: must-have
  > A distinct at-a-glance number the flat list didn't surface.
- FR-017: User can see per-category spending totals for the current month on the dashboard; the existing monthly summary is absorbed into the dashboard. Priority: must-have
  > The summary is folded into the dashboard, not duplicated — this lifts the former "no redesign of the summary" non-goal.
- FR-018: User can compare the current month's spending against the previous month (total, and per-category where available); when there is no prior-month history, the comparison is hidden. Priority: must-have
  > Hidden rather than shown as zero/misleading when there's nothing to compare.
- FR-019: User can start adding an expense directly from the dashboard via a quick action. Priority: must-have
  > The dashboard is the primary landing view; a direct action removes a navigation hop.

### UX & Navigation (v3)

- FR-020: The user-facing UI is presented in Polish, with strings externalized to message keys so another language could be added later without a rewrite. No language-switcher UI is in scope. Priority: must-have
  > Key-based translation layer now; Polish is the only shipped language.
- FR-021: A visitor can view a home/landing page describing the app's capabilities; authenticated users proceed to the dashboard. Priority: must-have
  > A public shop-window for unauthenticated visitors; authed users skip to the dashboard.
- FR-022: The navigation header stays visible (sticky) as the user scrolls any page. Priority: must-have
  > Directly addresses the stated navigation-friction pain; low cost.
- FR-023: User can manage categories (add/edit/delete) from within Settings, rather than a standalone page; a redirect from the old category route is preferred so bookmarks don't break. Priority: must-have
- FR-024: User can filter the expenses list by choosing a category from a picker on the expenses page. Priority: must-have
  > The in-page picker is the missing discoverable affordance; the existing URL drill-down is deep-link only.

### AI-assisted expense entry (v3 — later slice)

- FR-025: User can add expenses through a modal/dialog. Priority: must-have
  > The dialog unifies manual and assisted entry behind one entry point (see FR-026).
- FR-026: The add-expense dialog lets the user switch between a structured form and a free-text field submitted for AI analysis. Priority: must-have
  > A single dialog with a toggle keeps one entry point rather than competing buttons.
- FR-027: User can enter free text (e.g., "lidl 200zł, orlen 150zł") and the app parses one or more expenses — extracting amount and description and assigning each to one of the user's existing categories; nothing is persisted directly, output always flows through the review step. Priority: must-have
  > Gated behind mandatory confirmation; parsing accuracy and provider choice are Open Questions.
- FR-028: The app presents the parsed expense(s) as a review list the user can adjust and must confirm before any are saved. Priority: must-have
  > The review step is the trust guard for fallible parsing; non-negotiable.

## Non-Functional Requirements

- A user perceives acknowledgement of any local (non-AI) action (adding an expense, switching views, editing a category, opening nav, filtering by category, changing currency, opening the dashboard) within 1 second.
- The AI-assisted analysis path (later slice) may take several seconds; during it the user sees continuous visible progress and the UI never appears frozen.
- The data sent for AI analysis is limited to the free text the user explicitly submits — never expense history or account data.
- The application remains usable on both mobile and desktop screen sizes; the dashboard chart is legible on small screens and does not rely on color alone to convey category.

## Business Logic

The application ranks the user's spending categories by total amount for the current month, surfacing which categories drove the largest share of spending. The rule consumes the expenses the user has logged during the current month, each carrying a category and an amount, and outputs an ordered view of categories from largest to smallest total spend. The user encounters this ranking in the month-end view.

**v3 additions:**

- **Dashboard (presentation + one small computation).** The dashboard presents the above aggregation visually (per-category chart + headline total) and adds a month-over-month comparison: the current month's spending against the previous month's (total, and per-category where data exists). This is arithmetic over existing records, not a new decision the app makes for the user. The month-end summary is absorbed into the dashboard; the ranking rule itself is unchanged.
- **AI-assisted entry (a genuinely new classification rule — later slice).** Given a free-text string the user types, the app extracts one or more expenses — each an amount and a description — and classifies each into one of the user's *existing* categories. This is a real domain decision (extraction + classification), gated so the app never persists its own inference: the parsed result is always presented for the user to adjust and confirm first.

## Access Control

Login (email + password / OAuth / passwordless — mechanism resolved downstream of stack selection). Flat user model: each authenticated user sees only their own data, enforced by per-user RLS at the database level. No roles, no shared/household access. Relocating category management to Settings (v3) is a UI/navigation reorganization only — it adds no roles and changes nothing about who can access what.

## Non-Goals

- **No automatic bank-account import.** Expenses are entered manually or via user-confirmed AI parsing only; open-banking / bank-API integration is out of scope.
- **No shared/multi-user household budgets.** Each account sees only its own data.
- **No fully automatic (unsupervised) AI categorization.** v3 adds AI-assisted parsing/categorization, but it only ever proposes into the user's existing categories and never saves without explicit confirmation; the app does not auto-categorize or auto-create categories.
- **No month-over-month trend analysis beyond a single previous-month comparison.** No trend lines, forecasting, or multi-month analytics; the dashboard chart is a per-category breakdown of the current month.
- **No payment reminders for upcoming bills, budgets, spending limits, alerts, or notifications.** The app reports what was spent; it does not set targets or push notifications.
- **No multiple shipped languages / no language-switcher UI.** Strings are externalized to keys, but Polish is the only shipped language in this iteration; no runtime language toggle.
- **No CSV/Excel export.** Considered but dropped so all effort goes to the core flow.
- **No multi-currency / FX conversion.** Single currency label per user account, relabel-only on change; no exchange-rate lookups, no per-expense currency, no historical conversion.
- **No expense keyword/full-text search.** Category-filtered browsing only.
- **No role/permission changes.** Auth and access control stay flat as they are today.

## Implementation Status

Current build state per requirement (mapped to roadmap slices in `context/foundation/roadmap.md`).

| FR                     | Capability                              | Roadmap slice                     | Status  |
| ---------------------- | --------------------------------------- | --------------------------------- | ------- |
| FR-001, FR-002         | Account create + sign in / out          | S-01 `account-signin-signout`     | done    |
| FR-003, FR-005         | View default + add categories           | S-02 `expense-categories`         | done    |
| FR-004                 | Edit / delete category                  | `category-editing`                | done    |
| FR-006–FR-009          | Log expense + ranked monthly summary    | S-03 `log-and-summarize-expenses` | done    |
| FR-010                 | Persistent nav menu                     | S-04 `persistent-nav-menu`        | done    |
| FR-011                 | Optional expense name/description        | S-05 `expense-name-description`    | done    |
| FR-012                 | Category → expenses drill-down          | S-06 `category-expense-drilldown` | done    |
| FR-013                 | Per-user currency (relabel-only)        | S-07 `user-currency-setting`      | done    |
| FR-014                 | Preserved behavior (cross-cutting)      | guardrail across all slices       | ongoing |
| **FR-015–FR-019**      | **Monthly dashboard (chart/total/MoM)** | v3 — roadmap slice TBD            | **planned (this iteration)** |
| **FR-020–FR-024**      | **UX: Polish, landing, sticky, settings, filter** | v3 — roadmap slices TBD  | **planned (this iteration)** |
| **FR-025–FR-028**      | **AI-assisted expense entry**           | v3 — roadmap slice TBD (later)    | **planned (later slice)** |

## Open Questions

Iteration-3 (AI slice) questions carried from `prd-v4.md`:

1. **AI provider & data handling** — which external service performs the parsing + classification, whether it fits the deployment runtime's constraints, and its exact data-handling / retention terms. Owner: user (with downstream stack selection). Block: no (AI is a later slice).
2. **AI parsing accuracy & amount/currency formats** — how reliably free text like "lidl 200zł" is parsed (amount, currency symbol, multiple items per line) and the acceptable error rate before the review step becomes a burden. Owner: user. By: before the AI slice is planned.
3. **AI data-shape impact** — confirm at planning that assisted entry needs no new expense fields (assumed none). Owner: user. By: AI-slice planning.
