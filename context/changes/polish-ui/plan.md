# Polish UI (message-key layer) Implementation Plan

## Overview

Present MyBudget's entire user-facing UI in Polish, with every string served from
a lightweight, typed message-key layer (`src/i18n/`) that both Astro SSR
components and React islands import directly. Switch amount/number formatting to
Polish locale conventions (`pl-PL`), add an `Intl.PluralRules`-backed helper for
the handful of count-bearing strings, and realign the unit + e2e test suite to
the new Polish copy. No language-switcher UI ships — Polish is the only language
(PRD FR-020, roadmap S-11).

## Current State Analysis

- **No i18n layer exists.** There is no `src/i18n/`, no dictionary, no `t()`
  helper. Every user-facing string is hardcoded English inline in components.
- **Strings live across two runtimes.** Astro `.astro` frontmatter/markup (SSR)
  and React `.tsx` islands (`client:load`). Islands receive plain data props from
  Astro (e.g. `dashboard.astro:21` passes `entries`/`currency`) — there is **no
  shared context/provider**, so a directly-imported static module is the natural
  distribution mechanism for both runtimes.
- **English copy confirmed in ground truth**: `src/components/Topbar.astro`
  ("Dashboard / Add Expense / Settings / Sign out / Not signed in / Sign in /
  Sign up"); `src/components/dashboard/DashboardView.tsx` ("No expenses this month
  yet", "This month", "By category", "Add an expense").
- **Client-side validation is inline** in components:
  `src/components/expenses/ExpenseFormDialog.tsx:50-71` (`validate()`) holds
  user-facing strings like "Category is required", "Date cannot be in the future".
- **User-facing API errors are inline strings**: e.g.
  `src/components/settings/SettingsForm.tsx:43` ("Failed to save currency. Please
  try again."). Server-side zod/route messages also surface to the user.
- **Currency labels** are a hardcoded English map:
  `src/components/settings/SettingsForm.tsx:9-17` (`CURRENCY_LABELS`).
- **Number formatting is `en-US`**: `src/lib/format.ts:4` hardcodes
  `Intl.NumberFormat("en-US", …)`, so amounts render `$1,234.56` /
  `PLN 40.00` rather than Polish `1 234,56 zł` / `40,00 PLN`.
- **Layout is `<html lang="en">`**: `src/layouts/Layout.astro:15`.
- **Mixed partial-Polish already exists**: `src/layouts/Layout.astro:26,31`
  ("Uwaga:", "Dokumentacja") for config banners — these should route through the
  dictionary for consistency.
- **Tests assert English copy / `$` formatting.** `src/lib/format.test.ts` asserts
  `formatAmount("40","USD") === "$40.00"`. ~15 e2e specs under `tests/e2e/`
  (plus `tests/e2e/helpers.ts`) locate elements by visible English text
  ("Add Expense", "Dashboard", "Sign out", summary copy, etc.). Integration tests
  under `tests/integration/` hit the DB/API and are largely copy-agnostic.

### Roadmap note to correct

The roadmap's S-11 slice detail (`context/foundation/roadmap.md`) reads
`Status: done`, which is a stale error — the "At a glance" table and Backlog
Handoff both mark S-11 **ready/yes**, and the codebase is entirely English. This
plan treats S-11 as **not done**. Flip the S-11 slice status to `ready` (or
`planned`) when this change lands, and archive it to `## Done` on completion.

## Desired End State

Every screen a signed-in or signed-out user can reach renders in Polish: nav,
buttons, headings, labels, empty states, table/summary copy, auth pages,
client-side validation, user-facing API errors, page `<title>`s, and the config
banner. Amounts render with Polish grouping/decimals (`1 234,56 zł`). Count
strings ("N wydatków") are grammatically correct across Polish plural forms.
`<html lang="pl">`. All strings resolve through `src/i18n/` — grepping `src/` for
translated UI copy finds it only in `src/i18n/pl.ts`, not scattered in
components. `npm run lint`, `npm run build`, unit tests, and the e2e suite all
pass against the Polish copy.

### Key Discoveries:

- Islands get plain props, no shared context — `src/pages/dashboard.astro:21`,
  `src/pages/expenses.astro`, `src/pages/settings.astro`. A static imported dict
  avoids threading translations through props.
- Client validation strings: `src/components/expenses/ExpenseFormDialog.tsx:50-71`.
- Inline API-error strings: `src/components/settings/SettingsForm.tsx:43`; check
  every `.tsx` with a `serverError`/`setServerError` for the same pattern.
- Currency label map: `src/components/settings/SettingsForm.tsx:9-17`.
- Formatting single-point-of-change: `src/lib/format.ts:4`.
- Test copy coupling: `src/lib/format.test.ts`, `tests/e2e/*.spec.ts`,
  `tests/e2e/helpers.ts`.

## What We're NOT Doing

- **No language-switcher UI** and **no second language** — Polish only; the key
  layer merely makes a future language possible (PRD Non-Goal).
- **No runtime locale detection / cookie / Accept-Language** negotiation.
- **No i18n library** (i18next / astro-i18n / paraglide) — hand-rolled typed dict
  per the "static typed dict + `t()`" decision.
- **No currency conversion or currency-symbol feature change** — currency stays
  user-chosen relabel-only (PRD FR-013); only the number *formatting locale*
  changes.
- **No copy rewrite/UX redesign** — this is translation of existing copy, not new
  wording or new screens.
- **No translation of developer-only artifacts** — code comments, log lines,
  test-internal identifiers, commit messages, `context/**` docs stay as-is.

## Implementation Approach

Build the foundation first (dictionary + helpers + formatting), then migrate
surfaces runtime-by-runtime (SSR pages, then React islands), then the
server/API error strings, then realign tests last so cross-flow e2e specs go
green once all copy is translated. Each phase is independently lintable/buildable;
unit tests co-located with a phase's code update within that phase, while the
cross-cutting e2e alignment is the dedicated final phase.

The dictionary is a single Polish object with **feature-namespaced keys**
(`nav.dashboard`, `dashboard.emptyState`, `expense.form.amountLabel`,
`errors.currencySaveFailed`, …). `t()` is a thin typed accessor over that object
(dot-path or nested access) so a missing/renamed key is a **compile-time** error,
not a silent English fallback. `plural(count, key)` selects among Polish
`one/few/many/other` forms via `Intl.PluralRules("pl")`.

## Critical Implementation Details

- **`pl-PL` formatting ripples into assertions.** Switching `format.ts` to
  `pl-PL` changes rendered amounts (`$40.00` → `40,00 USD`; note the space is a
  narrow/non-breaking space `U+00A0`, not an ASCII space — string assertions and
  e2e text matches must account for this). Every amount assertion in
  `format.test.ts` and any e2e spec that matches on `$`/`.`-formatted money must
  update in the same change. Prefer asserting via a normalized helper or
  role/label locators over brittle exact-money substrings where practical.
- **Polish plural forms are four-way.** `Intl.PluralRules("pl")` returns
  `one` (1), `few` (2–4, excluding teens), `many` (0, 5+, teens), `other`
  (fractions). Count keys must supply all needed variants; do not hardcode a
  single form.

## Phase 1: Message-layer foundation

### Overview

Create the dictionary, the typed `t()` accessor, the `plural()` helper, switch
number formatting to `pl-PL`, set `<html lang="pl">`, and prove it with unit
tests. No visible surface is migrated yet beyond `<html lang>`, so the app still
shows English copy after this phase — but the machinery every later phase depends
on exists and is tested.

### Changes Required:

#### 1. Message dictionary

**File**: `src/i18n/pl.ts` (new)

**Intent**: Hold all Polish UI strings as a single typed, feature-namespaced
object — the one place translated copy lives.

**Contract**: Exports a `const messages` object (readonly) whose shape is the
canonical key namespace (`nav`, `common`, `dashboard`, `expense`, `category`,
`settings`, `auth`, `errors`, `banner`, `meta`). Export the inferred type
(`type Messages = typeof messages`) for the accessor. Start with only the keys
Phase 1 needs plus placeholders filled in as later phases migrate surfaces —
adding keys is additive.

#### 2. Typed accessor + plural helper

**File**: `src/i18n/index.ts` (new)

**Intent**: Provide `t()` for static lookups and `plural()` for count-bearing
strings, both usable identically from `.astro` frontmatter and `.tsx`.

**Contract**: `t(key)` resolves a key against `messages` with compile-time key
safety (invalid key → TS error) and supports simple `{placeholder}`
interpolation for the few parametrized strings. `plural(count, variants)` selects
a Polish form via `Intl.PluralRules("pl")` from a `{ one, few, many, other }`
variant map and interpolates the count. No silent English fallback.

#### 3. Polish number/amount formatting

**File**: `src/lib/format.ts`

**Intent**: Render amounts with Polish grouping/decimals while keeping the
user-chosen currency code (relabel-only).

**Contract**: `formatAmount(amount, currency)` switches the locale argument from
`"en-US"` to `"pl-PL"`; signature unchanged. Output convention becomes
`40,00 USD` / `1 234,56 PLN` (non-breaking-space grouping).

#### 4. Document lang + title plumbing

**File**: `src/layouts/Layout.astro`

**Intent**: Mark the document as Polish; leave the title-key wiring for Phase 2
but flip the lang attribute now (cheap, correct, and lets a11y checks pass early).

**Contract**: `<html lang="en">` → `<html lang="pl">`. Default `title` prop value
is migrated to a dict key in Phase 2.

#### 5. Formatting + helper unit tests

**File**: `src/lib/format.test.ts` (update); `src/i18n/index.test.ts` (new)

**Intent**: Lock the new `pl-PL` output and prove `t()`/`plural()` behavior.

**Contract**: Update `format.test.ts` expectations to the `pl-PL` strings
(mind the `U+00A0` grouping space). New `i18n` test covers: `t()` returns the
Polish string for a known key and interpolates a placeholder; `plural()` returns
the correct form for representative counts (1 → one, 3 → few, 5 → many).

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run build` (astro check / tsc)
- Linting passes: `npm run lint`
- Unit tests pass: `npm run test` (format + i18n specs green)

#### Manual Verification:

- `document.documentElement.lang === "pl"` in the running app.
- An amount renders as `40,00 …` (comma decimal) somewhere it is already shown.

**Implementation Note**: After completing this phase and all automated
verification passes, pause here for manual confirmation before proceeding.

---

## Phase 2: Astro (SSR) surfaces

### Overview

Migrate every server-rendered string to the dictionary: navigation, layout
titles/meta, the config banner, and all `.astro` pages.

### Changes Required:

#### 1. Navigation

**File**: `src/components/Topbar.astro`

**Intent**: Replace hardcoded nav/auth-state copy with dict keys.

**Contract**: "Dashboard", "Add Expense", "Settings", "Sign out", "Not signed
in", "Sign in", "Sign up" → `t("nav.*")` / `t("auth.*")`. Links/hrefs unchanged.

#### 2. Layout titles, meta, and config banner

**File**: `src/layouts/Layout.astro`, `src/components/Banner.astro`

**Intent**: Route the default page title and the config-banner copy
("Uwaga:", "Dokumentacja", `cfg.message`) through the dictionary.

**Contract**: Default `title` prop and banner literals resolve via `t("meta.*")`
/ `t("banner.*")`. Per-page titles come from each page (below).

#### 3. Pages

**File**: `src/pages/dashboard.astro`, `src/pages/expenses.astro`,
`src/pages/settings.astro`, `src/pages/index.astro`,
`src/pages/auth/signin.astro`, `src/pages/auth/signup.astro`,
`src/pages/auth/confirm-email.astro`, and `src/components/Welcome.astro` if it
carries user-facing copy.

**Intent**: Replace inline headings/labels/prose and the `<Layout title=…>` value
on each page with dict keys.

**Contract**: Each page passes `title={t("meta.<page>Title")}` and renders body
copy via `t(...)`. No structural/markup changes beyond string substitution.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run build`
- Linting passes: `npm run lint`
- Grep check: no remaining English UI literals in `src/pages/**` or
  `src/components/*.astro` (spot-check for stray strings)

#### Manual Verification:

- Nav, page titles (browser tab), and landing/auth pages render in Polish.
- Config banner (when a config is missing) renders Polish copy.

**Implementation Note**: Pause for manual confirmation before proceeding.

---

## Phase 3: React island surfaces

### Overview

Migrate all `.tsx` island copy — dashboard, expenses, categories, settings, auth
forms — including client-side validation strings and pluralized counts.

### Changes Required:

#### 1. Dashboard islands

**File**: `src/components/dashboard/DashboardView.tsx`,
`src/components/dashboard/MonthlySummary.tsx`,
`src/components/dashboard/SpendingDonut.tsx`

**Intent**: Replace "This month", "By category", "No expenses this month yet",
"Add an expense" and any chart/summary labels with dict keys; use `plural()` for
any count-bearing copy.

**Contract**: `t("dashboard.*")`; count strings via `plural(count, …)`.

#### 2. Expenses islands

**File**: `src/components/expenses/ExpensesManager.tsx`,
`src/components/expenses/ExpenseList.tsx`,
`src/components/expenses/ExpenseFormDialog.tsx`

**Intent**: Migrate list/empty-state copy, dialog titles/labels/placeholders/
buttons, and the **client-side validation messages** in `validate()`.

**Contract**: Labels/buttons → `t("expense.*")` / `t("common.*")`; validation
strings ("Category is required", "Name must be at most 100 characters", "Enter a
positive amount…", "Date cannot be in the future") → `t("expense.validation.*")`.
Submit/loading ("Saving…", "Add expense", "Save changes") → `t("common.*")`.

#### 3. Categories islands

**File**: `src/components/categories/CategoriesManager.tsx`,
`src/components/categories/CategoryList.tsx`,
`src/components/categories/CategoryFormDialog.tsx`,
`src/components/categories/DuplicateCategoryAlert.tsx`

**Intent**: Migrate management UI copy, dialog copy, and the duplicate-category
alert message.

**Contract**: `t("category.*")`; validation/alert strings →
`t("category.validation.*")` / `t("errors.*")`.

#### 4. Settings & auth islands

**File**: `src/components/settings/SettingsForm.tsx`, and
`src/components/auth/{SignInForm,SignUpForm,FormField,PasswordToggle,ServerError,SubmitButton}.tsx`

**Intent**: Migrate the currency label map, settings copy/status/errors, and all
auth-form labels/placeholders/buttons/inline messages.

**Contract**: `CURRENCY_LABELS` values → `t("settings.currency.*")` (or a keyed
map); "Currency updated.", "Save", "Saving…", currency-note prose →
`t("settings.*")`. Auth form field labels/buttons/toggles → `t("auth.*")`.
Server-error *display* stays; the message text is addressed in Phase 4.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run build`
- Linting passes: `npm run lint`
- Unit tests pass: `npm run test` (component-adjacent unit tests updated for
  Polish copy where they assert it)

#### Manual Verification:

- Dashboard, expenses (list + add/edit dialog), categories, settings, and auth
  forms render entirely in Polish.
- Triggering a client-side validation error (empty amount, future date) shows a
  Polish message.
- A pluralized count string is grammatically correct at counts 1, 3, and 5.

**Implementation Note**: Pause for manual confirmation before proceeding.

---

## Phase 4: Server & API user-facing messages

### Overview

Route the error/validation strings produced by API routes and services that reach
the user through the dictionary, so a Polish UI never surfaces an English error.

### Changes Required:

#### 1. API route + service messages

**File**: API routes under `src/pages/api/**` (`expenses.ts`, `expenses/[id].ts`,
`expenses/summary.ts`, `categories.ts`, `categories/[id].ts`, `settings.ts`,
`auth/{signin,signup,signout}.ts`) and services under `src/lib/services/**`.

**Intent**: Replace user-facing error strings (zod `message`, thrown/returned
error text rendered by the client) with dict keys. Leave developer-only log lines
and internal error codes in English.

**Contract**: Only strings that are **displayed to the user** move to
`t("errors.*")`. Where an API returns a machine code that the client maps to copy,
prefer the client mapping to a dict key over translating the server literal.
Distinguish: zod validation messages shown inline → translate; internal
5xx/log text → leave.

#### 2. Client consumption of server errors

**File**: the `.tsx` components that render `serverError` (e.g.
`SettingsForm.tsx:43`, expense/category managers).

**Intent**: Ensure the client shows a Polish string — either from the translated
server payload or by mapping a returned code to `t("errors.*")`.

**Contract**: `setServerError("Failed to save currency…")` →
`setServerError(t("errors.currencySaveFailed"))` (or code-mapped equivalent).

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run build`
- Linting passes: `npm run lint`
- Unit/integration tests pass: `npm run test` (integration specs are copy-agnostic;
  confirm none assert on a now-translated user-facing error literal)

#### Manual Verification:

- Forcing a save failure / invalid submission surfaces a Polish error message.
- No English error string appears in any user-facing failure path.

**Implementation Note**: Pause for manual confirmation before proceeding.

---

## Phase 5: Test alignment

### Overview

Realign the unit + e2e suite to the Polish copy and `pl-PL` formatting, so
cross-flow specs (which only go green once all copy is translated) pass. Reference
the dictionary / role-based locators rather than duplicating Polish literals where
practical.

### Changes Required:

#### 1. e2e specs and helpers

**File**: `tests/e2e/*.spec.ts` (auth, categories, expenses, nav-reachability,
landing-auth-redirect, drilldown, seed) and `tests/e2e/helpers.ts`.

**Intent**: Update locators/assertions that match English UI copy to the Polish
copy; prefer `getByRole`/`getByLabel` and dictionary-referenced text over
hardcoded literals, per project E2E rules (CLAUDE.md).

**Contract**: Text-based locators ("Add Expense", "Dashboard", "Sign out", summary
copy, error copy) → Polish equivalents sourced from `src/i18n/pl.ts` where the
test setup allows importing it, else role/label locators. Amount assertions
updated for `pl-PL` (non-breaking-space grouping, comma decimal). No
`page.waitForTimeout`; keep state-based waits.

#### 2. Residual unit assertions

**File**: any remaining `src/**/*.test.ts(x)` asserting English copy not already
updated in Phases 1–4.

**Intent**: Catch stragglers so the whole suite is green.

**Contract**: Assertions reference the dict or Polish copy consistently.

### Success Criteria:

#### Automated Verification:

- Full unit suite passes: `npm run test`
- e2e suite passes: `npm run test:e2e`
- Linting passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- A full manual pass of the app confirms no English UI copy remains on any
  reachable screen.
- e2e run is stable across two consecutive runs (no copy-coupling flakiness).

**Implementation Note**: Final phase — after green, update the roadmap S-11 status
and archive the change.

---

## Testing Strategy

### Unit Tests:

- `format.ts`: `pl-PL` output for representative amounts/currencies, 2-decimal
  invariant preserved, non-breaking-space grouping.
- `i18n`: `t()` key resolution + interpolation; `plural()` Polish forms at counts
  1/3/5 (and 0/teens if used).

### Integration Tests:

- `tests/integration/**` are DB/API behavior tests and should remain green
  unchanged; verify none assert on a translated user-facing message.

### Manual Testing Steps:

1. Sign out → landing + auth pages render Polish; `<html lang="pl">`.
2. Sign in → nav, dashboard (empty and with data), amounts in `1 234,56 zł` form.
3. Add expense via dialog: labels/buttons Polish; trigger validation errors →
   Polish messages; pluralized count reads correctly.
4. Categories + settings screens Polish; force a save error → Polish error copy.
5. Browser tab titles Polish on each page.

## Performance Considerations

Negligible. The dictionary is a static module tree-shaken/bundled into both the
SSR output and island bundles; `Intl.PluralRules`/`Intl.NumberFormat` are native.
No network, no runtime negotiation.

## Migration Notes

No data migration. This is presentation-layer only; no schema, RLS, or API
contract changes (API error *copy* may change, but not shapes/status codes).

## References

- Roadmap slice: `context/foundation/roadmap.md` (S-11; correct its stale
  `Status: done` to `ready`/archived).
- PRD: `context/foundation/prd.md` FR-020.
- Formatting single point: `src/lib/format.ts:4`.
- Two-runtime distribution: `src/pages/dashboard.astro:21` (island props).
- E2E rules: `CLAUDE.md` (§ 10xDevs E2E) + `/10x-e2e` skill.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Message-layer foundation

#### Automated

- [x] 1.1 Type checking passes: `npm run build`
- [x] 1.2 Linting passes: `npm run lint`
- [x] 1.3 Unit tests pass: `npm run test` (format + i18n specs green)

#### Manual

- [ ] 1.4 `document.documentElement.lang === "pl"` in the running app
- [ ] 1.5 An amount renders with comma decimal (`40,00 …`)

### Phase 2: Astro (SSR) surfaces

#### Automated

- [ ] 2.1 Type checking passes: `npm run build`
- [ ] 2.2 Linting passes: `npm run lint`
- [ ] 2.3 Grep check: no remaining English UI literals in `src/pages/**` / `src/components/*.astro`

#### Manual

- [ ] 2.4 Nav, page titles, landing/auth pages render in Polish
- [ ] 2.5 Config banner renders Polish copy

### Phase 3: React island surfaces

#### Automated

- [ ] 3.1 Type checking passes: `npm run build`
- [ ] 3.2 Linting passes: `npm run lint`
- [ ] 3.3 Unit tests pass: `npm run test`

#### Manual

- [ ] 3.4 Dashboard, expenses, categories, settings, auth forms render in Polish
- [ ] 3.5 Client-side validation errors show Polish messages
- [ ] 3.6 A pluralized count is grammatically correct at counts 1, 3, 5

### Phase 4: Server & API user-facing messages

#### Automated

- [ ] 4.1 Type checking passes: `npm run build`
- [ ] 4.2 Linting passes: `npm run lint`
- [ ] 4.3 Unit/integration tests pass: `npm run test`

#### Manual

- [ ] 4.4 Forcing a save failure surfaces a Polish error message
- [ ] 4.5 No English error string appears in any user-facing failure path

### Phase 5: Test alignment

#### Automated

- [ ] 5.1 Full unit suite passes: `npm run test`
- [ ] 5.2 e2e suite passes: `npm run test:e2e`
- [ ] 5.3 Linting passes: `npm run lint`
- [ ] 5.4 Build passes: `npm run build`

#### Manual

- [ ] 5.5 Full manual pass confirms no English UI copy remains on any reachable screen
- [ ] 5.6 e2e run is stable across two consecutive runs
