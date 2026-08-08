---
project: MyBudget
version: 4
status: draft
created: 2026-07-27
context_type: brownfield
product_type: web-app
target_scale:
  users: small
  qps: low
  data_volume: small
timeline_budget:
  delivery_weeks: 3
  hard_deadline: null
  after_hours_only: true
---

> Brownfield delta PRD for the third iteration of MyBudget: a monthly dashboard, a
> batch of UX improvements, and AI-assisted expense entry (sequenced as a separate
> later slice). This describes what CHANGES against the shipped product; the
> consolidated product spec lives in `context/foundation/prd.md`. Generated from
> `context/foundation/shape-notes.md`.

## Current System Overview

- **Purpose**: a personal expense tracker that lets one household budgeter log expenses and see where their money went each month.
- **Architecture**: server-side-rendered web app with client-side interactive islands; serverless deployment.
- **Tech stack**: Astro 6 SSR + React 19 islands, Tailwind 4, shadcn/ui; Supabase for auth and Postgres (per-user Row-Level Security); deployed to Cloudflare Workers; CI via GitHub Actions (lint + build + migration safety).
- **User base**: a single individual managing their own household budget (small scale, low traffic).
- **Core functionality today**: account sign-up / sign-in / sign-out; default + custom expense categories with full add/edit/delete; expense logging (today-dated or backdated) with an optional name/description and manual category selection; a per-user currency setting (relabel-only, no FX); a persistent nav menu; category drill-down; and a month-end summary that ranks categories by total spend for the current month. UI language is currently English.

## Problem Statement & Motivation

Three groups of gaps surfaced from daily use of the shipped app:

1. **No visual monthly dashboard.** The current summary is a flat ranked list of category totals — no chart, no headline total, and no comparison to the previous month. The user can't see spending shape or month-over-month movement at a glance.
2. **UX / navigation friction.** The UI is English (the user wants Polish); there's no landing page explaining what the app does; the nav header isn't sticky; category management sits on its own page rather than in settings; there's no quick "add expense" entry point from the main view; and the expenses list has no category picker to filter by.
3. **Fully manual expense entry.** Every expense is typed field-by-field. The user wants an assisted path: type free text like "lidl 200zł" and have the app extract the amount + description and categorize it, then review before saving.

Why now: these only become visible after real day-to-day use — you need real logged expenses and a checking habit before a flat total list feels insufficient and manual entry feels slow. The current workaround is reading the flat summary and typing every field by hand.

## User & Persona

Unchanged: a single individual managing their own household budget — now an existing daily user of the shipped app. These changes affect their day-to-day viewing, navigation, and expense-entry experience; no new user types are introduced.

## Success Criteria

### Primary

- A logged-in user, with the UI in Polish, lands on a home page that explains what the app does; reaches a **dashboard** showing this month's spending as a chart, the total sum, a per-category breakdown, and a comparison against the previous month; navigates the whole app through a **sticky** header; adds an expense in one click from the dashboard; filters the expenses list by category; and finds category management under **Settings**.
- (Later slice) A logged-in user opens an "add expense" dialog, switches it to free-text mode, types something like "lidl 200zł", and the app proposes one or more parsed expenses (amount, description, category) to review and confirm before any are saved.

### Secondary

