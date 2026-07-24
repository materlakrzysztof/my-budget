---
date: 2026-07-22T18:02:10+0000
researcher: Claude (Sonnet 5)
git_commit: e81c1d9
branch: develop
repository: my-budget
topic: "Log and summarize expenses (S-03): expenses table, date/month attribution, and monthly summary aggregation"
tags: [research, codebase, expenses, categories, supabase, rls, timezone, aggregation]
status: complete
last_updated: 2026-07-22
last_updated_by: Claude (Sonnet 5)
---

# Research: Log and summarize expenses (S-03)

**Date**: 2026-07-22T18:02:10+0000
**Researcher**: Claude (Sonnet 5)
**Git Commit**: e81c1d9
**Branch**: develop
**Repository**: my-budget

## Research Question

Ground a plan for roadmap slice S-03 (`log-and-summarize-expenses`, PRD refs FR-006–FR-009, US-01, US-02): user can add an expense (auto or backdated date, manually selected category) and see it reflected in a ranked, month-end per-category summary. Specifically: what conventions from the just-shipped `expense-categories` feature must be replicated, how should the expense date and "current month" be modeled to avoid a timezone/day-boundary bug, and how should the summary aggregation be computed to guarantee it reconciles with individual expense entries (both explicitly named as risks in `context/foundation/test-plan.md`)?

## Summary

This is a greenfield build on top of one existing precedent (`expense-categories`/S-02) and zero existing date/money/aggregation code. Three things ground the plan:

