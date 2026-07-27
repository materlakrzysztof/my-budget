---
change_id: categories-in-settings
title: Move category management into Settings (+ redirect)
status: implementing
created: 2026-07-27
updated: 2026-07-27
archived_at: null
---

## Notes

Roadmap S-14 (iteration 3, UX & navigation stream). PRD v4: FR-023 — user manages categories (add/edit/delete) from within Settings rather than a standalone page; a redirect from the old `/categories` route is preferred so bookmarks don't break. No new data model, API, or business logic — relocates the existing `CategoriesManager` island into `settings.astro`, 301-redirects `/categories → /settings`, removes the redundant nav link, and updates the E2E suite.
