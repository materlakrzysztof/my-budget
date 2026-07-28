# Category Management in Settings (FR-023) — Plan Brief

> Full plan: `context/changes/categories-in-settings/plan.md`

## What & Why

Category management lives on its own `/categories` page today, adding a top-nav item and a navigation hop for a preference-like task. This change moves add/edit/delete into the Settings page and 301-redirects the old route so bookmarks keep working. Addresses the roadmap's navigation-friction theme (S-14, FR-023).

## Starting Point

The `CategoriesManager` React island (`src/components/categories/CategoriesManager.tsx`) already does all CRUD against `/api/categories` and is rendered on a standalone `/categories` page. Settings (`src/pages/settings.astro`) already renders the currency form the same way. Both pages load their data server-side with the identical `createClient` + service pattern.

## Desired End State

`/settings` shows one card with a **Currency** section then a **Categories** section (the full manager). `/categories` permanently redirects to `/settings`. The top nav drops the "Categories" item. The E2E suite reaches categories via Settings and asserts the redirect.

## Key Decisions Made

| Decision            | Choice                                   | Why (1 sentence)                                                        | Source |
| ------------------- | ---------------------------------------- | ---------------------------------------------------------------------- | ------ |
| Redirect mechanism  | Server 301 stub in `categories.astro`    | Simplest, SSR-native, one file; permanent so caches/bookmarks re-point. | Plan   |
| Settings layout     | One card, two `<h2>` sections (Currency, then Categories) | Matches existing card structure; minimal markup, one scannable page.    | Plan   |
| Nav treatment       | Remove the "Categories" link             | Reflects the new IA — categories are a Settings concern now.            | Plan   |
| Test scope          | Retarget specs + add a redirect test     | Keeps the suite green and verifies the FR-023 redirect guardrail.       | Plan   |

## Scope

**In scope:**

- Render `CategoriesManager` inside `settings.astro` under a "Categories" section
- 301 redirect `/categories → /settings`
- Remove the "Categories" nav link from `Topbar.astro`
- Update the 4 category E2E specs + nav-reachability; add a redirect assertion

**Out of scope:**

- Any change to category CRUD, `/api/categories`, the table, RLS, or services
- Changes to the currency feature / `SettingsForm`
- i18n/Polish strings (S-11)
- Deleting `categories.astro` (repurposed as the redirect stub)

## Architecture / Approach

Pure wiring: the unchanged manager island is composed into the Settings page next to the currency form (two server-side loads, two hydrated islands). The old route file is reduced to `Astro.redirect("/settings", 301)`. Middleware is untouched — keeping `/categories` in `PROTECTED_ROUTES` preserves auth-gating before the redirect. Tests follow the new route contract.

## Phases at a Glance

| Phase                                        | What it delivers                                              | Key risk                                                        |
| -------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------- |
| 1. Relocate + redirect + trim nav            | Categories under Settings; `/categories` 301s; nav link gone   | Two islands must both hydrate cleanly; section headings clear   |
| 2. Update E2E suite for the new route        | Specs reach categories via Settings; redirect asserted         | Retargeting ~5 spec files without weakening existing assertions |

**Prerequisites:** None — all API/data/auth layers already present.
**Estimated effort:** ~1 session across 2 phases.

## Open Risks & Assumptions

- Assumes `CategoriesManager` needs no props beyond `initialCategories` (confirmed at `CategoriesManager.tsx:14`).
- Assumes the Settings card comfortably holds both sections; if categories grow long the page scrolls (same as the old standalone page did).
- E2E retargeting must scope category assertions to the Categories section so they don't collide with the Currency section on the shared page.

## Success Criteria (Summary)

- A user manages categories entirely from `/settings`; add/edit/delete work in place.
- An old `/categories` bookmark lands on `/settings` (301).
- The nav no longer advertises a separate Categories page, and the E2E suite is green including redirect coverage.