- None for this scope — every item above is treated as core (matching the prior delivery batch's discipline).

### Guardrails

- Existing expense and category data, and the monthly per-category totals, remain correct — the dashboard's total and per-category figures reconcile exactly with the sum of the underlying expense records.
- The current login/session behavior and per-user data isolation are unaffected.
- The per-user currency model (relabel-only, no FX) keeps working; all dashboard figures render in the user's currency.
- Reorganizing navigation (e.g., category management → Settings) must not silently break a previously working entry point; a redirect or equivalent path is preferred.
- Existing responsiveness standard holds: any local (non-AI) action acknowledges to the user within ~1 second, and the app remains usable on both mobile and desktop.
- The AI path (later slice) shows continuous visible progress while analysis is in flight and never appears frozen, even though analysis may take several seconds; the chart is legible on small screens and does not rely on color alone to convey category.
- The AI path sends only the free text the user explicitly submits for analysis — never the user's expense history or account data — and persists nothing without explicit confirmation.

## User Stories

### US-01: User sees the monthly dashboard and navigates fluidly (primary path)

- **Given** a logged-in user with expenses logged this month, UI in Polish
- **When** they open the app and reach the dashboard
- **Then** they see a chart of this month's spending broken down by category, the total sum, per-category totals, and a comparison to the previous month; a sticky header lets them move anywhere; and one click starts adding a new expense

#### Acceptance Criteria

- The dashboard's total and per-category figures reconcile exactly with the sum of the underlying expense records for the month
- The comparison shows this month vs the previous month; when there is no prior-month history, it is hidden rather than shown as zero/misleading
- The header remains visible while scrolling any page
- All labels and copy render in Polish

### US-02: User adds expenses from free text via assisted analysis (later slice, primary path)

- **Given** a logged-in user with existing categories
- **When** they open the add-expense dialog, switch to free-text mode, type e.g. "lidl 200zł, orlen 150zł", and submit for analysis
- **Then** the app returns a review list of parsed expenses — each with an amount, a description, and a category chosen from the user's existing categories — which the user can adjust and must confirm before any are saved

#### Acceptance Criteria

- One free-text input may yield multiple parsed expenses
- Each proposed category is one of the user's existing categories (no new categories are created)
- Nothing is persisted until the user confirms the review list

## Scope of Change

Delta against the shipped product. Each item carries an FR id and its category (`new` / `modified` / `preserved`); Socratic rationale from shaping is preserved.

### Dashboard

- FR-001 `[new]`: User can view a monthly dashboard showing a chart of the current month's spending broken down by category.
  > Socrates: Counter — "a table of totals might be enough." Resolution: a visual chart was explicitly requested; per-category breakdown chosen.
- FR-002 `[new]`: User can see the total sum of all expenses for the current month on the dashboard.
  > Socrates: Counter — "redundant with per-category totals." Resolution: kept; the headline total is a distinct at-a-glance number the flat list doesn't surface.
- FR-003 `[modified]`: User can see per-category spending totals for the current month on the dashboard (the existing monthly summary is absorbed into the dashboard).
  > Socrates: Counter — "duplicates the existing summary." Resolution: intentional — the summary is folded into the dashboard, not duplicated.
- FR-004 `[new]`: User can compare the current month's spending against the previous month (total, and per-category where available); when there is no prior-month history, the comparison is hidden.
  > Socrates: Counter — "first-month users have nothing to compare against." Resolution (revised): hide the comparison until prior-month data exists.
- FR-005 `[new]`: User can start adding an expense directly from the dashboard via a quick action.
  > Socrates: Counter — "nav already reaches add-expense." Resolution: the dashboard is the primary landing view; a direct action removes a navigation hop.

### UX & Navigation

- FR-006 `[modified]`: The user-facing UI is presented in Polish, with strings externalized to message keys so another language could be added later without rewriting copy. No language-switcher UI is in scope.
  > Socrates: Counter — "hardcoding Polish is a rewrite tax if EN is ever wanted." Resolution (revised): use a minimal key-based translation layer now; Polish is the only shipped language.
- FR-007 `[new]`: A visitor can view a home/landing page describing the app's capabilities; authenticated users proceed to the dashboard.
  > Socrates: Counter — "single-user app needs no marketing landing." Resolution: kept as a public shop-window for unauthenticated visitors; authed users skip to the dashboard.
- FR-008 `[modified]`: The navigation header stays visible (sticky) as the user scrolls any page.
  > Socrates: Counter — "cosmetic." Resolution: directly addresses the stated navigation-friction pain; low cost.
- FR-009 `[modified]`: User can manage categories (add/edit/delete) from within Settings, rather than a standalone page. A redirect from the old category route is preferred so existing bookmarks don't break.
  > Socrates: Counter — "moving the route breaks existing bookmarks." Resolution: kept; add a redirect from the old route.
- FR-010 `[modified]`: User can filter the expenses list by choosing a category from a picker on the expenses page.
  > Socrates: Counter — "URL-based category drill-down already exists." Resolution: the in-page picker is the missing discoverable affordance; the existing drill-down is deep-link only.

### AI-assisted expense entry (later slice)

- FR-011 `[modified]`: User can add expenses through a modal/dialog.
  > Socrates: Counter — "the current form already works." Resolution: the dialog unifies manual and assisted entry behind one entry point (see FR-012).
- FR-012 `[new]`: The add-expense dialog lets the user switch between a structured form and a free-text field submitted for AI analysis.
  > Socrates: Counter — "two modes add UI complexity." Resolution: a single dialog with a toggle keeps one entry point rather than competing buttons.
- FR-013 `[new]`: User can enter free text (e.g., "lidl 200zł, orlen 150zł") and the app parses one or more expenses — extracting amount and description and assigning each to one of the user's existing categories. Nothing is persisted directly; output always flows through the review step (FR-014).
  > Socrates: Counter — "free-text parsing is error-prone and sends expense text to an external service (privacy/cost)." Resolution: kept, gated behind mandatory confirmation; parsing accuracy and provider choice go to Open Questions; privacy/cost captured as guardrails.
- FR-014 `[new]`: The app presents the parsed expense(s) as a review list the user can adjust and must confirm before any are saved.
  > Socrates: Counter — "an extra confirmation step slows entry." Resolution: the review step is the trust guard for fallible parsing; non-negotiable.

### Preserved

- FR-015 `[preserved]`: Existing expense logging, category add/edit/delete, per-user currency setting, authentication, and monthly total calculations continue to work unchanged; the dashboard's figures reconcile with the underlying records.
  > Socrates: Counter — "restates the Guardrails — redundant." Resolution: kept as an explicit defensive item so preservation is a first-class implementation requirement.

## Constraints & Compatibility

- **Backward compatibility**: existing routes/bookmarks should keep working; relocating category management to Settings should provide a redirect from the old route. The existing authentication/session flow and per-user data isolation must be untouched.
- **Data migration**: none expected. The dashboard is read-only aggregation over existing records; assisted entry writes ordinary expense records only after user confirmation, reusing the existing expense data shape. No new fields are anticipated (to be re-confirmed at planning).
- **Existing integrations that must keep working**: the monthly aggregation that currently feeds the summary must keep producing identical totals — the dashboard is a new presentation over the same numbers, not a recalculation with different semantics.
- **New outbound dependency (AI slice only)**: the assisted-entry path introduces a call to an external AI text-analysis service — a new third-party dependency the app doesn't have today. It must fit the existing deployment runtime's constraints. It is the only part of this work that adds an outbound dependency; provider, SDK, and cost/rate posture are deferred to downstream stack selection.
- **Preserved behavior (explicit)**: existing expense/category data and monthly totals; login/session behavior; the per-user currency model.

## Business Logic Changes

Two distinct kinds of logic are involved:

1. **Dashboard — extends the existing rule (no new decision).** The current rule — *rank the user's spending categories by total amount for the current month* — is unchanged. The dashboard presents that aggregation visually (per-category chart + headline total) and adds one small new computation: the current month's spending compared against the previous month's (total, and per-category where data exists). This is arithmetic over existing records, not a new decision the app makes for the user.

2. **Assisted entry — a genuinely new classification rule (later slice).** Given a free-text string the user types, the app extracts one or more expenses — each an amount and a description — and classifies each into one of the user's *existing* categories. This is a real domain decision (extraction + classification), gated so the app never persists its own inference: the parsed result is always presented for the user to adjust and confirm first.

## Access Control Changes

No access control changes — current model preserved. Login (email + password / OAuth), flat single-user model, no roles; each authenticated user sees only their own data. Moving category management under "Settings" is a UI/navigation reorganization only — it adds no roles and changes nothing about who can access what. The assisted-entry path operates entirely within the existing authenticated user's own data scope.

## Non-Goals

- **No multi-currency / FX conversion.** One currency label per user (relabel-only); no exchange-rate lookups, no per-expense currency, no historical conversion.
- **No multiple shipped languages / no language-switcher UI.** Strings are externalized to keys, but Polish is the only language shipped in this scope; no runtime language toggle.
- **No budgets, spending limits, alerts, payment reminders, or notifications.** The app reports what was spent; it does not set targets or push notifications.
- **No auto-created categories and no auto-save from assisted entry.** Parsing classifies only into the user's existing categories and only proposes — nothing is persisted without explicit confirmation.
- **No spend-over-time / advanced analytics beyond the category breakdown + previous-month comparison.** Trend lines, forecasting, and multi-month analytics are out of scope.
- **No CSV/Excel export and no full-text expense search.** Both remain parked from earlier scope decisions.

## Open Questions

1. **AI provider & data handling** — which external service performs the parsing + classification, whether it fits the deployment runtime's constraints, and its exact data-handling / retention terms. Owner: user (with downstream stack selection). Block: no (AI is a later slice).
2. **AI parsing accuracy & amount/currency formats** — how reliably free text like "lidl 200zł" is parsed (amount, currency symbol, multiple items per line) and the acceptable error rate before the review step becomes a burden. Owner: user. By: before the AI slice is planned.
3. **AI data-shape impact** — confirm at planning that assisted entry needs no new expense fields (assumed none). Owner: user. By: AI-slice planning.
