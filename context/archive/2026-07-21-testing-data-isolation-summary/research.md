---
date: 2026-07-23T00:00:00+02:00
researcher: Claude Code
git_commit: 91d42833d0a2fcee3f85d3337646d13196fb255b
branch: develop
repository: my-budget
topic: "Re-grounding Phase 1 of test-plan.md (Risks #1-#2: cross-user isolation + monthly-summary reconciliation) against shipped code"
tags: [research, codebase, testing, rls, isolation, summary, vitest, playwright, supabase]
status: complete
last_updated: 2026-07-23
last_updated_by: Claude Code
---

# Research: Re-grounding Phase 1 (cross-user isolation + summary reconciliation) against shipped code

**Date**: 2026-07-23T00:00:00+02:00
**Researcher**: Claude Code
**Git Commit**: 91d42833d0a2fcee3f85d3337646d13196fb255b
**Branch**: develop
**Repository**: my-budget

## Research Question

The 2026-07-21 research.md for this change concluded categories/expenses schema, RLS, and aggregation logic did not exist. Since then, `expense-categories` and `log-and-summarize-expenses` have both shipped. Re-ground Risks #1 (IDOR/RLS gap) and #2 (summary reconciliation) from `context/foundation/test-plan.md` against the current codebase: quote the real failure path, verify or correct the response guidance, state exactly what's tested vs. missing, and name the cheapest useful layer for the remaining gap.

## Summary

**The prior research.md is fully superseded — everything it called "doesn't exist yet" now exists in code.** Categories and expenses tables, RLS policies, a DB-level summary view, a Vitest unit suite, and 9 Playwright specs have all shipped.

- **Risk #1 (IDOR/RLS)**: RLS policies exist and are correctly scoped (`auth.uid() = user_id` on every policy). No service-role key exists anywhere in the codebase — one client factory, anon key only. Every API route derives the acting user from the session, never from client input, which is good defense-in-depth but also means **the app's own routes can never be used to exercise a genuine RLS gap** — a real IDOR proof requires bypassing the app entirely. **Zero automated test does this today.** Test-plan.md's response guidance for Risk #1 is CONFIRMED as written; no correction needed, only grounding.

- **Risk #2 (summary reconciliation)**: The response guidance's premise is **half wrong and needs correcting**: the actual SUM aggregation is not application code that can be unit-tested — it runs as `sum(e.amount) ... group by` inside a Postgres view (`monthly_category_summary`). What *is* app code (`mergeCategoriesWithTotals`, the ranking/merge step) is already unit-tested with independently-typed expected values, closing the oracle problem for that piece. More importantly, **`tests/e2e/expenses-delete-updates-summary.spec.ts` already inserts two raw expenses into the same category and asserts the DB-computed sum equals an independently hand-computed literal ($30.00 + $45.00 = $75.00)** — this is a real, oracle-free proof that the SQL-level SUM reconciles across multiple entries. The gap the test-plan worried about (multi-entry oracle problem) is **already closed**, cheaply, at the e2e layer. The genuinely remaining gap is narrower: no test proves the summary view/query excludes **another user's** expenses from the total — a cross-user leak in the aggregation path specifically, which is really a Risk #1-shaped gap wearing a Risk #2 label.

- Both remaining gaps close via the **same missing test infrastructure**: there is no integration-test layer in this repo today. Vitest (`vitest.config.ts:6`) only runs pure-function unit tests (`src/**/*.test.ts`, no I/O). Playwright only ever exercises the UI as a single authenticated user. Nothing signs in as two real, distinct users and queries Supabase directly. Building that (once) closes both risks' remaining gaps.

## Detailed Findings

### Risk #1 — RLS is real, scoped correctly, and has zero automated proof

**RLS policies, quoted:**

`supabase/migrations/20260721120000_create_categories.sql:9-17`:
```sql
alter table public.categories enable row level security;

create policy "categories_select_own" on public.categories
  for select to authenticated
  using (auth.uid() = user_id);

create policy "categories_insert_own" on public.categories
  for insert to authenticated
  with check (auth.uid() = user_id);
```
Only `select`/`insert` policies exist for categories — no `update`/`delete` policy. This is currently consistent with the app: there is no category-edit or category-delete route/UI (`src/pages/api/categories.ts` only exports `GET`/`POST`). If a category edit/delete feature ships later, RLS policies must be added at that time — flagging as a forward note, not a current gap.

