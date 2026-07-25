---
date: 2026-07-23T19:36:06+02:00
researcher: Claude Code
git_commit: fd8486ed110b3bf21ec7a838d555d2e968ca19f3
branch: develop
repository: my-budget
topic: "Phase 2 of test-plan.md (Risks #3-#4: expense date/month attribution + category attribution) against shipped code"
tags: [research, codebase, testing, expenses, date-attribution, category-attribution, playwright, timezone]
status: complete
last_updated: 2026-07-23
last_updated_by: Claude Code
---

# Research: Phase 2 — Expense date/month & category attribution correctness

**Date**: 2026-07-23T19:36:06+02:00
**Researcher**: Claude Code
**Git Commit**: fd8486ed110b3bf21ec7a838d555d2e968ca19f3
**Branch**: develop
**Repository**: my-budget

## Research Question

`context/foundation/test-plan.md` §3 Phase 2 ("Expense attribution correctness") targets Risk #3
(a backdated expense is attributed to the wrong month) and Risk #4 (an expense is saved under
the wrong category). How are month-attribution and category-attribution implemented today, what
does the existing Playwright suite already cover, and what test gap genuinely remains before this
phase can be planned?

## Summary

**The scope is narrower than test-plan.md currently states.** Both risks already have targeted,
non-trivial e2e coverage that the test-plan and Phase 1 documents don't know about:

