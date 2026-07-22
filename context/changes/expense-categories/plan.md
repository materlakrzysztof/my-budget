# Expense Categories — View Defaults & Add New — Implementation Plan

## Overview

Roadmap slice `S-02` (`context/foundation/roadmap.md`) targets FR-003 ("user can view a set of default expense categories") and FR-005 ("user can add a new category with a description; the system warns if a similar category name already exists"). This is the first real build slice on top of auth (`S-01`): it introduces the `categories` table (and its RLS policy), the first `zod` usage, the first `src/lib/services/` module, the first `src/types.ts`, and the first JSON (fetch-based) API contract in this codebase — none of these exist yet.

## Current State Analysis

- No `supabase/migrations/` directory exists — no tables beyond Supabase's built-in `auth.users`.
- `zod` is not a dependency; no validation library is used anywhere yet (`src/pages/api/auth/*.ts` cast `FormData` fields with `as string`, no checks).
- `src/lib/` holds only `supabase.ts` (client factory), `utils.ts` (`cn()` helper), and `config-status.ts` — no service-layer precedent.
- `src/types.ts` does not exist.
- All three existing API routes (`src/pages/api/auth/{signup,signin,signout}.ts`) use a real `<form method="POST">` submission + full-page redirect with `?error=` — no JSON request/response contract exists anywhere yet.
- `src/components/ui/` has only `button.tsx` (shadcn "new-york"); no `input`/`textarea`/`alert` components. Auth forms use a hand-rolled `FormField.tsx` (icon + label + error slot) and `ServerError.tsx` (a plain `<p>`, no ARIA role).
- `src/middleware.ts:4` hardcodes `PROTECTED_ROUTES = ["/dashboard"]` — a new protected page must be added to this array explicitly; it has no effect on API routes, which must check `context.locals.user` themselves.
- `src/env.d.ts:3` only exposes `user` on `Astro.locals`, not a Supabase client — every route/page creates its own client via `createClient(context.request.headers, context.cookies)` (`src/lib/supabase.ts:5`).
- No unit-test runner exists (Playwright E2E only, via `playwright.config.ts` at the repo root; `tests/e2e/` currently has zero spec files).
- `context/deployment/deploy-plan.md` (per prior research) explicitly names `categories` as the first table that must carry the RLS convention from CLAUDE.md (granular, per-operation, per-role policies).

### Key Discoveries:

