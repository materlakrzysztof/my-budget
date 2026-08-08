---
project: MyBudget
context_type: brownfield
created: 2026-07-27
updated: 2026-07-27
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
    - topic: "dashboard vs existing summary"
      decision: "new dashboard absorbs the existing monthly summary; earlier 'no redesign of summary' non-goal lifted"
    - topic: "language depth"
      decision: "UI in Polish via a lightweight key-based i18n layer (strings externalized); no language-switcher UI; Polish is the only shipped language (revised from hardcode during Socrates)"
    - topic: "dashboard chart focus"
      decision: "chart shows per-category breakdown of the month's spending (not spend-over-time)"
    - topic: "AI input cardinality"
      decision: "one free-text input may yield multiple parsed expenses (batch), shown as a review list"
    - topic: "AI categorization pool"
      decision: "AI assigns only from the user's existing categories; it does not create new ones"
    - topic: "prior-month comparison empty state"
      decision: "hide the month-over-month comparison entirely until prior-month data exists"
    - topic: "AI feature scope"
      decision: "shape AI-assisted entry here but sequence it as a separate, later roadmap slice after dashboard + UX"
    - topic: "must preserve"
      decision: "existing expense/category data and monthly totals; Supabase auth/sessions and per-user data isolation; current per-user currency model"
  frs_drafted: 15
  quality_check_status: accepted
---

## Current System

MyBudget is a live personal expense tracker (Astro 6 SSR + React 19 islands, Supabase auth, deployed to Cloudflare Workers), shipped well past its original MVP. Existing capabilities: account sign-up/sign-in/sign-out; default + custom expense categories with full edit/delete; expense logging (today-dated or backdated) with an optional name/description and manual category selection; a per-user currency setting (relabel-only, no FX); a persistent nav menu; category drill-down (`/expenses?category=<id>`); and a month-end summary that ranks categories by total spend for the current month.

Users today: a single individual managing their own household budget (unchanged persona). UI language is currently English.

## Vision & Problem Statement (delta)

Three groups of gaps have emerged from living with the shipped app:

1. **No visual monthly dashboard.** The current summary is a flat ranked list of category totals. There is no chart, no headline total, and no comparison to the previous month — so the user can't see spending shape or month-over-month movement at a glance.
2. **UX / navigation friction.** The UI is English (the user wants Polish); there is no landing/home page explaining what the app does; the nav header isn't sticky; category management lives on its own page rather than in settings; there's no quick "add expense" entry point from the main view; and the expenses page has no category picker to filter by.
3. **Expense entry is fully manual.** Every expense is typed field-by-field. The user wants an AI-assisted path: type free text like "lidl 200zł" and have the app extract amount + description and categorize it, then review before saving.

**Framing decisions (Phase 1):**

- The new **dashboard absorbs the existing monthly summary** — it becomes the primary monthly view, with the current category-ranking folded into it. (This lifts the earlier "no redesign of the monthly summary" non-goal.)
- **Language**: present the UI in Polish via a lightweight key-based translation layer (strings externalized) so another language could be added later without a rewrite — but no language-switcher UI in this scope. Polish is the only shipped language. (Revised from an initial "hardcode Polish" during the Socrates round.)
- **AI-assisted expense entry** is shaped here but sequenced as a **separate, later slice** (its own roadmap item), after the dashboard and UX work — it carries an external LLM integration, cost, and privacy considerations the other two groups don't.

The insight: these gaps only surface after real day-to-day use — you need real logged expenses and a checking habit before a flat total list feels insufficient and manual entry feels slow.

## User & Persona

Unchanged: a single individual managing their own household budget — now an existing user of the shipped app. These changes affect their day-to-day viewing, navigation, and expense-entry experience; no new user types are introduced.

## Access Control

No changes planned — current model preserved. Supabase login (email+password / OAuth), flat single-user model, no roles; each authenticated user sees only their own data. Moving category management under "Settings" is a UI/navigation reorganization only — it does not add roles or change who can access what. The AI-assisted entry path (later slice) operates entirely within the existing authenticated user's own data scope.

