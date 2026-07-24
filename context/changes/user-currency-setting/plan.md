# User Currency Setting Implementation Plan

## Overview

Let a user set their currency once in Settings, applying it to how amounts are labeled everywhere on `/expenses` going forward — relabel-only, no FX conversion of historical amounts. Closes the "currency" gap named in `prd-v2.md` (FR-004, US-02) and roadmap slice S-07, the broadest-touch-surface slice of the four v2 changes.

## Current State Analysis

- `src/pages/settings.astro` (17 lines, full file) is exactly the S-04 placeholder: no frontmatter data-fetching, no form — just a static "More settings are coming soon." paragraph. This is a blank slate.
- No per-user settings/profile table exists anywhere — only `categories` and `expenses` (`supabase/migrations/20260721120000_create_categories.sql`, `20260722090000_create_expenses.sql`). A new migration is required.
- `formatAmount` is duplicated byte-for-byte in `src/components/expenses/ExpenseList.tsx:10-11` and `src/components/expenses/MonthlySummary.tsx:7-9`, both hardcoding `` `$${Number(x).toFixed(2)}` ``. No shared formatting util exists.
- `context.locals.user` (`src/middleware.ts`, typed in `src/env.d.ts:1-5`) is the raw Supabase Auth `User` — no custom fields are added today, and `/settings` is already in `PROTECTED_ROUTES` (`middleware.ts:4`), so auth gating is already in place.
- `listCategories` (`src/lib/services/categories.ts:62-73`) is the only "seed-on-first-read" precedent in the codebase: select existing rows, and if none, insert defaults, tolerating a `23505` unique-violation race, then re-select. This is the template for a settings get-or-create.
- `src/pages/api/categories.ts` (57 lines, full file) is the exact API-route template to follow: `prerender = false`, a local `json()` helper, `GET`/`POST` each guarding on `context.locals.user` (401) and `createClient` (500), zod `safeParse` (400 on failure), domain-error-to-status mapping in a try/catch.
- `src/components/categories/AddCategoryForm.tsx` is the form-component template: local field state, a `validate()` function, `handleSubmit` calling an async `onCreate`/`onSubmit` prop, a submitting-disabled `Button`.
- `src/components/Topbar.astro:30-32` already links to `/settings` ("Settings") — no nav change needed.
- No page other than `/expenses` displays amounts today (`dashboard.astro` is a static welcome page); currency only needs to be threaded into `expenses.astro` and its children, not app-wide.
- `Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(40)` produces `"$40.00"` — identical to today's hardcoded output, so existing e2e assertions on `$40.00`-style strings remain valid for the USD default with no regression.

## Desired End State

A user can open Settings, pick a currency from a short list (USD, EUR, GBP, PLN, JPY, CAD, AUD), save it, and see all amounts on `/expenses` (the expense list and the monthly summary) formatted in that currency going forward. Existing amounts are not converted — only relabeled. A one-sentence note under the dropdown makes this explicit. The default for any user who hasn't set one yet is USD, matching today's behavior exactly.

### Key Discoveries:

- `EXPENSE_SELECT`-style single-source formatting doesn't exist for currency — `formatAmount` must be extracted once and reused by both `ExpenseList` and `MonthlySummary`.
- Because `expenses.astro` is the only page fetching amount-bearing data, currency only needs threading through its own frontmatter → `ExpensesManager` → `ExpenseList`/`MonthlySummary` — no change to `dashboard.astro`, `categories.astro`, or `Layout.astro`.
- The `amount` DB column (`numeric(12,2)`) and its Zod validation (`amountSchema`, always up to 2 decimal places) are unaffected — currency changes are display-only, so no schema change touches `expenses`.

## What We're NOT Doing

