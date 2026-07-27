# Category Management in Settings (FR-023) Implementation Plan

## Overview

Relocate category management (add/edit/delete) from the standalone `/categories` page into the Settings page, so users manage categories where they manage their other preferences. The old `/categories` route becomes a permanent (301) redirect to `/settings` so existing bookmarks and deep links don't break. The redundant "Categories" top-nav link is removed. No backend, API, data model, or business-logic changes — the existing `CategoriesManager` island is simply rendered inside `settings.astro`.

## Current State Analysis

- **`src/pages/categories.astro`** — loads categories via `listCategories(supabase, user.id)` and renders `<CategoriesManager initialCategories={categories} client:load />` inside a glass card with a "Categories" `<h1>`.
- **`src/pages/settings.astro`** — loads user settings via `getOrCreateUserSettings` and renders `<SettingsForm initialSettings={settings} client:load />` inside a glass card with a "Settings" `<h1>`. This is the target page.
- **`src/components/categories/CategoriesManager.tsx`** — a fully self-contained `client:load` React island: holds category state, opens add/edit dialogs, and does all CRUD against `/api/categories` (POST/PATCH/`[id]` DELETE). It takes only `initialCategories` and needs no other wiring. Nothing about it is page-specific.
- **`src/components/settings/SettingsForm.tsx`** — the currency form island; unchanged by this work.
- **`src/components/Topbar.astro:27`** — renders nav links to `/dashboard`, `/expenses`, `/categories`, `/settings`, plus sign-out. Active state keys off `pathname`.
- **`src/middleware.ts:4`** — `PROTECTED_ROUTES = ["/dashboard", "/categories", "/expenses", "/settings"]`; unauthenticated hits redirect to `/auth/signin`. Runs before page render.
- **`src/layouts/Layout.astro`** — wraps every page, renders `Topbar` and a `title`.
- **E2E dependence on the old route** — `tests/e2e/nav-reachability.spec.ts`, `categories-add-new.spec.ts`, `categories-duplicate-blocked.spec.ts`, and `categories-view-defaults.spec.ts` navigate to `/categories`, click a "Categories" nav link, and assert a "Categories" heading and a `/categories` URL. These break once the page moves and the nav link is removed.

## Desired End State

- Visiting `/settings` shows two labeled sections in one card: **Currency** (first) then **Categories** (second, the full add/edit/delete manager).
- Visiting `/categories` issues an HTTP 301 redirect to `/settings`.
- The top nav no longer shows a "Categories" item; category management is reached via Settings.
- All existing E2E specs pass against the new layout, and a new assertion verifies the `/categories → /settings` redirect.

Verify by: opening `/settings` and adding/editing/deleting a category successfully; requesting `/categories` and observing a 301 to `/settings`; confirming the nav shows Dashboard / Add Expense / Settings (no Categories); running the E2E suite green.

### Key Discoveries:

- `CategoriesManager` is drop-in — same props on either page (`src/components/categories/CategoriesManager.tsx:14`), so relocation is pure Astro-template wiring, no React changes.
- Both `categories.astro` and `settings.astro` already load their data server-side with the same `createClient` + service pattern (`src/pages/categories.astro:8-9`, `src/pages/settings.astro:8-9`) — the merged page just runs both loads.
- Middleware protects a route by `startsWith` (`src/middleware.ts:18`); a redirecting `/categories` stub kept in `PROTECTED_ROUTES` still auth-gates before redirecting, preserving today's behavior for unauthenticated visitors.
- E2E helpers navigate categories via the nav link and the `/categories` URL (`tests/e2e/nav-reachability.spec.ts:21`, `categories-add-new.spec.ts:14`) — these are the assertions to retarget.

## What We're NOT Doing

