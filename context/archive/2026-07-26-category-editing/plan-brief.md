# Category Editing & Deletion (FR-004) — Plan Brief

> Full plan: `context/changes/category-editing/plan.md`

## What & Why

Let a user edit a category's name and description, and delete a category, from the Categories page. FR-004 (parked in the roadmap) asked for editing; delete was added during planning to round out category CRUD. Categories currently support only view + create — this closes the gap using the same pattern already proven for editing expenses.

## Starting Point

Categories have a `list` + `create` service, a `GET`/`POST` API route, and a presentational list where each row is a drill-down link to its expenses (S-06). There is **no** update/delete anywhere — and, critically, **no UPDATE or DELETE RLS policy** on the `categories` table, so any update/delete silently affects 0 rows until new policies are added.

## Desired End State

On `/categories`, each row (default or user-created) has an **Edit** button that loads the shared form pre-filled for saving, and a **Delete** button with an inline confirm. Renaming into another category's name reuses the existing red duplicate warning. Deleting a category that still has expenses is blocked with a clear "in use" message (never cascades). The existing drill-down link keeps working.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Edit UX | Reuse the create form as a shared create/edit form | Least duplicated JSX; one form for both modes | Plan |
| Row affordance | Separate Edit button beside the existing drill-down link | Preserves the S-06 drill-down interaction intact | Plan |
| Default categories | Editable/deletable like any other | Defaults are ordinary user-owned rows; no `is_default` flag needed | Plan |
| Delete scope | Included (beyond FR-004) | User asked to round out CRUD | Plan |
| Delete + expenses | Block via FK `restrict` → 409 "in use" | FK is `on delete restrict`; must not cascade-wipe expenses | Plan |
| Delete confirm UX | Inline two-click confirm | Avoids native `confirm()` and a new Dialog component | Plan |
| Rename collision | Reuse `DuplicateCategoryError` → 409 alert; no-op self-save allowed | Server/unique-index is authoritative; matches create flow | Plan |

## Scope

**In scope:** edit name/description; delete (restricted when in use); RLS update+delete policies; `PATCH`/`DELETE /api/categories/[id]`; shared create/edit form; per-row Edit + Delete controls.

**Out of scope:** protecting/ flagging default categories; cascade delete or expense reassignment; native confirm dialog / new Dialog component; bulk actions, reordering, colors/icons; any change to the create contract.

## Architecture / Approach

Bottom-up, mirroring the expenses edit stack: (1) RLS migration + `updateCategory`/`deleteCategory` service with typed errors (`CategoryNotFoundError`, `CategoryInUseError`) reusing the existing 23505→duplicate mapping; (2) a new `api/categories/[id].ts` `PATCH`+`DELETE` route mapping errors to 404/409/400; (3) UI — generalize `AddCategoryForm` into a create/edit form, add Edit + inline-confirm Delete buttons to `CategoryList` rows, wire edit-target state and handlers in `CategoriesManager`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Data & service | RLS update/delete policies + `updateCategory`/`deleteCategory` + unit tests | Missing RLS policy → silent 0-row no-op |
| 2. API route | `PATCH`/`DELETE /api/categories/[id]` with error→HTTP mapping | Mis-mapping `23503` (in-use) vs 404 |
| 3. Frontend | Shared edit form + per-row Edit/Delete coexisting with drill-down | Breaking the S-06 drill-down link or create flow |

**Prerequisites:** none — all touched files exist; local Supabase for migration testing.
**Estimated effort:** ~1–2 sessions across 3 phases.

## Open Risks & Assumptions

- Assumes local Supabase (`npx supabase db reset`) is available to verify the migration; otherwise Phase 1 manual check relies on CI migration-safety.
- Assumes no integration test currently asserts categories are immutable; if one does, it must be updated.

## Success Criteria (Summary)

- A user can rename/edit-description any category and see it update in place, with the duplicate warning on collisions.
- A user can delete an unused category; deleting an in-use one is blocked with a clear message and no data loss.
- The existing category → expenses drill-down and the create flow are unchanged.