- No FX conversion of historical (or future) amounts — pure relabeling, per `prd-v2.md` Non-Goals and the guardrail in Success Criteria.
- No full ISO 4217 currency list — a short fixed list of 7 currencies (USD, EUR, GBP, PLN, JPY, CAD, AUD).
- No per-currency decimal-place rules (e.g. JPY's native 0 decimals) — always force 2 decimal places via `Intl.NumberFormat`'s `minimumFractionDigits`/`maximumFractionDigits`, so the existing amount-entry validation (always up to 2 decimals) never needs to change.
- No currency indicator on the expense add/edit form's Amount input — only the expense list and monthly summary display the currency; entry stays exactly as it is today.
- No confirmation modal before saving a currency change — a one-sentence help text under the dropdown covers the "no conversion" disclosure.
- No centralizing currency-fetching in `Layout.astro`/middleware — each page keeps fetching its own data, matching the existing architecture; only `expenses.astro` gains the new fetch.
- No dedicated e2e spec file for this change — the currency-change flow and its reconciliation guardrail extend an existing e2e spec instead.
- No test coverage for the settings-row concurrent-first-read race — matches the precedent set by `listCategories`, which also has no such dedicated test in this repo.

## Implementation Approach

Bottom-up, in four phases: the data/service layer first (Phase 1), then the API route and Settings page/form on top of it (Phase 2), then the shared formatter and currency threading into `/expenses` (Phase 3), then tests (Phase 4). `Currency` and the fixed `CURRENCIES` list live in `src/types.ts` — the single source both the service layer's Zod schema and the client-side dropdown import from, mirroring how other shared DTOs already live there.

## Critical Implementation Details

**Update must never fail on a missing row.** `settings.astro` always calls the get-or-create function server-side before the Settings page renders, so by the time the form's Save button fires a `PUT`, a row already exists for that user — but `updateUserSettings` should still use an `upsert` (not a plain `update`) so it degrades safely rather than depending on that ordering as an invariant.

## Phase 1: Data & Service Layer

### Overview

New table, new service module, new shared types — no UI yet.

### Changes Required:

#### 1. New migration

**File**: `supabase/migrations/20260724110000_create_user_settings.sql`

**Intent**: One settings row per user, following the exact RLS convention already used for `categories`/`expenses`.

**Contract**: `create table public.user_settings (user_id uuid primary key references auth.users(id) on delete cascade, currency text not null default 'USD', created_at timestamptz not null default now(), updated_at timestamptz not null default now());` with RLS enabled and three policies — `user_settings_select_own`, `user_settings_insert_own`, `user_settings_update_own` — each scoped `auth.uid() = user_id` (the `update` policy needs both `using` and `with check`, unlike `categories`, since this is the first table in the app that supports updates). No DB-level check constraint on the currency value — validated at the Zod layer only, matching the existing convention (e.g. `categories.description`'s `max(200)` is Zod-only).

#### 2. Shared types

**File**: `src/types.ts`

**Intent**: One source of truth for the supported currency list, imported by both the service layer's validation and the client-side dropdown.

**Contract**: Add `export const CURRENCIES = ["USD", "EUR", "GBP", "PLN", "JPY", "CAD", "AUD"] as const;`, `export type Currency = (typeof CURRENCIES)[number];`, `export interface UserSettings { currency: Currency }`, `export interface UpdateSettingsRequest { currency: Currency }`, and `export interface SettingsResponse { settings: UserSettings }`.

#### 3. Settings service

**File**: `src/lib/services/settings.ts` (new)

**Intent**: Get-or-create the user's settings row (seeding the `USD` default on first read, mirroring `listCategories`'s pattern) and update it.

**Contract**: `updateSettingsSchema = z.object({ currency: z.enum(CURRENCIES) })`. `getOrCreateUserSettings(supabase, userId): Promise<UserSettings>` — select by `user_id`; if no row, insert `{ user_id: userId, currency: "USD" }` tolerating a `23505` unique-violation race (same pattern as `listCategories`, `categories.ts:66-70`), then re-select. `updateUserSettings(supabase, userId, input: UpdateSettingsRequest): Promise<UserSettings>` — `upsert({ user_id: userId, currency: input.currency }, { onConflict: "user_id" })` (see Critical Implementation Details), returning the updated row.

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly: `npx supabase start` (or `npx supabase db reset` if already running)
- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Unit tests pass: `npm run test:unit`
- Integration tests pass: `npm run test:integration`

#### Manual Verification:

- N/A for this phase (no UI yet) — covered by Phase 2.

---

## Phase 2: API Route & Settings Page

### Overview

Expose the settings service over HTTP and build the real Settings page/form.

### Changes Required:

#### 1. Settings API route

**File**: `src/pages/api/settings.ts` (new)

**Intent**: Read and update the user's currency, following the exact `categories.ts` route template.

**Contract**: `export const prerender = false;` plus the same local `json()` helper. `GET` — 401/500 guards, then `getOrCreateUserSettings(supabase, user.id)`, return `{ settings } satisfies SettingsResponse`. `PUT` — same guards, `updateSettingsSchema.safeParse(body)` (400 with `issues` on failure), `updateUserSettings(supabase, user.id, parsed.data)`, return `{ settings } satisfies SettingsResponse`.

#### 2. Settings page

**File**: `src/pages/settings.astro`

**Intent**: Replace the placeholder with a real fetch-and-render of the currency form, matching the `expenses.astro` → `ExpensesManager` wiring pattern.

**Contract**: Frontmatter calls `getOrCreateUserSettings(supabase, user.id)` (guarded the same way `expenses.astro:10-12` guards its calls) and passes the result as an `initialSettings` prop to a new `SettingsForm` React island (`client:load`), replacing the current static paragraph (`settings.astro:12`).

#### 3. Settings form component

**File**: `src/components/settings/SettingsForm.tsx` (new)

**Intent**: Let the user pick a currency from the fixed list and save it, following `AddCategoryForm.tsx`'s local-state/validate/submit shape.

**Contract**: Props `{ initialSettings: UserSettings }`. A `<select>` listing `CURRENCIES` with human-readable labels (e.g. "US Dollar (USD)", "Polish Złoty (PLN)") seeded from `initialSettings.currency`, a "Save" `Button` that `PUT`s `/api/settings` with `{ currency }`, a one-sentence help text below the dropdown ("Changing currency only affects how amounts are labeled going forward — past amounts are not converted."), and a success indicator (e.g. `<p role="status">Currency updated.</p>`) shown after a successful save, plus a `<p role="alert">` server-error display mirroring `ExpenseFormDialog.tsx`'s `serverError` pattern.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Build succeeds: `npm run build`

#### Manual Verification:

- Visiting `/settings` for the first time shows "US Dollar (USD)" pre-selected (default seeded on first read)
- Changing the currency and clicking Save persists it — reloading `/settings` shows the new selection
- The "no conversion" help text is visible under the dropdown
- A save failure (e.g. server error) shows a visible error message

---

## Phase 3: Currency Threading & Display

### Overview

Extract the shared formatter and thread the user's currency into every place `/expenses` displays an amount.

### Changes Required:

#### 1. Shared currency formatter

**File**: `src/lib/format.ts` (new)

**Intent**: One formatting function, replacing the two duplicated `formatAmount` implementations.

**Contract**: `export function formatAmount(amount: string, currency: Currency): string` using `new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(amount))` — always 2 decimal places regardless of the currency's native convention (see What We're NOT Doing).