- No changes to category CRUD, `/api/categories`, the `categories` table, RLS, or any service in `src/lib/services/`.
- No changes to `SettingsForm` or the currency feature.
- No i18n/Polish string work (that's S-11, separate).
- No new "Categories" nav affordance pointing at Settings — the link is removed, not repointed.
- No deletion of the `categories.astro` file — it is repurposed as a redirect stub (route stays in the app for the redirect).

## Implementation Approach

Two phases. Phase 1 does the whole functional move: compose the Settings page from the two existing islands, turn the old route into a 301 redirect, and drop the nav link. Phase 2 aligns the E2E suite with the new route contract and adds explicit redirect coverage (the FR-023 guardrail). Because the manager island is unchanged, risk is confined to template wiring and test assertions.

## Phase 1: Relocate categories into Settings, redirect old route, trim nav

### Overview

The Settings page renders both the currency form and the category manager under section headings; `/categories` redirects to `/settings`; the nav loses its "Categories" item.

### Changes Required:

#### 1. Compose the Settings page

**File**: `src/pages/settings.astro`

**Intent**: Load categories alongside settings and render `CategoriesManager` as a second section beneath the currency form, so all category management lives here. Keep the existing single glass card; introduce an `<h2>` for each section ("Currency" first, "Categories" second) since the card's `<h1>` remains "Settings".

**Contract**: Add the imports for `CategoriesManager` and `listCategories` (mirroring `categories.astro:3,5`); in the frontmatter load `const categories = supabase && user ? await listCategories(supabase, user.id) : []` next to the existing settings load; in the template wrap the current `SettingsForm` under an `<h2>Currency</h2>` section and add an `<h2>Categories</h2>` section rendering `<CategoriesManager initialCategories={categories} client:load />`. Reuse the existing section spacing/typography classes already in the card.

#### 2. Redirect the old route

**File**: `src/pages/categories.astro`

**Intent**: Replace the page's contents with a permanent server-side redirect to Settings so bookmarks and deep links resolve to the new home. The route file stays so the redirect is discoverable and SSR-native.

**Contract**: Frontmatter-only Astro page returning `Astro.redirect("/settings", 301)`; remove the old `Layout`/`CategoriesManager` markup and the categories data load. No template body.

#### 3. Remove the Categories nav link

**File**: `src/components/Topbar.astro`

**Intent**: Drop the now-redundant "Categories" nav item; categories are reached via Settings. Leave Dashboard, Add Expense, Settings, and Sign out intact.

**Contract**: Delete the `<a href="/categories" …>Categories</a>` list item (`Topbar.astro:27-29`). No change to the `linkClass` helper or other links.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run build` (Astro type-check runs in build)
- Linting passes: `npm run lint`
- Unit/integration suite passes: `npm run test`

#### Manual Verification:

- `/settings` shows a "Currency" section then a "Categories" section; adding, editing, and deleting a category all work in place.
- Requesting `/categories` returns 301 and lands on `/settings` (check via browser network tab or `curl -I`).
- The top nav shows Dashboard / Add Expense / Settings / Sign out — no "Categories".
- No console errors on `/settings`; both islands hydrate.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Update E2E suite for the new route contract

### Overview

Retarget the category E2E specs to reach categories via Settings, fix the nav-reachability expectations, and add an explicit redirect assertion for `/categories → /settings`.

### Changes Required:

#### 1. Retarget category management specs

**File**: `tests/e2e/categories-add-new.spec.ts`, `tests/e2e/categories-duplicate-blocked.spec.ts`, `tests/e2e/categories-view-defaults.spec.ts`

**Intent**: Reach the category manager through Settings instead of the old page, keeping each test's actual behavior (add / duplicate-blocked / defaults) unchanged. Navigate via the "Settings" nav link or `/settings`, then operate on the Categories section.

**Contract**: Replace navigation-to-`/categories` and any `getByRole("link", { name: "Categories" })` with a Settings entry point (`/settings` goto or "Settings" nav link); update URL assertions from `/\/categories$/` to `/\/settings$/`; scope category assertions to the Categories section (e.g. locate via the `Your categories` heading rendered by `CategoriesManager`) so they don't collide with the Currency section. Keep locators role/label/text-based per project rules; unique timestamped ids preserved.

#### 2. Fix nav-reachability expectations

**File**: `tests/e2e/nav-reachability.spec.ts`

**Intent**: The nav no longer has a "Categories" link and `/categories` is a redirect; update the reachability assertions so categories are reachable via Settings, and remove assertions that a "Categories" nav link exists.

**Contract**: Drop `getByRole("link", { name: "Categories" })` clicks and `/\/categories$/` URL expectations; assert the Categories section is reachable from the Settings page instead. Keep the Dashboard/Expenses/Settings reachability checks.

#### 3. Add redirect coverage

**File**: `tests/e2e/nav-reachability.spec.ts` (or a small dedicated spec)

**Intent**: Lock in the FR-023 guardrail — an authenticated `page.goto("/categories")` must end on `/settings`.

**Contract**: A test that navigates to `/categories` and asserts `await expect(page).toHaveURL(/\/settings$/)` (Playwright follows the 301). Reuse the existing signed-in setup helper.

### Success Criteria:

#### Automated Verification:

- E2E suite passes: `npm run test:e2e` (or the project's Playwright command)
- Linting passes: `npm run lint`

#### Manual Verification:

- The retargeted specs exercise the Categories section inside Settings, not a standalone page.
- The redirect test fails if the 301 is removed (spot-check by temporarily reverting the redirect locally, optional).

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human before considering the change done.

---

## Testing Strategy

### Unit Tests:

- No new unit tests required — no logic changes. Existing `src/lib/services/categories.test.ts` continues to cover CRUD.

### Integration Tests:

- Existing integration tests are unaffected (they hit the API/service layer, not the page routes).

### Manual Testing Steps:

1. Sign in, open `/settings`; confirm Currency then Categories sections render.
2. Add a category in the Categories section; confirm it appears in the list.
3. Edit and delete a category; confirm both persist across reload.
4. In the browser network tab, request `/categories`; confirm 301 → `/settings`.
5. Confirm the nav has no "Categories" item and Settings is highlighted when active.

## Performance Considerations

Negligible. The Settings page now runs two lightweight server-side data loads (settings + categories) instead of one; both were already run on their respective pages. Two small islands hydrate instead of one.

## Migration Notes

No data migration. The only migration concern is external bookmarks/links to `/categories`, handled by the 301 redirect.

## References

- Roadmap slice: `context/foundation/roadmap.md` (S-14)
- PRD requirement: `context/foundation/prd.md` (FR-023)
- Existing island being relocated: `src/components/categories/CategoriesManager.tsx:14`
- Target page: `src/pages/settings.astro`
- Source page (becomes redirect): `src/pages/categories.astro`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Relocate categories into Settings, redirect old route, trim nav

#### Automated

- [x] 1.1 Type checking passes: `npm run build` — f58304e
- [x] 1.2 Linting passes: `npm run lint` — f58304e
- [x] 1.3 Unit/integration suite passes: `npm run test` — f58304e

#### Manual

- [x] 1.4 `/settings` shows Currency then Categories sections; add/edit/delete all work in place — f58304e
- [x] 1.5 `/categories` returns 301 and lands on `/settings` — f58304e
- [x] 1.6 Top nav shows Dashboard / Add Expense / Settings / Sign out — no "Categories" — f58304e
- [x] 1.7 No console errors on `/settings`; both islands hydrate — f58304e

### Phase 2: Update E2E suite for the new route contract

#### Automated

- [x] 2.1 E2E suite passes: `npm run test:e2e` — 784186d
- [x] 2.2 Linting passes: `npm run lint` — 784186d

#### Manual

- [x] 2.3 Retargeted specs exercise the Categories section inside Settings, not a standalone page — 784186d
- [x] 2.4 Redirect test fails if the 301 is removed (optional spot-check) — 784186d