- `src/lib/supabase.ts:5` — `createClient(requestHeaders, cookies)` is the only way to get a Supabase client; reused identically in every new route.
- `src/middleware.ts:4,18-21` — protected-page gating is an explicit array match, not automatic; API routes are not covered by it at all.
- `src/pages/dashboard.astro:1-4` — the established SSR pattern: an Astro page's frontmatter reads `Astro.locals.user` and can call service-layer code directly (no self-fetch to its own API route needed for the initial render).
- `src/components/Banner.astro:9` — `role={variant === "error" ? "alert" : "status"}` is the one place in the repo that gets ARIA alert roles right; `ServerError.tsx` (used by the auth forms) does not (flagged as a known gap in `context/changes/account-signin-signout/plan.md:29`) — the new duplicate-name error should follow `Banner.astro`'s example, not `ServerError.tsx`'s.
- `context/changes/account-signin-signout/plan.md` establishes the plan/progress conventions this plan follows (Phase blocks with plain bullets, `## Progress` with checkboxes, manual-confirmation pause between phases).
- No `supabase link` has been run for this repo (`supabase/.temp/` doesn't exist) — there is no CLI-automated path from a migration file to the cloud projects; applying SQL to any cloud Supabase project (E2E test project, production) is a manual, one-time-per-migration action via the dashboard's SQL editor, consistent with how `deploy-plan.md` handled the Site URL setting by hand.

## Desired End State

A signed-in user visiting `/categories` sees 8 pre-seeded default categories (created transparently on their first visit) and can add a new category with a name + description. Adding a category whose name matches an existing one (case/whitespace-insensitive) is rejected with a clear inline error naming the conflicting category; all other categories persist per-user, protected by RLS so no user can see or create rows for another user.

Verify via: `npm run test:e2e -- categories` passes against the dedicated E2E Supabase project (per `account-signin-signout`'s infrastructure), and `npm run test:unit` passes for the pure normalization/error-mapping logic.

## What We're NOT Doing

- Not implementing category editing (FR-004 — explicitly deferred to v2 per PRD Non-Goals).
- Not implementing category deletion — not requested by any FR; no RLS policy for `DELETE` is added, so it's blocked by default.
- Not implementing expense logging or the monthly summary (`S-03`, separate roadmap slice) — this plan only prepares the category list that `S-03` will consume via `GET /api/categories`.
- Not adding fuzzy/typo-tolerant similarity matching (e.g. trigram/Levenshtein) — "similar" is implemented as exact match after trimming/case-folding, decided during planning to keep the DB constraint and the user-facing block consistent (see Critical Implementation Details).
- Not wiring migration deployment into CI — applying this migration to the E2E and production Supabase projects is a manual dashboard step, consistent with the existing gap already parked for `account-signin-signout`.

## Implementation Approach

Four phases, bottom-up: schema first (categories table + RLS + uniqueness), then the service/API layer that owns validation, default-seeding, and duplicate detection, then the UI that consumes it, then E2E coverage via `/10x-e2e`. The service layer is called directly by the `/categories` Astro page's SSR frontmatter (no self-fetch) and by the `GET`/`POST /api/categories` JSON endpoints (for the client island's live interactions and for `S-03`'s future reuse).

## Critical Implementation Details

**"Similar name" detection is intentionally exact-after-normalization, and it hard-blocks — not a soft warning.** During planning, two initially-independent decisions turned out to conflict: a DB-level `unique(user_id, lower(trim(name)))` constraint, and a "soft warning, user can save anyway" UX. Since both operate on the same normalized definition of "similar," a soft warning that still lets the save through was impossible — the DB would always reject the second insert. Resolution: the constraint stays, and the warning becomes a hard block for exact-after-normalization matches (e.g. "Food" / "food " / "FOOD" are the same category; "Food" / "Foods" are not). The service layer attempts the insert and maps a Postgres `23505` unique-violation into a friendly "A category named '<existing name>' already exists" error — it does not pre-check with a separate `SELECT` (avoids a TOCTOU race between check and insert).

**Default categories are seeded lazily, per-user, on first read — not at signup, and not as global rows.** Seeding at signup time was rejected because a new signup may not have an authenticated session yet (email confirmation can gate it in production, per `account-signin-signout`), and there's no service-role key configured to bypass RLS for an unauthenticated insert. Instead, `listCategories(supabase, userId)` checks for zero existing rows and, if found, bulk-inserts the 8 defaults (`ON CONFLICT DO NOTHING` on the normalized-name index, guarding against a double-seed race from two concurrent first-page-loads) before returning the list. Both the `/categories` page's SSR frontmatter and `GET /api/categories` call this same function, so there's exactly one seeding code path.

## Phase 1: Database schema — `categories` table, RLS, uniqueness

### Overview

Creates the first table this project owns beyond `auth.users`, with per-user RLS and a normalized-uniqueness index backing the hard-block duplicate rule.

### Changes Required:

#### 1. Categories table migration

**File**: `supabase/migrations/20260721120000_create_categories.sql` (new)

**Intent**: Store each user's categories (both seeded defaults and user-added ones) as plain rows scoped by `user_id`, with RLS enforcing that a user only ever sees or writes their own rows, and a normalized-uniqueness index backing the hard-block duplicate-name rule.

**Contract**:

```sql
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text not null,
  created_at timestamptz not null default now()
);

alter table public.categories enable row level security;

create policy "categories_select_own" on public.categories
  for select to authenticated
  using (auth.uid() = user_id);

create policy "categories_insert_own" on public.categories
  for insert to authenticated
  with check (auth.uid() = user_id);

create unique index categories_user_id_normalized_name_key
  on public.categories (user_id, lower(trim(name)));
```

No `UPDATE`/`DELETE` policies are added — both remain blocked by RLS's default-deny, matching "What We're NOT Doing."

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

> **Blocked on an upstream dependency as of 2026-07-21**: `account-signin-signout`'s E2E Supabase project is not yet confirmed working — its `plan.md` step 1.6 is explicitly blocked on a Supabase mailer rate-limit issue ("email rate limit exceeded... Not resolved"), and its Phase 2 (writing the actual auth E2E specs) hasn't started. The step below needs that blocker resolved first; do not attempt it until `account-signin-signout`'s Progress shows 1.6/1.7 checked off.

- Apply the migration SQL to the `account-signin-signout` E2E test Supabase project's SQL editor — this is also the "does it apply cleanly" check (no local Supabase/Docker involved, consistent with dropping that dependency in `account-signin-signout`); confirm the table + policies exist with no errors.
- Apply the same migration SQL to the production Supabase project's SQL editor.
- In the E2E project, manually insert two categories under two different `auth.users` rows and confirm, via the SQL editor's "run as" / RLS simulation or two authenticated app sessions, that one user cannot see the other's category.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Service layer, types, and API routes

### Overview

Adds the shared `Category` type, the `categories` service module (validation, default-seeding, duplicate-mapping), the `GET`/`POST /api/categories` JSON endpoints, and unit tests for the pure logic — the first `zod`, first `src/lib/services/`, first `src/types.ts`, and first JSON API contract in the repo.

### Changes Required:

#### 1. Shared types

**File**: `src/types.ts` (new)

**Intent**: Define the `Category` entity and the request/response DTOs the API routes and UI share, per CLAUDE.md's "shared types go in `src/types.ts`" convention.

**Contract**: `Category { id: string; name: string; description: string; createdAt: string }`; `CreateCategoryRequest { name: string; description: string }`; `CreateCategoryResponse { category: Category }`; `ListCategoriesResponse { categories: Category[] }`.

#### 2. Categories service

**File**: `src/lib/services/categories.ts` (new)

**Intent**: Own the business logic so the API routes and the `/categories` page's SSR frontmatter share one implementation: default-category content, name normalization, lazy seeding, and duplicate-to-friendly-error mapping.

**Contract**:

- `DEFAULT_CATEGORIES: { name: string; description: string }[]` — the 8 seeded defaults: Groceries ("Food and household supplies"), Transport ("Fuel, public transit, parking, vehicle maintenance"), Housing ("Rent or mortgage payments"), Utilities ("Electricity, water, gas, internet, phone"), Entertainment ("Movies, games, hobbies, going out"), Health ("Medical, pharmacy, insurance"), Clothing ("Apparel and footwear"), Other ("Anything that doesn't fit elsewhere").
- `normalizeCategoryName(name: string): string` — trims, collapses internal whitespace, lowercases. Pure function, unit-tested directly.
- `listCategories(supabase, userId): Promise<Category[]>` — selects the user's categories; if empty, bulk-inserts `DEFAULT_CATEGORIES` scoped to `userId` with `ON CONFLICT (user_id, lower(trim(name))) DO NOTHING` (race guard), then re-selects.
- `createCategory(supabase, userId, input: CreateCategoryRequest): Promise<Category>` — inserts; on a Postgres `23505` unique-violation, fetches the conflicting row (to name it in the message) and throws a typed `DuplicateCategoryError` carrying that name. The API route maps this to a `409`.

#### 3. Zod validation

**File**: `src/lib/services/categories.ts` (same file) or a co-located schema

**Intent**: Validate the create-category request body before it reaches the service logic — first `zod` usage in the repo, per CLAUDE.md's "validate input with zod" rule for API routes.

**Contract**: `z.object({ name: z.string().trim().min(1).max(50), description: z.string().trim().min(1).max(200) })`.

#### 4. API routes

**File**: `src/pages/api/categories.ts` (new)

**Intent**: Expose the service layer as JSON, gated by `context.locals.user` (not covered by `PROTECTED_ROUTES`, which only guards pages).

**Contract**: `export const prerender = false;` `GET` — 401 JSON if no `locals.user`; else `{ categories: Category[] }` via `listCategories`. `POST` — 401 if no user; parse body JSON with the zod schema (400 with issues on failure); call `createCategory`; `201 { category }` on success, `409 { error: "A category named '<name>' already exists." }` on `DuplicateCategoryError`.

#### 5. Dependencies

**File**: `package.json`

**Intent**: Add the first validation dependency.

**Contract**: Add `zod` to `dependencies`.

#### 6. Unit test infrastructure

**File**: `package.json`, `vitest.config.ts` (new)

**Intent**: Add the first unit-test runner, scoped to the pure logic in the new service module (per planning decision — Playwright E2E alone doesn't give fast, isolated coverage of `normalizeCategoryName`/duplicate-mapping).

**Contract**: Add `vitest` to `devDependencies`; add a `"test:unit": "vitest run"` script. `vitest.config.ts` resolves the `@/*` → `./src/*` alias (mirroring `tsconfig.json`'s paths) so service-layer imports work under test.

#### 7. Unit tests

**File**: `src/lib/services/categories.test.ts` (new)

**Intent**: Cover `normalizeCategoryName` (whitespace/case variants) and the duplicate-to-friendly-error mapping in isolation, without a browser or live Supabase project.

**Contract**: Table-driven cases for `normalizeCategoryName` (leading/trailing/internal whitespace, mixed case, already-normalized input); a case constructing `DuplicateCategoryError` and asserting the message shape the API route relies on.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm run test:unit`
- Lint passes: `npm run lint`
- Type checking passes: `npx astro check`
- Build passes: `npm run build`

#### Manual Verification:

- Against the E2E Supabase project (`npm run dev:e2e`), a first `GET /api/categories` call for a brand-new user returns the 8 defaults and the table now has rows for that user.
- A second `GET /api/categories` call for the same user does not duplicate rows (still exactly 8).
- `POST /api/categories` with a new unique name succeeds (`201`); repeating the exact same request (or a case/whitespace variant of the same name) returns `409` with the expected message.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: UI — categories page and components

### Overview

Adds the protected `/categories` page and the React island that lists categories and lets the user add a new one, with the duplicate-name error shown inline (no full-page reload) and a proper ARIA alert role (unlike `ServerError.tsx`'s known gap).

### Changes Required:

#### 1. Protect the new route

**File**: `src/middleware.ts`

**Intent**: Gate `/categories` the same way `/dashboard` already is.

**Contract**: Add `"/categories"` to the `PROTECTED_ROUTES` array (`src/middleware.ts:4`).

#### 2. Categories page

**File**: `src/pages/categories.astro` (new)

**Intent**: SSR entry point — fetches the (lazily-seeded) category list directly via the service layer (no self-fetch to `/api/categories`) and hands it to the React island as initial data, following `dashboard.astro`'s pattern of reading `Astro.locals` directly in frontmatter.

**Contract**: Frontmatter calls `listCategories(supabase, user.id)`; renders `<Layout title="Categories">` wrapping a `<CategoriesManager client:load initialCategories={categories} />`.

#### 3. shadcn form primitives

**Intent**: Add the form primitives this feature needs, per CLAUDE.md's "install new shadcn components with `npx shadcn@latest add [name]`" — the auth forms' hand-rolled `FormField` is icon-coupled and auth-specific, not worth reusing here.

**Contract**: `npx shadcn@latest add input textarea` (adds `src/components/ui/input.tsx`, `src/components/ui/textarea.tsx`).

#### 4. Categories island (state + composition)

**File**: `src/components/categories/CategoriesManager.tsx` (new)

**Intent**: Own the client-side category list state and the duplicate-error state; renders the list and the add-form; on successful `POST`, appends the returned category to local state (no page reload); on `409`, sets its own error state so the form re-renders with the message without losing the user's typed input.

**Contract**: `props: { initialCategories: Category[] }`; internal state: `categories: Category[]` and `duplicateError: string | null`. Owns `onCreate: (input: CreateCategoryRequest) => Promise<void>`, which performs the `fetch("/api/categories", { method: "POST", ... })` call, catches the `409` itself (does not rethrow), sets `duplicateError` from its message, and clears it on the next successful create. Passes both `onCreate` and `duplicateError` down to `AddCategoryForm` as props.

#### 5. Category list display

**File**: `src/components/categories/CategoryList.tsx` (new)

**Intent**: Render the current categories (name + description) as a simple list — read-only, since editing/deleting is out of scope.

**Contract**: `props: { categories: Category[] }`.

#### 6. Add-category form

**File**: `src/components/categories/AddCategoryForm.tsx` (new)

**Intent**: Name + description fields (shadcn `Input`/`Textarea`), client-side non-empty validation before submit (mirroring `SignUpForm.tsx`'s `validate()` pattern), calls `onCreate`, and renders whichever duplicate-name error `CategoriesManager` currently holds — this component does not own or catch that error itself.

**Contract**: `props: { onCreate: (input: CreateCategoryRequest) => Promise<void>; duplicateError: string | null }`; on submit, calls `onCreate` (any 409 is already handled upstream by `CategoriesManager`); renders `duplicateError` via `DuplicateCategoryAlert` below the fields.

#### 7. Duplicate-name alert

**File**: `src/components/categories/DuplicateCategoryAlert.tsx` (new)

**Intent**: Show the hard-block duplicate error with a correct `role="alert"` (following `Banner.astro`'s pattern, not `ServerError.tsx`'s gap flagged in prior research) so it's both visible and properly announced.

**Contract**: `props: { message?: string | null }`; renders `null` when `message` is falsy, otherwise a `role="alert"` element with the message.

#### 8. Navigation link

**File**: `src/components/Topbar.astro`

**Intent**: Let a signed-in user reach the new page.

**Contract**: Add a "Categories" link next to the existing "Dashboard" link, shown only in the signed-in branch.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Type checking passes: `npx astro check`
- Build passes: `npm run build`

#### Manual Verification:

- Visiting `/categories` while signed out redirects to `/auth/signin` (via `PROTECTED_ROUTES`).
- A brand-new signed-in user sees exactly the 8 default categories on first visit.
- Adding a category with a new unique name + description appears in the list immediately, without a page reload.
- Adding a category whose name is a case/whitespace variant of an existing one shows the inline `role="alert"` error naming the conflicting category, and does not add a duplicate row.
- The "Categories" link appears in the Topbar only when signed in.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: E2E coverage for categories

### Overview

Drives risk-tied Playwright coverage via `/10x-e2e expense-categories phase 4`, run against the dedicated E2E Supabase project (per `account-signin-signout`'s infrastructure, once Phase 1's migration is applied there).

> **Blocking prerequisite**: do not start this phase until `account-signin-signout`'s Progress section shows steps 1.6, 1.7, and all of Phase 2 checked off. As of 2026-07-21 that plan is blocked on a Supabase mailer rate-limit issue on the same E2E project this phase depends on.

### Changes Required:

#### 1. View defaults

**File**: `tests/e2e/categories-view-defaults.spec.ts` (new, generated by `/10x-e2e`)

**Intent**: Prove FR-003 — a freshly signed-up user's first visit to `/categories` shows the 8 default categories.

**Contract**: Sign up a unique timestamped user, navigate to `/categories`, assert all 8 default category names are visible via `getByText`/`getByRole`, no CSS selectors.

#### 2. Add a new category

**File**: `tests/e2e/categories-add-new.spec.ts` (new, generated by `/10x-e2e`)

**Intent**: Prove FR-005's happy path — a new, unique category is added and appears without a reload.

**Contract**: Fill and submit the add-category form with a unique timestamped name; assert it appears in the list.

#### 3. Duplicate name is blocked

**File**: `tests/e2e/categories-duplicate-blocked.spec.ts` (new, generated by `/10x-e2e`)

**Intent**: Prove the hard-block rule — a case/whitespace variant of an existing category name is rejected with the inline alert, and no duplicate row is created.

**Contract**: Add a category, then attempt to add the same name with different casing/whitespace; assert the `role="alert"` error is visible (`getByRole("alert")`) and the list still shows only one instance of that category.

### Success Criteria:

#### Automated Verification:

- `npx playwright test tests/e2e/categories-view-defaults.spec.ts` passes
- `npx playwright test tests/e2e/categories-add-new.spec.ts` passes
- `npx playwright test tests/e2e/categories-duplicate-blocked.spec.ts` passes
- Full E2E suite passes: `npm run test:e2e`

#### Manual Verification:

- For each of the three specs, confirm the deliberate-break check `/10x-e2e` runs actually turned the test red before the fix/revert.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before considering the change done.

---

## Testing Strategy

### Unit Tests:

- `normalizeCategoryName` — whitespace/case variants normalize to the same value.
- Duplicate-to-friendly-error mapping — a simulated `23505` maps to the expected message shape.

### Integration Tests:

- Not applicable — this stack has no dedicated integration-test layer; the `GET`/`POST /api/categories` contract is exercised end-to-end by the Playwright specs in Phase 4 instead.

### Manual Testing Steps:

1. Apply the Phase 1 migration to the E2E Supabase project and (separately) production.
2. `npm run dev:e2e`, sign up a new user, visit `/categories` — confirm the 8 defaults appear exactly once.
3. Add a new category with a unique name — confirm it appears without a page reload.
4. Add a category using an existing name with different case/whitespace — confirm the inline alert blocks it and no duplicate is created.
5. Sign out, visit `/categories` directly — confirm redirect to `/auth/signin`.

## Performance Considerations

None beyond what's already true of the stack — a handful of rows per user, single-digit-millisecond Postgres queries; no pagination or caching needed at this scale (`target_scale.data_volume: small` per PRD frontmatter).

## Migration Notes

The lazy per-user seeding (Phase 2) means existing rows are never bulk-migrated — a user's defaults are created the first time `listCategories` runs for them, which naturally covers both new and (once `S-01`/`S-02` ship) any pre-existing signed-up users on their next visit.

## References

- Roadmap slice: `context/foundation/roadmap.md` (`S-02`)
- PRD requirements: `context/foundation/prd.md` (FR-003, FR-004, FR-005)
- Prior plan conventions: `context/changes/account-signin-signout/plan.md`
- RLS/table gotcha: `context/deployment/deploy-plan.md:35`
- `ServerError.tsx` ARIA gap (avoided here): `context/changes/account-signin-signout/plan.md:29`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Database schema — categories table, RLS, uniqueness

#### Automated

- [x] 1.1 Lint passes: `npm run lint` — 4102fbe
- [x] 1.2 Build passes: `npm run build` — 4102fbe

#### Manual

- [x] 1.3 Migration applied cleanly to the E2E Supabase project's SQL editor — 4102fbe
- [x] 1.4 Migration applied to the production Supabase project's SQL editor — 4102fbe
- [x] 1.5 RLS cross-user isolation manually verified — 4102fbe

### Phase 2: Service layer, types, and API routes

#### Automated

- [x] 2.1 Unit tests pass: `npm run test:unit` — 63f3c60
- [x] 2.2 Lint passes: `npm run lint` — 63f3c60
- [x] 2.3 Type checking passes: `npx astro check` — 63f3c60
- [x] 2.4 Build passes: `npm run build` — 63f3c60

#### Manual

- [x] 2.5 First `GET /api/categories` for a new user returns exactly the 8 defaults — 63f3c60
- [x] 2.6 A second `GET /api/categories` does not duplicate the defaults — 63f3c60
- [x] 2.7 `POST /api/categories` succeeds for a new name and returns 409 for an exact/normalized duplicate — 63f3c60

### Phase 3: UI — categories page and components

#### Automated

- [x] 3.1 Lint passes: `npm run lint` — 8d04264
- [x] 3.2 Type checking passes: `npx astro check` — 8d04264
- [x] 3.3 Build passes: `npm run build` — 8d04264

#### Manual

- [x] 3.4 Signed-out visit to `/categories` redirects to `/auth/signin` — 8d04264
- [x] 3.5 New user sees exactly the 8 defaults on first visit — 8d04264
- [x] 3.6 Adding a new unique category appears without a page reload — 8d04264
- [x] 3.7 Adding a case/whitespace-duplicate name shows the inline `role="alert"` error and is blocked — 8d04264
- [x] 3.8 "Categories" link appears in Topbar only when signed in — 8d04264

### Phase 4: E2E coverage for categories

#### Automated

- [x] 4.1 `tests/e2e/categories-view-defaults.spec.ts` passes
- [x] 4.2 `tests/e2e/categories-add-new.spec.ts` passes
- [x] 4.3 `tests/e2e/categories-duplicate-blocked.spec.ts` passes
- [x] 4.4 Full E2E suite passes: `npm run test:e2e`

#### Manual

- [x] 4.5 Each spec's deliberate-break check confirmed red-then-green