#### 2. Expense list & monthly summary use the shared formatter

**Files**: `src/components/expenses/ExpenseList.tsx`, `src/components/expenses/MonthlySummary.tsx`

**Intent**: Replace each file's local `formatAmount` with the shared one, scoped to the user's chosen currency.

**Contract**: Remove the local `formatAmount` (`ExpenseList.tsx:10-11`, `MonthlySummary.tsx:7-9`), import the shared one from `src/lib/format.ts`, add a `currency: Currency` prop to both components' prop interfaces, and pass it through at each call site (`ExpenseList.tsx:27`, `MonthlySummary.tsx:30`).

#### 3. Thread currency from the page down to both components

**Files**: `src/pages/expenses.astro`, `src/components/expenses/ExpensesManager.tsx`

**Intent**: Fetch the user's currency once per page load (matching how `categories`/`expenses`/`summary` are already fetched) and pass it to the two components that display amounts.

**Contract**: `expenses.astro` calls `getOrCreateUserSettings(supabase, user.id)` alongside its existing calls (`expenses.astro:10-12`) and passes `settings.currency` as a new `currency` prop to `ExpensesManager` (`expenses.astro:23-29`). `ExpensesManager` adds `currency: Currency` to its props (`ExpensesManager.tsx:23-28`) and forwards it to `<ExpenseList>` (`ExpensesManager.tsx:157`) and `<MonthlySummary>` (`ExpensesManager.tsx:143`).

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Build succeeds: `npm run build`

#### Manual Verification:

- With the default USD currency, `/expenses` renders identically to before this change (e.g. `$40.00`) — no visual regression
- After changing currency to PLN in Settings and returning to `/expenses`, both the expense list and monthly summary show amounts labeled in PLN, with the same underlying numeric values as before
- Adding a new expense after changing currency shows it correctly labeled in the new currency

---

## Phase 4: Testing

### Overview

Cover the new formatter, the settings service, and extend one existing e2e spec with the currency-change flow and its reconciliation guardrail.

### Changes Required:

#### 1. Unit tests

**File**: `src/lib/format.test.ts` (new)

**Intent**: Lock in that formatting always forces 2 decimal places and renders each supported currency correctly.