`supabase/migrations/20260722090000_create_expenses.sql:13-25`:
```sql
alter table public.expenses enable row level security;

create policy "expenses_select_own" on public.expenses
  for select to authenticated using (auth.uid() = user_id);

create policy "expenses_insert_own" on public.expenses
  for insert to authenticated with check (auth.uid() = user_id);

create policy "expenses_update_own" on public.expenses
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "expenses_delete_own" on public.expenses
  for delete to authenticated using (auth.uid() = user_id);
```
All four operations are covered, each scoped by `auth.uid() = user_id`, with both `using` and `with check` on `update` (correct — `using` alone would let a user retarget someone else's row's `user_id` on write).

**No service-role key exists anywhere.** Confirmed three ways:
1. `src/lib/supabase.ts:5-24` is the *only* Supabase client factory in the codebase (grep across `src/` for `createClient|createServerClient|SupabaseClient` returns 13 files — all either import this factory or receive an already-constructed client as a parameter; none instantiate a second client).
2. `astro.config.mjs:74-75` declares exactly two server secrets, `SUPABASE_URL`/`SUPABASE_KEY`, no service-role variable.
3. `.dev.vars.e2e` (the dedicated E2E Supabase project's credential file, used by `npm run dev:e2e`) contains only `SUPABASE_URL=` / `SUPABASE_KEY=` — same anon-key-only shape. `context/deployment/deploy-plan.md:43` explicitly documents this is deliberate: "anon/public key (NOT service_role — the latter bypasses RLS and must never end up anywhere)."

**App-level filtering is real but is not proof of RLS — and actively masks the ability to test RLS through the app.** Every route reads the acting user from the session, never from the client:
- `src/pages/api/categories.ts:27,48`, `src/pages/api/expenses.ts:29,50`, `src/pages/api/expenses/summary.ts:22` — all call the service layer with `context.locals.user.id`, sourced from `context.locals.user` which `src/middleware.ts:7-13` sets from `supabase.auth.getUser()` on every request. No route accepts a `user_id`/owner field from the request body.
- `src/pages/api/expenses/[id].ts:37,64` — update/delete take a client-supplied *record* id from the URL, but `src/lib/services/expenses.ts:143-144` (`updateExpense`) and `:158-159` (`deleteExpense`) additionally filter `.eq("id", expenseId).eq("user_id", userId)` before touching a row.

Because `userId` is never attacker-controlled anywhere in the HTTP surface, **there is no route through which an authenticated user could even attempt to read/mutate another user's row today** — the app-level filter already prevents it structurally, independent of RLS. This is good defense-in-depth, but it means: **testing via the app's real endpoints (API or UI) cannot exercise a genuine RLS gap, because the app-level filter would silently absorb it.** The only way to actually prove RLS holds is to bypass the Astro app and query Supabase directly as user B for user A's real record id — exactly what test-plan.md's guidance already calls for ("must challenge... instead of a direct API/DB-level ownership check with a second real user").

**Zero automated test exists that does this.** Confirmed by reading every test file in the repo:
- `src/lib/services/categories.test.ts` and `src/lib/services/expenses.test.ts` — pure-function unit tests only (`normalizeCategoryName`, `DuplicateCategoryError`, `mergeCategoriesWithTotals`, `createExpenseSchema`); no Supabase client is ever instantiated.
- All 9 `tests/e2e/*.spec.ts` files sign in as exactly one user per test (`signUpAndSignIn`, `tests/e2e/helpers.ts:64-80`) and never construct a second session in the same test.

**Verdict on Risk #1 response guidance: CONFIRMED, no correction needed.** The guidance already anticipated exactly this shape of gap ("RLS is enabled is not proof by itself," "must challenge whether any API route uses the service-role key," "avoid testing only that the UI hides cross-user rows"). Grounding confirms: no service-role key exists (that specific worry is resolved negative), RLS is scoped per-operation correctly, and the real remaining risk is precisely the missing direct-DB two-session test the guidance already names as the target.

### Risk #2 — the SUM is DB-side, not app-side; the multi-entry oracle problem is already closed; the real gap is narrower than stated

**Where the aggregation actually runs** (resolves the "must ground" cell in test-plan.md's guidance table): `supabase/migrations/20260722090000_create_expenses.sql:29-37`:
```sql
create view public.monthly_category_summary
  with (security_invoker = true) as
  select
    e.user_id,
    e.category_id,
    date_trunc('month', e.date)::date as month,
    sum(e.amount) as total
  from public.expenses e
  group by e.user_id, e.category_id, date_trunc('month', e.date);
```
The SUM is a Postgres `GROUP BY` view, not an application-level reduce. `with (security_invoker = true)` is load-bearing: it makes the view execute with the *querying* user's row-level security context (Postgres 15+ semantics), so `expenses_select_own` still applies when reading through the view — the view cannot become an RLS bypass. `src/lib/services/expenses.ts:187-213` (`getMonthlySummary`) queries this view filtered by `user_id` and `month`, then hands the raw totals to `mergeCategoriesWithTotals` purely for merge/default-to-zero/sort/rank — no summing happens in TypeScript at all.

**What's already unit-tested (`src/lib/services/expenses.test.ts:4-55`)**: `mergeCategoriesWithTotals` — defaulting a category with no total to `"0.00"`, descending sort by numeric total, alphabetical tie-break, sequential ranking. Expected values are hand-typed literals (`"50.00"`, rank order `["c2","c1"]`), not derived by re-running the function under test — no oracle problem in this unit test, but it only proves the merge/rank step, which was never the risky part; it takes already-summed totals as input.

**Because the SUM itself is SQL, it is not unit-testable at all** — there's no way to prove `sum(e.amount) group by ...` is correct without executing it against a real database. This is where test-plan.md's Risk #2 guidance needs correcting: "unit test on the aggregation/ranking function itself" conflates two different things that turned out to live in two different layers. The ranking half is unit-tested and done; the aggregation half cannot be unit-tested by construction and needs a DB-hitting test.

**That DB-hitting proof already exists, and already avoids the oracle problem.** `tests/e2e/expenses-delete-updates-summary.spec.ts:19-30`:
```ts
// Two expenses in the same category so the total is only meaningful if
// exactly one entry's amount is subtracted, not the whole category wiped.
await openAddExpenseDialog(page);
... Category: "Utilities", Amount: "30.00" ...
... Category: "Utilities", Amount: "45.00" ...
await expect(summaryRowFor(page, "Utilities")).toContainText("$75.00");
```
Two independent raw expense rows ($30.00 + $45.00) in the same category, asserted against a hand-computed literal ($75.00) — this is a real, independent proof that the DB SUM reconciles across ≥2 entries, not a value copied from re-running the implementation. The same spec then deletes one row and asserts the total drops to exactly `$30.00` (not `$75.00 − $45.00`, written as its own literal), proving the SUM correctly excludes a deleted row too. `tests/e2e/expenses-add-and-summary.spec.ts` additionally proves two *different* categories don't bleed into each other's totals and that ranking is largest-first end-to-end.

**Verdict: the multi-entry reconciliation gap the test-plan worried about is already closed**, cheaply, via existing e2e coverage — no new test is needed here, and building a redundant "unit test the aggregation function" per the original guidance is not possible (no app-level aggregation function exists to unit-test) and would violate the plan's own cost×signal principle if attempted as a DB-hitting duplicate of coverage that already exists.

**What is genuinely still missing**: no test proves the summary view excludes **another user's** expenses from the total. RLS (`expenses_select_own` + `security_invoker = true` on the view) should structurally prevent this, but — same as Risk #1 — nothing exercises it: every e2e test signs in as a single fresh user (`signUpAndSignIn`), so there is never a second user's data in the same test run to leak from. This is not a distinct "Risk #2 aggregation bug" scenario; it's Risk #1's cross-user boundary applied specifically to the summary path, and closes with the same fix.

### The missing piece for both risks: no integration-test layer exists yet

- `vitest.config.ts:5-7` — `include: ["src/**/*.test.ts"]` only. No separate integration project, no env-var wiring for a real Supabase client, no test file anywhere instantiates `@supabase/supabase-js`'s `createClient` (the plain client, not the `@supabase/ssr` server client `src/lib/supabase.ts` wraps).
- Playwright (`playwright.config.ts`) is the only thing in the repo that talks to a real Supabase backend, and only ever as a single signed-in user driving the UI.
- A dedicated E2E Supabase project + anon credentials already exist and are reusable: `.dev.vars.e2e` (`SUPABASE_URL`, `SUPABASE_KEY` — anon key, confirmed above), the same project `npm run dev:e2e` points Playwright at. A new Vitest-based integration test can sign up two real users against this same project directly via `@supabase/supabase-js`, with no new Supabase project or credential plumbing required.
- `.github/workflows/ci.yml:18-24` runs `npm run lint` and `npm run build` only — **no test step of any kind runs in CI today**, unit or e2e. This is a pre-existing gap the test-plan's own §5 Quality Gates table anticipates ("unit + integration ... required after §3 Phase 1") but is not itself part of Risk #1/#2's scope — flagging so Phase 1's plan doesn't assume tests it writes will be enforced in CI without also wiring that step in.

## Code References

- `supabase/migrations/20260721120000_create_categories.sql:9-20` — categories RLS (select/insert only) + unique-name index
- `supabase/migrations/20260722090000_create_expenses.sql:1,13-27` — cross-table ownership FK + expenses RLS (all 4 operations, scoped)
- `supabase/migrations/20260722090000_create_expenses.sql:29-37` — `monthly_category_summary` view, `security_invoker = true`, DB-side `sum(...) group by`
- `src/lib/supabase.ts:5-24` — sole Supabase client factory, anon key only
- `src/middleware.ts:6-13` — session→`context.locals.user` resolution used by every route as the sole source of the acting user id
- `src/pages/api/expenses/[id].ts:37,64` — client-supplied record id, but user id still session-derived
- `src/lib/services/expenses.ts:143-144,158-159` — app-level `.eq("user_id", userId)` defense-in-depth on update/delete
- `src/lib/services/expenses.ts:167-185` — `mergeCategoriesWithTotals`, the only app-level piece of "aggregation," unit-tested
- `src/lib/services/expenses.ts:187-213` — `getMonthlySummary`, queries the DB view, does no summing itself
- `src/lib/services/expenses.test.ts:4-55` — ranking/merge unit tests, independently-typed expected values
- `tests/e2e/expenses-delete-updates-summary.spec.ts:19-30` — the existing oracle-free proof of multi-entry SUM reconciliation ($30+$45=$75, then $30 after delete)
- `tests/e2e/expenses-add-and-summary.spec.ts` — cross-category non-bleed + ranking, single entry per category
- `vitest.config.ts:5-7` — unit-only include pattern, no integration layer
- `.dev.vars.e2e` — reusable E2E Supabase project credentials (anon key only, keys confirmed, values not read)
- `.github/workflows/ci.yml:9-24` — CI runs lint+build only, no test step

## Architecture Insights

- **Ownership is enforced twice, by design**: session-derived `userId` at the app layer, and `auth.uid() = user_id` at the RLS layer. This is good practice but has a testing implication worth stating plainly: the app layer's correctness can never be used as a proxy for the RLS layer's correctness, because the app layer never gives an attacker a lever to move `userId`. Proving RLS requires stepping outside the app.
- **The "aggregation function" test-plan.md's guidance imagined doesn't exist as app code.** The SUM lives entirely in a Postgres view. This is a case where research corrects the plan's assumption rather than confirming it — the plan's *evidence and intent* (prove reconciliation, avoid the oracle problem) were right; its guess at *where the logic lives* (an app-level function to unit-test) was wrong.
- `security_invoker = true` on the summary view is the load-bearing detail that makes the view RLS-safe; it's easy to miss because it's a one-line clause on a `create view` statement, but its absence would have been a real Risk #1-shaped hole specific to the summary path.

## Historical Context (from prior changes)

- `context/changes/testing-data-isolation-summary/research.md` (2026-07-21, this change's own prior research, now fully superseded) — correctly predicted that once categories/expenses landed, the manual two-user RLS check called out in `expense-categories/plan.md` would need to become this phase's automated test. That prediction held; the manual check was never automated.
- `context/archive/2026-07-21-account-signin-signout/` — established the `tests/e2e/` convention, the dedicated E2E Supabase project, and the `dev:e2e` script that both the existing specs and any new integration test should reuse.
- `context/foundation/test-plan.md:43-64` — the risk register and response-guidance table this document re-grounds; §1's hot-spot note ("scoped `src/` git log returned only 2 commits in the last 30 days... project ~3 weeks old") is now stale given how much has shipped since 2026-07-21 (full categories + expenses features, 2 migrations, 2 unit-test files, 9 e2e specs) — worth a `/10x-test-plan --refresh` pass at some point, though that's outside this research's scope.

## Related Research

- None under `context/archive/**/research.md` beyond the superseded document above.

## Open Questions

1. Should the new integration-test layer live under `src/**/*.integration.test.ts` (picked up by a second Vitest project/config so slow, network-bound tests don't block the fast unit run) or a separate `tests/integration/` directory outside Vitest's current `include`? Either works; the plan should pick one and wire it into `vitest.config.ts` and, separately, into CI (`.github/workflows/ci.yml` currently runs no test step at all).
2. Should the cross-user integration test be one suite covering both risks (two real users, exercising categories select/insert and expenses select/insert/update/delete, plus a summary-total exclusion check), or split per risk? Given both gaps close via the same two-session fixture, one suite is very likely cheaper and is what the response guidance's "likely cheapest layer" column implies for both rows.
3. `.dev.vars.e2e` is the natural credential source for this new integration layer since it's already used for real cross-session work (Playwright). Confirm during planning whether CI should also get these as repository secrets (mirroring `SUPABASE_URL`/`SUPABASE_KEY` already wired for the build step) or whether the integration suite should be local-only for now.
