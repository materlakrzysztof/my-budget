---
project: MyBudget
context_type: brownfield
created: 2026-07-23
updated: 2026-07-23
product_type: web-app
target_scale:
  users: small
  qps: low
  data_volume: small
timeline_budget:
  delivery_weeks: 3
  hard_deadline: null
  after_hours_only: true
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  gray_areas_resolved:
    - topic: "must preserve"
      decision: "existing expense & category data and monthly summary totals must stay correct; current Supabase login/session behavior must keep working unchanged"
    - topic: "change category"
      decision: "bundle of four small, mostly independent UX/feature additions: navigation reorganization, expense name/description field, category-filtered expense list, per-user currency setting"
    - topic: "currency scope"
      decision: "one currency per user account (set once, e.g. in settings), not per-expense — matches the single-household-budget use case"
    - topic: "auth/roles"
      decision: "no changes — current Supabase login and flat single-user model preserved"
    - topic: "blast radius"
      decision: "existing expense records are the main risk — adding name/description and currency fields requires a migration with safe defaults for existing rows; nav, category browsing, and the settings-level currency picker are additive-only"
    - topic: "timeline"
      decision: "3 weeks after-hours, no hard deadline; no Secondary success criterion — scope stays to the four core items"
    - topic: "currency change semantics"
      decision: "changing currency is a relabel only, no conversion — the stored number is unchanged, only the display unit changes going forward; no FX-rate dependency"
  frs_drafted: 5
  quality_check_status: accepted
---

## Current System

MyBudget is a live personal expense tracker (Astro 6 SSR + React 19 islands, Supabase auth), already shipped past its original MVP. Existing capabilities: account sign-up/sign-in/sign-out, default + custom expense categories, expense logging (today-dated or backdated) with manual category selection, and a month-end summary ranking categories by total spend. Currency is currently hardcoded to USD everywhere amounts are entered or displayed. Navigation between these areas (dashboard, expenses, categories) has no structured menu — users must find pages without a consistent nav affordance.

Users today: a single individual managing their own household budget (unchanged from the original MVP persona).

## Vision & Problem Statement (delta)

Four gaps have emerged from real usage of the shipped MVP:

1. **Navigation** — there is no organized menu; reaching "add expense" or "categories" isn't discoverable through consistent nav.
2. **Expense identity** — an expense has no name/description field, so entries are hard to tell apart later beyond amount/category/date.
3. **Category drill-down** — there's no way to browse the list of expenses filtered to a single category; the monthly summary only shows totals, not the underlying entries.
4. **Currency** — amounts are always shown/entered in USD; the user cannot set their own currency.

The insight: these are exactly the gaps that only surface after living with the MVP day-to-day — none were discoverable at initial shaping since they require having real expenses logged and a real habit of checking them.

## User & Persona

Unchanged: a single individual managing their own household budget, now an existing user of the shipped MVP rather than a prospective one. This change affects their day-to-day navigation and expense-entry experience, not new user types.

## Access Control

No changes planned — current model preserved. Supabase login (email+password/OAuth), flat user model, no roles, each authenticated user sees only their own data.

## Success Criteria

### Primary

- A logged-in user can reach "add expense" and "categories" through a persistent nav menu, set a currency once in settings that applies app-wide, add an expense with a name/description, and click into a category to see the filtered list of expenses within it.

### Secondary

- None for this change — scope stays to the four core items above.

### Guardrails

- Existing expense and category data, and the monthly per-category summary totals, remain correct after the schema change (new name/description and currency-related fields get safe defaults for pre-existing rows).
- Current Supabase login/session behavior and per-user data isolation are unaffected.
- The new nav does not remove or break any existing bookmarked route.

## User Stories

### US-01: User finds "add expense" through nav and browses a category's expenses

- **Given** a logged-in user on any page of the app
- **When** they open the nav menu and select "Add expense", then later select a category from the summary or categories page
- **Then** they reach the add-expense form directly from nav, and see the filtered list of expenses belonging to that category

#### Acceptance Criteria