**Contract**: Assert `formatAmount("40", "USD")` → `"$40.00"` (matching today's hardcoded output exactly), and cover at least one non-symbol-mapped currency (e.g. `formatAmount("40", "PLN")`) to confirm the forced-2-decimal behavior regardless of currency.

**File**: `src/lib/services/settings.test.ts` (new)

**Intent**: Lock in the currency enum validation.

**Contract**: `updateSettingsSchema` accepts each of the 7 `CURRENCIES` values and rejects an unsupported code.

#### 2. Integration test

**File**: `tests/integration/user-settings.test.ts` (new)

**Intent**: Confirm the get-or-create and update behavior against a real Supabase instance.

**Contract**: `getOrCreateUserSettings` returns `{ currency: "USD" }` on first call for a fresh user and the same value on a second call (idempotent); `updateUserSettings` changes the stored currency and `getOrCreateUserSettings` reflects it afterward.

#### 3. Extend an existing e2e spec

**File**: `tests/e2e/expenses-add-and-summary.spec.ts` (extend)

**Intent**: Prove the end-to-end currency-change flow and the PRD reconciliation guardrail ("the monthly summary total still reconciles with the sum of individual expense amounts in the selected currency") without adding a new spec file.

**Contract**: After the existing test's two-expense/two-category assertions, add: click the "Settings" nav link (`Topbar.astro:30-32`), change currency to a non-USD value, save, navigate to `/expenses`, and assert both `summaryRowFor` and `expenseRowFor` (from `tests/e2e/helpers.ts`) now show the same numeric totals labeled in the new currency — proving the underlying numbers never changed, only the label.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm run test:unit`
- Integration tests pass: `npm run test:integration`
- Full e2e suite passes: `npm run test:e2e`

#### Manual Verification:

- N/A — this phase is test-only.

---

## Testing Strategy

### Unit Tests:

- `formatAmount` for USD (byte-identical to today's output) and at least one other currency, always 2 decimals
- `updateSettingsSchema` accept/reject behavior

### Integration Tests:

- `getOrCreateUserSettings`/`updateUserSettings` round-trip against a real Supabase instance

### Manual Testing Steps:

1. Visit `/settings` for the first time — confirm USD is pre-selected
2. Change currency, save, reload — confirm it persisted
3. Visit `/expenses` — confirm amounts now show in the new currency, same numbers as before
4. Add a new expense — confirm it's labeled in the current currency

## Performance Considerations

None — one additional single-row lookup per `/expenses` page load (same cost class as the existing `listCategories`/`listExpenses`/`getMonthlySummary` calls already made there).

## Migration Notes

Purely additive new table; every existing user gets a `USD` row lazily created on their first Settings or Expenses page load after this ships (via `getOrCreateUserSettings`) — no bulk backfill needed.

## References

- Roadmap slice: `context/foundation/roadmap.md` S-07
- PRD: `context/foundation/prd-v2.md` FR-004, FR-005, US-02
- Seed-on-first-read precedent: `src/lib/services/categories.ts:62-73`
- API route template: `src/pages/api/categories.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Data & Service Layer

#### Automated

- [x] 1.1 Migration applies cleanly
- [x] 1.2 Type checking passes
- [x] 1.3 Linting passes
- [x] 1.4 Unit tests pass
- [x] 1.5 Integration tests pass

### Phase 2: API Route & Settings Page

#### Automated

- [ ] 2.1 Type checking passes
- [ ] 2.2 Linting passes
- [ ] 2.3 Build succeeds

#### Manual

- [ ] 2.4 Visiting `/settings` for the first time shows "US Dollar (USD)" pre-selected
- [ ] 2.5 Changing the currency and clicking Save persists it
- [ ] 2.6 The "no conversion" help text is visible under the dropdown
- [ ] 2.7 A save failure shows a visible error message

### Phase 3: Currency Threading & Display

#### Automated

- [ ] 3.1 Type checking passes
- [ ] 3.2 Linting passes
- [ ] 3.3 Build succeeds

#### Manual

- [ ] 3.4 With the default USD currency, `/expenses` renders identically to before this change
- [ ] 3.5 After changing currency to PLN, both the expense list and monthly summary show amounts labeled in PLN with unchanged underlying values
- [ ] 3.6 Adding a new expense after changing currency shows it correctly labeled

### Phase 4: Testing

#### Automated

- [ ] 4.1 Unit tests pass
- [ ] 4.2 Integration tests pass
- [ ] 4.3 Full e2e suite passes
