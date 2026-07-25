# User Currency Setting — Plan Brief

> Full plan: `context/changes/user-currency-setting/plan.md`

## What & Why

Let a user set their currency once in Settings, applying it to all amount display/entry going forward, relabel-only with no FX conversion of historical amounts. Closes the last of the four v2 gaps (`prd-v2.md` FR-004, US-02, roadmap S-07) — currency is hardcoded to USD everywhere today.

## Starting Point

`/settings` is a 17-line placeholder from S-04 ("More settings are coming soon.") with no data-fetching. No per-user settings table exists — only `categories`/`expenses`. `formatAmount` is duplicated verbatim in `ExpenseList.tsx` and `MonthlySummary.tsx`, both hardcoding `$`. No page besides `/expenses` displays amounts.

## Desired End State

A user opens Settings, picks a currency from a short list, saves it, and sees every amount on `/expenses` (list + monthly summary) relabeled in that currency going forward — same underlying numbers, new label only. New users default to USD, identical to today's behavior.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Storage | Dedicated `user_settings` table + RLS | Consistent with this app's only convention (everything is a table with per-row RLS); a `user_metadata` shortcut would be the odd one out | Plan |
| Currency list | Fixed 7 (USD, EUR, GBP, PLN, JPY, CAD, AUD) | Matches "single user, low complexity" scale; avoids a searchable-combobox UI a full ISO 4217 list would require | Plan |
| Formatting | `Intl.NumberFormat`, forced 2 decimal places for every currency | Built-in symbol/code handling with zero maintenance; forcing 2 decimals avoids touching the existing amount-entry validation (already fixed at 2 decimals) for zero-decimal currencies like JPY | Plan |
| Amount input | No currency indicator on the add/edit expense form | Keeps this change display-only on the list/summary side, per the confirmed scope — entry UX is unchanged | Plan |
| Confirmation | One-sentence help text, no modal | Matches PRD's own note that currency changes are rare and low-stakes — a modal would be disproportionate | Plan |
| Threading | Only into `/expenses` (not centralized in Layout/middleware) | No other page shows amounts today; centralizing would add a query to every protected page for no current benefit | Plan |
| Test coverage | Unit + integration, no new e2e file — reconciliation guardrail extends an existing e2e spec instead | Matches the "unit+integration only" call while still proving the PRD guardrail end-to-end, without a redundant new spec | Plan |

## Scope

**In scope:**
- New `user_settings` table (RLS, get-or-create pattern)
- `GET`/`PUT /api/settings`, real `settings.astro` + `SettingsForm` component
- Shared `formatAmount` util (`Intl.NumberFormat`, forced 2 decimals) replacing the two duplicated implementations
- Currency threaded through `expenses.astro` → `ExpensesManager` → `ExpenseList`/`MonthlySummary`
- Unit + integration tests, plus an extension to an existing e2e spec

**Out of scope:**
- FX conversion of historical amounts
- Full ISO 4217 currency list
- Per-currency native decimal-place rules (e.g. JPY's 0 decimals)
- Currency indicator on the expense amount input
- Confirmation modal on currency change
- Centralized currency-fetching outside `/expenses`
- New dedicated e2e spec file

## Architecture / Approach

Bottom-up: data/service layer (new table + get-or-create/update service) → API route + Settings page/form → shared formatter + threading into `/expenses` → tests. `Currency`/`CURRENCIES` live once in `src/types.ts`, imported by both the Zod schema and the client dropdown.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Data & Service Layer | `user_settings` migration, shared types, `getOrCreateUserSettings`/`updateUserSettings` | First table in the app needing an `update` RLS policy — must include both `using` and `with check` |
| 2. API Route & Settings Page | `GET`/`PUT /api/settings`, real `SettingsForm` UI | `updateUserSettings` must use `upsert`, not a plain `update`, so it never silently no-ops on a missing row |
| 3. Currency Threading & Display | Shared formatter, `ExpenseList`/`MonthlySummary` updated, currency piped from `expenses.astro` | Default USD must render byte-identical to today's `$40.00` output — verified via `Intl.NumberFormat` behavior, not assumed |
| 4. Testing | Unit (formatter, enum), integration (settings service), one existing e2e spec extended | None — purely additive coverage, no new e2e file |

**Prerequisites:** None — independent of S-04/S-05/S-06 per roadmap.
**Estimated effort:** ~2 sessions across 4 phases — broadest touch surface of the four v2 slices (new table, new endpoint, new page content, plus a cross-cutting display change).

## Open Risks & Assumptions

- Assumes `Intl.NumberFormat("en-US", ...)` producing `"$40.00"` for USD is verified equivalent to today's hardcoded string (confirmed during planning — see plan's Key Discoveries) so existing e2e assertions on that exact string keep passing without modification.
- Assumes a short fixed currency list is acceptable long-term; adding a currency later means a one-line change to `CURRENCIES` in `src/types.ts`, not a redesign.

## Success Criteria (Summary)

- User can set a currency once in Settings and see it applied across `/expenses`
- Historical amounts are never converted — only relabeled
- The monthly summary total still reconciles with the sum of individual expenses after a currency change