- `tests/e2e/expenses-backdated-attribution.spec.ts` (Risk #3) and
  `tests/e2e/expenses-add-and-summary.spec.ts` (Risk #4) already exist, are already correct, and
  both carry header comments explicitly citing test-plan.md's risk numbers. Phase 1's own
  `plan.md` explicitly scoped these risks *out* as "separate rollout phases" — but the specs
  shipped anyway, apparently as part of the original feature build
  (`context/changes/log-and-summarize-expenses/`), not as dedicated test-rollout work.
- Test-plan.md §3 still lists Phase 2 as `not started` and cites "9 Playwright specs" (a count
  that predates both `seed.spec.ts` and `expenses-backdated-attribution.spec.ts` — actual count is
  **11**). This is stale bookkeeping, not a real gap, and should be corrected before/alongside
  planning Phase 2.

**What's real, un-covered gap** (this is what Phase 2 should actually plan against):

1. **Risk #3**: no test — unit, integration, or e2e — exercises a local-midnight/timezone
   day-boundary scenario, a future-dated expense, or confirms a backdated expense is *correctly
   included* in its own past month's summary (only proven *excluded* from the current month).
   The app has **no explicit timezone handling anywhere** — every "today" computation (client
   form, server zod schema, DB check constraint) implicitly assumes UTC, and the DB check
   constraint's correctness depends on an unenforced, one-time-manually-verified assumption that
   the Postgres session timezone is UTC.
2. **Risk #4**: no test at any layer exercises the two rejection paths that are already
   implemented and shipped — a missing/empty `categoryId` (400, caught by zod) and a
   syntactically-valid-but-foreign/nonexistent `categoryId` (409 `CategoryOwnershipError`, caught
   by a composite DB foreign key). The happy-path (2 distinct categories, correct persistence, no
   cross-bleed) is already solidly covered.

## Detailed Findings

### Risk #3 — Date/month attribution

- **Schema**: `expenses.date` is a plain Postgres `date` (`supabase/migrations/20260722090000_create_expenses.sql:8`) — no time-of-day or timezone component ever reaches storage. A check constraint (`date <= current_date`, same line) evaluates against the Postgres session's timezone-dependent `current_date`.
- **Month derivation is single-sourced, DB-side**: the `monthly_category_summary` view (`supabase/migrations/20260722090000_create_expenses.sql:29-37`) computes `date_trunc('month', e.date)::date as month` — this is the *only* place an expense's date is turned into a month. App code (`src/lib/services/expenses.ts:187-201`, `getMonthlySummary`) only computes *which month to query for* (via `getUTCFullYear`/`getUTCMonth`), never re-derives an individual expense's month. This single-source design is deliberate and documented (`context/changes/log-and-summarize-expenses/research.md:34,57`).
- **No explicit timezone handling anywhere.** Confirmed absent from `astro.config.mjs`/`wrangler.jsonc` (Cloudflare Workers are UTC-only by platform design, no override possible). The client form's `todayIsoDate()` (`src/components/expenses/ExpenseFormDialog.tsx:18-20`) and the server zod schema's identical helper (`src/lib/services/expenses.ts:8-10`) both use `new Date().toISOString().slice(0,10)` — UTC calendar date, not the browser's or server's local date. Three independent "is this date in the future" checks (client `validate()`, server zod `.refine`, DB `check (date <= current_date)`) all anchor to this same UTC notion of "today," none to a real local timezone.
- **The DB check constraint's safety depends on an unenforced assumption**: `context/changes/log-and-summarize-expenses/plan.md:126` documents "Assumes the Supabase project's Postgres session timezone is UTC (verified manually in Phase 1); if it isn't, the `date <= current_date` check constraint and the app's 'today' could disagree" — a one-time manual checkbox (`plan.md:425`), not an automated assertion.
- **Existing e2e coverage**: `tests/e2e/expenses-backdated-attribution.spec.ts:1` (header comment ties it directly to test-plan.md Risk #3). It adds a today-dated Housing expense and a Housing expense backdated 2 months (`isoDateMonthsAgo`, UTC-based), and asserts the *current* month's Housing total stays at the today-dated amount only. It does **not** test: a day-of-month boundary (1st/last day of a month), a non-UTC local timezone via Playwright's `timezoneId` context option, a future-dated expense, whether the backdated expense is *correctly included* in its own past month (only proven excluded from the current month), or the combination of backdating with 2+ categories.
- **Existing unit coverage**: `src/lib/services/expenses.test.ts:90-107` tests the zod `dateSchema` (accepts today/past, rejects future) but never exercises `date_trunc` or a simulated local-midnight scenario — everything is asserted against `new Date().toISOString()` (UTC).

### Risk #4 — Category attribution

- **Validation**: `createExpenseSchema` (`src/lib/services/expenses.ts:28-34`) requires `categoryId: z.uuid()` — no default, no optional. Missing or empty string fails zod → API returns `400 { error: "Invalid input", issues }` (`src/pages/api/expenses.ts:43-47`). No silent fallback to a default category exists anywhere in this path.
- **Foreign/nonexistent category**: a syntactically valid but wrong-owner or nonexistent UUID passes zod, then fails at the DB layer via a **composite** FK — `expenses_user_category_fk foreign key (user_id, category_id) references public.categories (user_id, id)` (`supabase/migrations/20260722090000_create_expenses.sql:10`) — which structurally prevents attaching an expense to another user's category (not just a plain `category_id → categories.id` FK). The service layer maps the resulting Postgres `23503` error to `CategoryOwnershipError` (`src/pages/api/expenses.ts:94-104`), and the route returns `409` (`expenses.ts:56-57`).
- **Full form→API→DB→display path** traced and consistent: `ExpenseFormDialog.tsx` sends the selected category's UUID (not its label) → `ExpensesManager.tsx:81-107` POSTs it verbatim → `createExpense` inserts it → the read-side query joins back through the same FK (`categories!expenses_user_category_fk(name)`, `expenses.ts:73`) so what's displayed after creation (`ExpenseList.tsx:27-30`) is the server-resolved category name, making any persistence-layer swap observable.
- **Existing e2e coverage is already solid for the happy path**: `tests/e2e/expenses-add-and-summary.spec.ts` (header comment ties it to Risk #4) creates one Groceries and one Transport expense, asserts each expense row and each summary row shows its own category with no cross-bleed, and asserts largest-first ranking — exactly the "≥2 distinct categories" bar test-plan.md's own risk-response table calls for.
- **The actual gap**: zero coverage — unit, integration, or e2e — for (a) submitting with a missing/empty `categoryId` (the 400/zod path) or (b) submitting a well-formed but foreign/nonexistent `categoryId` (the 409/`CategoryOwnershipError` path). Both behaviors are fully implemented and shipped; neither has ever been exercised by a test.

### Existing Playwright infrastructure relevant to Phase 2

- **11 specs exist today**, not the "9" cited in `context/changes/testing-data-isolation-summary/research.md:28,85-87` and `plan.md:17,41` — those documents predate `seed.spec.ts` (an intentional exemplar, likely deliberately excluded from their count) and, more importantly, `expenses-backdated-attribution.spec.ts`, which isn't mentioned in either Phase 1 document at all. **This is stale-count drift that should be corrected in test-plan.md alongside Phase 2 planning**, not a Phase 2 deliverable itself.
- **No dedicated expense-creation test helper exists.** `tests/e2e/helpers.ts` has `signUpAndSignIn(page, email, password)` (no date/category params), `openAddExpenseDialog`, and locator helpers (`summaryRowFor`, `expenseRowFor`) — but every spec repeats the open-dialog → select-category → fill-amount → fill-date → submit sequence inline. A caller *can* pass an arbitrary date or category (both confirmed working via `.fill()`/`.selectOption()` in existing specs) but only by duplicating that boilerplate. Worth considering as a Phase 2 refactor if new specs would otherwise triple this duplication — not a correctness gap, a maintenance one.
- **Category seeding is lazy** (8 defaults seeded on a fresh user's first read, `src/lib/services/categories.ts: listCategories`) — no test-side seeding step exists or is needed; this pattern already supports "≥2 distinct categories" tests without extra setup.
- `playwright.config.ts` has no `globalSetup`/`globalTeardown`; `webServer` runs `npm run dev:e2e` against a dedicated E2E Supabase project (`.dev.vars.e2e`, anon key only) — same infra Phase 1's integration tests and all existing e2e specs already use. Playwright's `timezoneId`/`geolocation` context options are available but currently unused anywhere in the suite — the mechanism needed to actually simulate a non-UTC local timezone for a Risk #3 boundary test.

## Code References

- `supabase/migrations/20260722090000_create_expenses.sql:8` — `expenses.date` column type + future-date check constraint
- `supabase/migrations/20260722090000_create_expenses.sql:10` — composite FK `expenses_user_category_fk (user_id, category_id) → categories(user_id, id)`
- `supabase/migrations/20260722090000_create_expenses.sql:29-37` — `monthly_category_summary` view, `date_trunc('month', ...)`
- `src/lib/services/expenses.ts:8-10` — server-side `todayIsoDate()` (UTC-based)
- `src/lib/services/expenses.ts:28-34` — `createExpenseSchema` (`categoryId: z.uuid()`)
- `src/lib/services/expenses.ts:94-104` — `mapWriteError` → `CategoryOwnershipError` on FK violation (`23503`)
- `src/lib/services/expenses.ts:187-201` — `getMonthlySummary`, UTC-based current-month query filter
- `src/pages/api/expenses.ts:33-61` — expense-create `POST` handler, error-status mapping
- `src/components/expenses/ExpenseFormDialog.tsx:18-20,45,60,101-115,141-146` — date/category form fields, client-side `todayIsoDate()` and required-category validation
- `src/components/expenses/ExpensesManager.tsx:81-107` — `handleFormSubmit`, POST/PATCH wiring, error surfacing
- `src/components/expenses/ExpenseList.tsx:27-30` — server-resolved `categoryName` displayed post-creation
- `tests/e2e/expenses-backdated-attribution.spec.ts:1-43` — existing Risk #3 e2e coverage (partial)
- `tests/e2e/expenses-add-and-summary.spec.ts:1-45` — existing Risk #4 e2e coverage (happy path only)
- `tests/e2e/helpers.ts:64-80,90-121` — `signUpAndSignIn` and locator helpers, no expense-creation helper
- `src/lib/services/expenses.test.ts:57-108` — unit coverage for `createExpenseSchema`, single hardcoded category id throughout
- `playwright.config.ts:1-24` — no `globalSetup`, `webServer` against `.dev.vars.e2e`

## Architecture Insights

- Month attribution follows a strict single-source-of-truth pattern (DB-side `date_trunc`, never re-derived in app code) — this is a deliberate, documented convention from the original feature build, not incidental. Any new test for Risk #3 should validate the view/DB behavior directly (integration layer) rather than adding an app-level "date logic" unit test, since there is no app-level date-to-month logic to unit test.
- Category ownership is enforced structurally via a composite FK rather than an app-level ownership check — consistent with Phase 1's finding that this codebase favors DB-level guarantees (RLS, FK constraints) over app-level authorization logic wherever possible.
- The codebase has exactly one implicit timezone assumption (UTC, everywhere) with exactly one unenforced manual-verification checkbox backing it (Postgres session timezone) — this is the load-bearing fact behind Risk #3's remaining exposure, not a missing feature.

## Historical Context (from prior changes)

- `context/changes/log-and-summarize-expenses/research.md:34,57` — establishes the single-source-of-truth month-attribution design this research confirms is still intact.
- `context/changes/log-and-summarize-expenses/plan.md:126,425` — documents the UTC-session-timezone assumption as a one-time manual verification, not an automated gate; still true today.
- `context/changes/testing-data-isolation-summary/research.md:28,85-87` and `plan.md:17,41,80-83,94-97` — Phase 1's own plan explicitly scoped Risks #3/#4 e2e work out as "separate rollout phases," and cited a "9 spec" count that is now stale (11 specs exist, including one — `expenses-backdated-attribution.spec.ts` — squarely inside Risk #3's scope that neither Phase 1 document mentions).

## Related Research

- `context/changes/testing-data-isolation-summary/research.md` — Phase 1 (Risks #1-#2) research; establishes RLS/FK conventions this research builds on.
- `context/changes/log-and-summarize-expenses/research.md` and `plan.md` — original feature build; source of the date/month single-source-of-truth design and the two e2e specs this research found already cover parts of Phase 2's nominal scope.

## Open Questions — resolved (2026-07-23, user decision)

- ~~Should test-plan.md's Phase 2 row and the "9 Playwright specs" count in §4 be corrected as part of this change, or handled as a standalone `--refresh`?~~ **Resolved**: the stray `context/changes/test-plan-refresh-2026-07-23/` folder was manually cleaned up (was empty/interrupted). `test-plan.md` §4 spec count corrected to 11 and Phase 2 status/change-folder updated directly, as part of this change.
- ~~Is a Playwright `timezoneId` context-option test worth the cost?~~ **Resolved: no.** Do not add a timezone-boundary test. The app has zero timezone-differentiating logic (everything anchors to UTC `todayIsoDate()`), so a browser-level timezone simulation would not exercise any code path that could actually diverge — it would only prove Playwright's `timezoneId` works, not catch a real regression. The one real assumption behind Risk #3 (Postgres session timezone = UTC) remains a documented, manually-verified-once fact (`context/changes/log-and-summarize-expenses/plan.md:126,425`), not something Phase 2 needs to re-test.
- ~~Should the missing/foreign-`categoryId` rejection paths be tested at integration or e2e layer?~~ **Resolved: integration (cheaper).** Both rejection paths (400 missing/empty `categoryId` via zod, 409 `CategoryOwnershipError` via the composite FK) are backend-contract behavior with no UI-observable branching beyond a generic error message already covered by other specs — call `createExpense`/the API route directly against the real E2E Supabase project (same pattern Phase 1 established in `tests/integration/`), not through the browser.

**Net effect on Phase 2 scope**: with the timezone-boundary test dropped, Risk #3's remaining test-worthy gap narrows to just confirming a backdated expense is correctly *included* in its own past month's summary (the existing e2e spec only proves exclusion from the current month) — likely a small extension to the existing `expenses-backdated-attribution.spec.ts` rather than a new spec. Risk #4's gap is the two integration-level rejection tests described above. Both are now well-scoped for `/10x-plan`.