## Success Criteria

### Primary

- A logged-in user, with the UI in Polish, lands on a home page that explains what the app does; reaches a **dashboard** showing this month's spending as a chart, the total sum, a per-category breakdown, and a comparison against the previous month; navigates the whole app through a **sticky** header; adds an expense in one click from the dashboard; filters the expenses page by category; and finds category management under **Settings**.
- (Later slice) A logged-in user opens an "add expense" dialog, switches it to free-text mode, types something like "lidl 200zł", and the app proposes one or more parsed expenses (amount, description, category) for the user to review and confirm before they are saved.

### Secondary

- None for this scope — every item above is treated as core (matching the prior delivery batch's discipline).

### Guardrails

- Existing expense and category data, and the monthly per-category totals, remain correct — the dashboard's total and per-category figures must reconcile exactly with the sum of the underlying expense records.
- Current Supabase login/session behavior and per-user data isolation are unaffected.
- The per-user currency model (relabel-only, no FX) keeps working; all dashboard figures render in the user's currency.
- Reorganizing navigation (e.g., category management → Settings) should not silently break a previously working entry point; a redirect or equivalent path is preferred (soft — not marked must-preserve by the user).

## User Stories

### US-01: User sees the monthly dashboard and navigates fluidly (primary path)

- **Given** a logged-in user with expenses logged this month, UI in Polish
- **When** they open the app and reach the dashboard
- **Then** they see a chart of this month's spending broken down by category, the total sum, per-category totals, and a comparison to the previous month; a sticky header lets them move anywhere; and one click starts adding a new expense

#### Acceptance Criteria

- The dashboard's total and per-category figures reconcile exactly with the sum of the underlying expense records for the month
- The comparison shows this month vs the previous month (at least at the total level; per-category if available)
- The header remains visible while scrolling any page
- All labels and copy render in Polish

### US-02: User adds expenses from free text via AI (later slice, primary path)

- **Given** a logged-in user with existing categories
- **When** they open the add-expense dialog, switch to free-text mode, type e.g. "lidl 200zł, orlen 150zł", and submit for analysis
- **Then** the app returns a review list of parsed expenses — each with an amount, a description, and a category chosen from the user's existing categories — which the user can adjust and must confirm before any are saved

#### Acceptance Criteria

- One free-text input may yield multiple parsed expenses
- Each proposed category is one of the user's existing categories (AI does not create new categories)
- Nothing is persisted until the user confirms the review list

## Functional Requirements

### Dashboard

- FR-001: User can view a monthly dashboard showing a chart of the current month's spending broken down by category. Priority: must-have. Change: new
  > Socrates: Counter — "a table of totals might be enough." Resolution: a visual chart was explicitly requested; per-category breakdown chosen in Phase 4.
- FR-002: User can see the total sum of all expenses for the current month on the dashboard. Priority: must-have. Change: new
  > Socrates: Counter — "redundant with per-category totals." Resolution: kept; the headline total is a distinct at-a-glance number the flat list doesn't surface.
- FR-003: User can see per-category spending totals for the current month on the dashboard. Priority: must-have. Change: modified
  > Socrates: Counter — "duplicates the existing summary." Resolution: intentional — the existing summary is absorbed into the dashboard (Phase 1 decision), not duplicated.
- FR-004: User can compare the current month's spending against the previous month (total, and per-category where available); when there is no prior-month history, the comparison is hidden rather than shown as zero/misleading. Priority: must-have. Change: new
  > Socrates: Counter — "first-month users have nothing to compare against." Resolution (revised): hide the comparison entirely until prior-month data exists.
- FR-005: User can start adding an expense directly from the dashboard via a quick action. Priority: must-have. Change: new
  > Socrates: Counter — "nav already reaches add-expense." Resolution: the dashboard is the primary landing view; a direct action removes a navigation hop.

### UX & Navigation

- FR-006: The user-facing UI is presented in Polish, implemented via a lightweight translation layer (message keys) so another language can be added later without rewriting copy. No language-switcher UI is required in this scope. Priority: must-have. Change: modified
  > Socrates: Counter — "hardcoding Polish is a rewrite tax if EN is ever wanted." Resolution (revised): use a minimal key-based i18n layer now; Polish is the only shipped language, but strings are externalized.
- FR-007: A visitor can view a home/landing page describing the app's capabilities; authenticated users proceed to the dashboard. Priority: must-have. Change: new
  > Socrates: Counter — "single-user app needs no marketing landing." Resolution: kept as a public shop-window for unauthenticated visitors; authed users skip straight to the dashboard.
- FR-008: The navigation header stays visible (sticky) as the user scrolls any page. Priority: must-have. Change: modified
  > Socrates: Counter — "cosmetic." Resolution: directly addresses the stated navigation-friction pain; low cost.
- FR-009: User can manage categories (add/edit/delete) from within Settings, rather than a standalone page. A redirect from the old category route is preferred so existing bookmarks don't break. Priority: must-have. Change: modified
  > Socrates: Counter — "moving the route breaks existing /categories bookmarks." Resolution: kept; add a redirect from the old route (soft guardrail from Success Criteria).
- FR-010: User can filter the expenses list by choosing a category from a picker on the expenses page. Priority: must-have. Change: modified
  > Socrates: Counter — "URL-based category drill-down (`?category=`) already exists." Resolution: the in-page picker is the missing discoverable affordance; the existing drill-down is deep-link only.

### AI-assisted expense entry (later slice)

- FR-011: User can add expenses through a modal/dialog. Priority: must-have. Change: modified
  > Socrates: Counter — "the current form already works." Resolution: the dialog unifies manual and AI entry behind one entry point (see FR-012).
- FR-012: The add-expense dialog lets the user switch between a structured form and a free-text field submitted for AI analysis. Priority: must-have. Change: new
  > Socrates: Counter — "two modes add UI complexity." Resolution: a single dialog with a toggle keeps one entry point rather than competing buttons.
- FR-013: User can enter free text (e.g., "lidl 200zł, orlen 150zł") and the app parses one or more expenses — extracting amount and description and assigning each to one of the user's existing categories. AI never persists directly; output always flows through the review step (FR-014). Priority: must-have. Change: new
  > Socrates: Counter — "free-text parsing is error-prone and sends expense text to an external LLM (privacy/cost)." Resolution: kept, gated behind mandatory confirmation; parsing accuracy and AI-provider choice go to Open Questions; privacy/cost captured as NFRs (Phase 5).
- FR-014: The app presents the AI-parsed expense(s) as a review list the user can adjust and must confirm before any are saved. Priority: must-have. Change: new
  > Socrates: Counter — "an extra confirmation step slows entry." Resolution: the review step is the trust guard for fallible AI output; non-negotiable.

### Preserved behavior

- FR-015: Existing expense logging, category CRUD, per-user currency setting, Supabase auth, and monthly total calculations continue to work unchanged; the dashboard's figures reconcile with the underlying records. Priority: must-have. Change: preserved
  > Socrates: Counter — "restates the Guardrails — redundant." Resolution: kept as an explicit defensive FR so preservation is a first-class implementation requirement.

## Business Logic

Two distinct kinds of logic are involved:

1. **Dashboard (aggregation / presentation — extends the existing rule).** The current domain rule — *rank the user's spending categories by total amount for the current month* — is unchanged. The dashboard presents that aggregation visually (per-category chart + headline total) and adds one small new computation: the current month's spending compared against the previous month's (total, and per-category where data exists). This is arithmetic over existing records, not a new decision the app makes for the user.

2. **AI-assisted entry (a genuinely new classification rule — later slice).** Given a free-text string the user types, the app extracts one or more expenses — each an amount and a description — and classifies each into one of the user's *existing* categories. This is a real domain decision (extraction + classification), gated so the app never persists its own inference: the parsed result is always presented for the user to adjust and confirm first.

## Non-Functional Requirements

- Local, non-AI actions (opening the dashboard, filtering by category, switching pages, saving a manually-entered expense) acknowledge to the user within ~1 second — the existing app-wide standard.
- AI analysis of free text may take several seconds (it calls an external service); during analysis the user sees continuous visible progress feedback, and the UI never appears frozen. This is a deliberate exception to the ~1s rule, scoped to the AI path only.
- The data sent to the AI provider is limited to the free-text the user explicitly submits for analysis — the app does not send the user's expense history or account data. (Provider choice and exact data-handling terms are an Open Question, resolved downstream of stack selection.)
- Dashboard figures must remain correct and reconcile with the underlying records regardless of expense count for a typical personal-use month.
- The app remains usable on both mobile and desktop; the chart must be legible on small screens and must not rely on color alone to convey category (accessibility).

## Constraints & Preserved Behavior

- **Dashboard absorbs the existing monthly summary.** The aggregation that currently feeds the summary must keep producing identical totals; the dashboard is a new presentation over the same numbers, not a recalculation with different semantics.
- **Category-management relocation** to Settings changes the route that served the standalone categories page; a redirect from the old route is preferred so existing bookmarks/links keep working (see FR-009 / Guardrails).
- **i18n layer** externalizes UI strings to message keys; this must change only where copy comes from, not any behavior or data.
- **New external dependency (AI, later slice).** The AI path introduces a call to an external LLM service — a new integration this app doesn't have today. It must run within the Cloudflare Workers runtime constraints, and it is the only part of this work that adds an outbound third-party dependency. Provider, SDK, and cost/rate posture are deferred to downstream stack selection.
- **No data migration expected.** The dashboard is read-only aggregation; AI-assisted entry writes ordinary expense rows only after user confirmation, reusing the existing expense schema. No new columns are anticipated (to be re-confirmed at planning).

## Non-Goals

- **No multi-currency / FX conversion.** One currency label per user (relabel-only); no exchange-rate lookups, no per-expense currency, no historical conversion. (Carried forward.)
- **No multiple shipped languages / no language-switcher UI.** Strings are externalized to i18n keys, but Polish is the only language shipped in this scope; no runtime language toggle.
- **No budgets, spending limits, alerts, payment reminders, or notifications.** The app reports what was spent; it does not set targets or push notifications.
- **AI does not create categories and never auto-saves.** AI classifies only into the user's existing categories and only proposes — nothing is persisted without explicit user confirmation.
- **No spend-over-time / advanced analytics beyond the category breakdown + previous-month comparison.** The dashboard chart is a per-category breakdown; trend lines, forecasting, and multi-month analytics are out of scope.
- **No CSV/Excel export and no full-text expense search.** Both remain parked from earlier scope decisions.

## Product framing

- product_type: web-app (unchanged).
- target_scale: small / single user (unchanged).
- timeline: ~3 weeks after-hours, no hard deadline; the set will be sliced into small independent roadmap items (dashboard, then individual UX items), with AI-assisted entry sequenced as a separate later slice.
- No new existing-system constraint beyond what's already in place (GitHub Actions CI: lint + build; Supabase migration conventions + RLS). The AI slice will add an external LLM dependency — provider/SDK decided downstream.

## Open Questions

- **AI provider & data handling** — which LLM/service performs the parsing+classification, whether it runs within Cloudflare Workers constraints, and its exact data-handling/retention terms. (Deferred to downstream stack selection.)
- **AI parsing accuracy & currency/amount formats** — how reliably free text like "lidl 200zł" is parsed (amount, currency symbol, multiple items per line), and the acceptable error rate before the review step becomes a burden.
- **AI schema impact** — confirm at planning that AI-assisted entry needs no new expense columns (assumed none).

## Quality cross-check

All required elements present at close — no gaps recorded:

- Access Control: present (current model preserved)
- Business Logic: present (existing per-category ranking rule + new AI extraction/classification rule)
- Project artifacts: present
- Timeline-cost acknowledged: present (3 weeks, sliced)
- Non-Goals: present (6 entries)
- Preserved behavior: present (data/totals, auth/sessions, currency, category-route redirect, no migration)

Status: accepted.