1. **Replicate the categories precedent exactly** — migration shape (RLS, per-operation policies, FK to `auth.users` with cascade delete), service-layer structure (co-located zod schema, row→domain mapper, functions taking `(supabase, userId, ...)`), API route conventions (`prerender=false`, auth-check-first, JSON status mapping), and the Manager/List/Form/Alert React-island composition — all cataloged below with file:line citations.
2. **Expense date should be a Postgres `date` column, not `timestamptz`** — it has no time-of-day/timezone component by construction, which structurally avoids the local-midnight boundary bug `test-plan.md` Risk #3 worries about. Cloudflare Workers has no timezone override (UTC-only `Date`/`Intl`), and no code in this repo does date math yet, so this is a clean-slate decision, not a migration.
3. **Monthly summary aggregation should run DB-side** (a Postgres view or `supabase.rpc()` function doing `SUM(amount) ... GROUP BY category_id ORDER BY total DESC`), not an app-level JS reduce — this avoids both the "oracle problem" (test-plan.md Risk #2's named anti-pattern: validating a number against the same code that produced it) and JS floating-point drift on summed money.

One implementation-review lesson from S-02 generalizes directly and matters here: **a DB-level derived/normalized value must match the app's own normalization logic exactly, or a hard-block/invariant silently breaks** (`expense-categories/reviews/impl-review.md` F1 — the unique-index/`normalizeCategoryName` mismatch). For S-03 this maps onto month attribution: whatever computes "which month does this date belong to" must be identical wherever it's evaluated (ideally: evaluated in exactly one place, DB-side, never duplicated in app code).

Two decisions are explicitly **not** resolved by any prior work and must be made fresh in planning: the money/amount column type (`numeric` vs integer cents), and whether expenses are ever editable/deletable (categories deliberately has neither UPDATE nor DELETE RLS policies — S-03 likely needs at least delete, unlike S-02).

## Detailed Findings

### Categories precedent to replicate (Supabase migration, service, API, UI)

- **Migration** (`supabase/migrations/20260721120000_create_categories.sql`): `id uuid primary key default gen_random_uuid()`; `user_id uuid not null references auth.users(id) on delete cascade`; domain columns `not null` with length enforced by zod, not SQL; `created_at timestamptz not null default now()`, no `updated_at`. RLS enabled; per-operation, per-role policies named `<table>_<op>_own` (`categories_select_own`, `categories_insert_own`) — **no update/delete policy exists** for categories (blocked by RLS default-deny). Uniqueness via an expression index (`create unique index ... on public.categories (user_id, lower(trim(name)))`), not a table constraint.
- **Types** (`src/types.ts`): domain type = entity name, camelCase fields, `createdAt` (not `created_at`). Request DTO `Create<Entity>Request` with only user-supplied fields. Response DTOs wrap the entity: `Create<Entity>Response { category: Category }`, `List<Entities>Response { categories: Category[] }`.
- **Service** (`src/lib/services/categories.ts`): imports `SupabaseClient` type from `@supabase/supabase-js`; `UNIQUE_VIOLATION = "23505"` checked via `error.code`; zod schema co-located and exported; custom `Error` subclass for domain-specific failures (`DuplicateCategoryError`); private `<Row>` interface mirrors DB snake_case columns, private `to<Entity>()` mapper converts row → domain type; **every function signature takes `(supabase, userId, ...)` explicitly** — `userId` is never derived inside the service.
- **API routes** (`src/pages/api/categories.ts`): `export const prerender = false;` immediately after imports; local `json(body, status)` helper; auth check (`context.locals.user`) is always the first line of every handler, 401 if absent; Supabase client created per-request via `createClient(context.request.headers, context.cookies)`, null-checked → 500; body parsed with `.json().catch(() => null)` then `schema.safeParse`, 400 with `{ error, issues }` on failure; response bodies use `satisfies <ResponseDto>`.
- **SSR page + middleware** (`src/pages/categories.astro`, `src/middleware.ts`): frontmatter calls the service directly (no self-fetch to the API route); `PROTECTED_ROUTES` is a flat array checked with `startsWith` — a new route is just appended (`src/middleware.ts:4`).
- **React islands** (`src/components/categories/*.tsx`): a top-level `*Manager.tsx` owns all state (list + server-side error) and the `fetch` call with full status-code branching; a pure read-only `*List.tsx`; a `*Form.tsx` doing its own client-side required-field validation (mirrors `SignUpForm.tsx`'s `validate()` pattern) with local `errors`/`submitting` state; a tiny `*Alert.tsx` (`role="alert"`, returns `null` when empty) rendered inline by the form. Error flow: API error body → Manager state → passed down to Form prop → passed down to Alert prop.
- **Supabase client** (`src/lib/supabase.ts`): `createClient(requestHeaders, cookies)` uses `createServerClient` from `@supabase/ssr`, bound to the anon `SUPABASE_KEY` and cookie getAll/setAll — **never a service-role key**. This exact client must be reused for `expenses` so RLS's `auth.uid()` context is preserved. Returns `null` if env vars are missing; every caller must null-check.
- **Navigation** (`src/components/Topbar.astro`): nav links are added inside the `user ? (...)` branch, matching the existing `/categories` link's Tailwind classes.
- **Versions** (`package.json`): `zod ^4.4.3`, `@supabase/supabase-js ^2.99.1`, `@supabase/ssr ^0.10.3`, `astro ^6.3.1`, `vitest ^4.1.10`.

### Date/month attribution (test-plan.md Risk #3)

- **No existing date-handling code**: a repo-wide grep for `new Date(`, `toISOString`, `Date.now(`, `Intl.`, `timeZone`, `toLocaleDateString` across `src/` returned zero matches. S-03 is greenfield on this axis — no existing assumption to inherit or contradict.
- **No timezone override available**: `astro.config.mjs` and `wrangler.jsonc` have no timezone setting; Cloudflare Workers' `Date`/`Intl` are UTC-only by platform design, with no `TZ` override possible.
- **The only existing column precedent is a system timestamp, not a user-picked date**: `categories.created_at timestamptz not null default now()` records "when this row was written" — a materially different case from an expense's user-selected (possibly backdated) calendar date. The PRD (`context/foundation/prd.md` US-02 + Acceptance Criteria) frames the expense date purely as a calendar day ("dated in a previous month"), with no time-of-day semantics anywhere in the requirement.
- **Recommendation**: use Postgres `date` (not `timestamptz`) for the expense's date column — a `date` value has no time-of-day or timezone component by construction, which structurally eliminates the local-midnight boundary bug Risk #3 worries about (there is no "midnight" to be near). Compute "current month" via `date_trunc('month', current_date)` (or equivalent) in exactly one place — ideally DB-side — rather than converting to/from `timestamptz` anywhere in the pipeline, since a conversion point is exactly where a timezone-shift bug would be reintroduced.

### Aggregation & money handling (test-plan.md Risk #2)

- **No aggregation precedent exists**: the only query-style precedent (`src/lib/services/categories.ts` `selectCategories`) is a plain `.select().eq().order()` — no `GROUP BY`/`SUM`, no RPC, no view anywhere in `supabase/migrations/`.
- **supabase-js has no native aggregation over `.select()`**: PostgREST doesn't expose ad-hoc `GROUP BY`/`SUM` through the query builder — a `sum`+`group by`+`order by` requires either a Postgres view/RPC function (`supabase.rpc(...)`) or fetching raw rows and reducing server-side in the Worker (this app has no browser-side reduce path since it's SSR).
- **Recommendation**: run the per-category sum+rank as a DB-side query (a view or `supabase.rpc()` function: `SUM(amount) ... GROUP BY category_id ORDER BY total DESC`), not an app-level JS reduce. This directly avoids test-plan.md Risk #2's named anti-pattern ("the total matches because the same aggregation function produced both numbers" — the oracle problem) and avoids JS floating-point drift on summed money. Since `categories.ts`'s existing `.select()`-only style sets no conflicting convention, introducing a view/RPC here is a new-but-uncontested pattern, not a break from an established one.
- **Money/decimal type is genuinely undecided**: no table in this codebase stores currency; the PRD (`context/foundation/prd.md`) and `context/foundation/tech-stack.md` state no currency/decimal-precision requirement (single-currency implied by silence). A Postgres `numeric`/`decimal` column avoids floating-point drift at the DB layer, but supabase-js returns `numeric` as a **string** by default, not a JS `number` — worth confirming/handling explicitly at implementation time to avoid silently reintroducing float error when the value crosses into JS/TS.

### Historical constraints inherited from S-01/S-02

- **Migrations are manually applied, twice**: no `supabase link`/`db push` CLI automation exists — every migration is manually pasted into the E2E and production Supabase SQL editors (`context/changes/expense-categories/plan.md:27`, confirmed again in that plan's Phase 1 manual-verification steps). Budget for two manual SQL-editor applies per new migration.
- **Never edit an applied migration** — ship a new migration file for any schema fix, per the impl-review's F1 resolution (`context/changes/expense-categories/reviews/impl-review.md`, Fix A note).
- **DB-vs-app normalization must match exactly, or an invariant silently breaks**: `expense-categories/reviews/impl-review.md` F1 found that the unique index's `lower(trim(name))` didn't match the app's `normalizeCategoryName` (which also collapsed internal whitespace), letting the hard-block duplicate rule be silently bypassed for whitespace variants. The same class of bug applies to month attribution — whatever derives "month" from a date must be identical wherever it's evaluated, which is itself an argument for evaluating it in exactly one place (see Date/month recommendation above).
- **E2E infra reuse**: dedicated cloud Supabase project (not local/Docker), credentials in gitignored `.dev.vars.e2e`, `npm run dev:e2e` (`cross-env CLOUDFLARE_ENV=e2e astro dev`), dev-mode auto-confirm signup. `@astrojs/cloudflare` ignores `CLOUDFLARE_ENV` for `astro:env` secrets — a custom Vite plugin was needed to route `.dev.vars.e2e` in for account-signin-signout's E2E setup (`context/changes/account-signin-signout/plan.md`); expenses E2E specs will need the same React-island hydration-wait pattern already established (`waitForAuthFormHydration`/`waitForCategoriesFormHydration` in `tests/e2e/helpers.ts`) for any new expense-entry form island.
- **Production Site URL gotcha** (`context/deployment/deploy-plan.md`): Supabase Auth email links fall back to the dashboard's "Site URL" unless `emailRedirectTo` is set explicitly — not directly relevant to expenses, but confirms this class of per-project manual config is easy to silently regress and worth re-checking if any new Supabase project config touches auth-adjacent settings.

## Code References

- `supabase/migrations/20260721120000_create_categories.sql:1-20` — table + RLS + unique-index precedent
- `src/types.ts:1-19` — DTO naming/shape precedent
- `src/lib/services/categories.ts:1-97` — full service-layer precedent (zod, error mapping, row mapper, function signatures)
- `src/pages/api/categories.ts:1-56` — API route precedent (auth-first, status-code mapping)
- `src/pages/categories.astro:1-23` — SSR page precedent
- `src/middleware.ts:4` — `PROTECTED_ROUTES` array
- `src/components/categories/CategoriesManager.tsx:1-42` — state-owning Manager pattern
- `src/components/categories/CategoryList.tsx:1-22` — read-only list pattern
- `src/components/categories/AddCategoryForm.tsx:1-101` — form + client validation pattern
- `src/components/categories/DuplicateCategoryAlert.tsx:1-19` — alert component pattern
- `src/lib/supabase.ts:1-24` — Supabase client factory (anon key, cookie-scoped, never service-role)
- `src/components/Topbar.astro:9-25` — nav-link pattern for signed-in users
- `tests/e2e/helpers.ts` — `waitForAuthFormHydration`/`waitForCategoriesFormHydration`, the React-island hydration-race workaround new expense forms will need

## Architecture Insights

- This codebase has exactly one non-trivial data feature shipped (`categories`), and it's a deliberately strong, consistent template: migration → types → service (zod + row mapper + typed errors) → API route (auth-first, status mapping) → SSR page (direct service call, no self-fetch) → React island (Manager/List/Form/Alert). S-03 should follow this template file-for-file rather than inventing new structure.
- The project has zero aggregation/date-math code anywhere — S-03 is the first feature to need either. Both decisions (DB-side aggregation, `date` column type) are new patterns being introduced, not deviations from an established one, so there's no backward-compatibility cost to getting them right from first principles.
- The single implementation-review finding from S-02 (F1: DB/app normalization mismatch) is a recurring-pattern risk, not a one-off: any time a derived value is computed in two places (DB and app), they must be proven identical, not just "similar." Worth treating as a standing design rule for S-03's month-attribution logic.

## Historical Context (from prior changes)

- `context/changes/expense-categories/plan.md` — full precedent for schema/service/API/UI conventions (see Detailed Findings above); "Migration Notes" and "Performance Considerations" sections have no bearing on dates/aggregation specifically, confirming those are open decisions for this plan.
- `context/changes/expense-categories/reviews/impl-review.md` — F1 (DB/app normalization mismatch) generalizes directly to month attribution; also confirms the manual-migration-apply and never-edit-an-applied-migration conventions.
- `context/changes/account-signin-signout/plan.md` — E2E Supabase project setup, `.dev.vars.e2e`/`dev:e2e` convention, the `CLOUDFLARE_ENV` secrets-loading gotcha for `@astrojs/cloudflare`, and the React-island hydration-race pattern later reused (and extended) in `expense-categories`.
- `context/deployment/deploy-plan.md` — production Site URL / `emailRedirectTo` gotcha, tangential but confirms per-project manual config is a recurring risk class in this repo.
- `context/foundation/test-plan.md` — Risk #2 (summary reconciliation), Risk #3 (date/month attribution), and Risk #4 (expense saved under wrong category) all trace directly to this slice; their "What would prove protection" and "Must challenge" columns should be read again during planning as acceptance-criteria source material.
- `context/changes/testing-data-isolation-summary/research.md` — independently confirms S-03 has zero code and zero plan yet as of this research; that change's Phase 1 test work (RLS isolation, summary reconciliation) is partially blocked on S-03's design landing.

## Related Research

- `context/changes/testing-data-isolation-summary/research.md` — sibling research for the test-rollout Phase 1 change, covers overlapping ground on RLS isolation and summary-reconciliation risk from a testing-strategy angle rather than a feature-implementation angle.

## Open Questions

- **Money/amount column type**: `numeric`/`decimal` vs. integer cents — no prior convention exists in this codebase or its foundation docs; must be decided during planning.
- **Expense mutability**: are expenses ever editable or deletable after creation? Categories deliberately has neither UPDATE nor DELETE RLS policies (FR-004 deferred to v2), but nothing in the PRD explicitly rules out expense edit/delete — the PRD's Functional Requirements (FR-006–009) only describe add and view. Needs an explicit decision (and, if yes, new RLS policies following the `<table>_<op>_own` naming convention).
- **Exact aggregation implementation**: Postgres view vs. `supabase.rpc()` function — both satisfy the "DB-side, single source of truth" recommendation above; the choice between them is an implementation detail for planning, not resolved by this research.
- **Numeric-as-string handling**: if `numeric` is chosen for the amount column, confirm how supabase-js's string-typed `numeric` return values are parsed/summed/formatted in TypeScript without reintroducing float error.