- The nav menu is reachable from every authenticated page and links to Dashboard, Expenses (add), and Categories
- Selecting a category shows only expenses tagged with that category, not the full list
- Previously, there was no nav-driven path to "add expense" or a category-filtered view — both are new

### US-02: User sets currency once and it applies everywhere

- **Given** a logged-in user who has not yet set a currency (defaults to USD)
- **When** they set their currency in settings
- **Then** all expense amounts, forms, and the monthly summary display and accept that currency going forward

#### Acceptance Criteria

- Changing currency does not convert or alter previously logged amounts — it only changes the unit going forward (no FX conversion in this MVP)
- The monthly summary total still reconciles with the sum of individual expense amounts in the selected currency

## Functional Requirements

### Navigation

- FR-001: User can access a persistent nav menu from any authenticated page, linking to Dashboard, Add Expense, Categories, Settings. Priority: must-have. Change: new
  > Socratic: Counter-argument considered: "for ~4 destinations, a home-page-with-links might be simpler than a full nav." Resolution: kept as written; a persistent nav directly solves the stated discoverability pain and is low-cost.

### Expenses

- FR-002: User can add a name/description when creating or editing an expense (optional field). Priority: must-have. Change: modified
  > Socratic: Counter-argument considered: "category + amount + date may already be enough to distinguish expenses." Resolution: kept as written — explicitly requested; kept optional to avoid adding friction to every entry.

### Categories

- FR-003: User can select a category and view the list of expenses belonging to that category. Priority: must-have. Change: new
  > Socratic: Counter-argument considered: "the monthly summary already shows per-category totals — could this wait?" Resolution: kept as written — totals alone don't show which expenses made up a category; explicitly requested.

### Currency

- FR-004: User can set their currency once in settings; it applies to all amount display/entry going forward, with no conversion of previously logged amounts. Priority: must-have. Change: new
  > Socratic: Counter-argument considered: "relabeling old amounts without conversion could make historical summaries misleading if currency changes later." Resolution: acceptable as written — currency changes are expected to be rare (set once, near account creation); simplicity wins over the edge case.

### Preserved behavior

- FR-005: Existing expense list, category management, and monthly summary continue working exactly as before. Priority: must-have. Change: preserved
  > Socratic: Counter-argument considered: "this restates the Guardrails already captured in Success Criteria — redundant?" Resolution: kept as written — explicit defensive FR makes preservation a first-class requirement for implementation, not just an implicit assumption.

## Business Logic

No domain logic change. This is an infrastructure/UX change. The existing rule — rank the user's spending categories by total amount for the current month — is unchanged; nav, the name/description field, category drill-down, and the currency setting are all presentation/data-shape additions, not new decisions the app makes for the user.

## Constraints & Preserved Behavior

- Migration: the expenses table gains a nullable name/description column (existing rows: empty/null). Currency is a per-user setting (on the user/profile record), not a per-expense column, so existing expense rows need no currency migration — they are implicitly interpreted in whatever currency the user later sets, per the FR-004 relabel-only decision.
- No backward-compatibility breakage: existing bookmarked routes, the Supabase auth flow, and the monthly summary calculation must continue to work unchanged (see FR-005, Guardrails).
- No new external integrations are introduced by this change.

## Non-Functional Requirements

- Same as the existing app-wide standard: a user perceives acknowledgement of any action (opening nav, filtering by category, saving an expense, changing currency) within 1 second.
- The application remains usable on both mobile and desktop screen sizes — the new nav must not break this.

## Non-Goals

- **No multi-currency / FX conversion.** Single currency label per user account, relabel-only on change; no exchange-rate lookups, no per-expense currency, no historical conversion.
- **No expense search/full-text search.** This change adds category-filtered browsing only; keyword search across name/description is out of scope.
- **No role/permission changes.** Auth and access control stay exactly as they are today — consistent with the Access Control section.
- **No redesign of the monthly summary itself.** The existing ranked category-summary view/logic is untouched; this change only adds a way to drill into a category's underlying expense list.

## Product framing

- product_type: web-app (unchanged)
- target_scale: small / single user (unchanged)
- No existing-system constraint beyond what's already captured in CI (lint + build via GitHub Actions), Supabase migration conventions, and RLS policies.
