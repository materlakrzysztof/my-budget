# Category Editing & Deletion (FR-004) Implementation Plan

## Overview

Let a user edit a category's name and description, and delete a category, from the Categories page. Today categories support only **view** and **create**; FR-004 (parked in `roadmap.md`) asks for editing, and delete was added to round out category CRUD during planning. The work mirrors the existing expense-edit pattern (`api/expenses/[id].ts` + `updateExpense`/`deleteExpense`) applied to the `categories` table, and reuses the existing duplicate-name warning for renames.

## Current State Analysis

- **Service** (`src/lib/services/categories.ts`) exposes only `listCategories` and `createCategory`. `createCategory` already maps a `23505` unique-violation to `DuplicateCategoryError` by re-selecting and finding the conflicting row — the exact logic a rename needs.
- **API** (`src/pages/api/categories.ts`) exports only `GET` / `POST`. There is **no** `src/pages/api/categories/[id].ts` (expenses has one; categories does not).
- **RLS** (`supabase/migrations/20260721120000_create_categories.sql`) defines only `categories_select_own` and `categories_insert_own`. **There is no UPDATE or DELETE policy** — without new policies, an authenticated update/delete matches 0 rows and silently no-ops. This is the single most important gap.
- **Uniqueness** is enforced by `categories_user_id_normalized_name_key` on `(user_id, lower(trim(name)))`. On update it naturally excludes the row's own current name, so a no-op self-save (same name, or description-only change) does **not** trip the constraint.
- **Delete constraint**: `expenses.expenses_user_category_fk` references `categories(user_id, id)` **`on delete restrict`** (`supabase/migrations/20260722090000_create_expenses.sql:10`). Deleting a category that still has expenses raises Postgres `23503`; deletion must be blocked with a clear message, never cascade.
- **Frontend**: `CategoryList.tsx` renders each category as a full-width drill-down `<a href="/expenses?category=id">` (from S-06) — presentational, stateless. `AddCategoryForm.tsx` holds name/description fields, client-side required validation, and renders `DuplicateCategoryAlert`. `CategoriesManager.tsx` owns `categories` state and the create handler.
- **Proven template to mirror**: `updateExpense` (`src/lib/services/expenses.ts:159`) uses `.update().eq("id",…).eq("user_id",…).select(…).maybeSingle()` and throws `ExpenseNotFoundError` on null `data`; `deleteExpense` (`:179`) uses `.delete()…select("id").maybeSingle()` the same way; `api/expenses/[id].ts` maps error classes to 404/409/422.

## Desired End State

On the Categories page the user can:

- Click **Edit** on any category row (default or user-created) → the shared form loads with that category's current name/description → Save persists the change and the list updates in place.
- Rename a category to a name that collides with another of their categories → the existing red duplicate warning appears; the category is unchanged. Saving with the name unchanged (or only editing the description) succeeds without a false duplicate warning.
- Click **Delete** on a category with no expenses → inline confirm → the row disappears.
- Click **Delete** on a category that still has expenses → a clear "category is in use" message; the category and its expenses are untouched.
- The existing drill-down link (row → `/expenses?category=id`) continues to work exactly as before.

Verify: `npm run lint`, `npm run build`, the categories unit suite, and the manual steps in Testing Strategy all pass.

### Key Discoveries:

- No UPDATE/DELETE RLS policy on `categories` — new migration mandatory (`supabase/migrations/20260721120000_create_categories.sql`).
- FK is `on delete restrict` — delete-with-expenses must map `23503` → 409, not cascade (`supabase/migrations/20260722090000_create_expenses.sql:10`).
- Duplicate mapping already exists in `createCategory` and should be factored into a shared helper reused by `updateCategory` (`src/lib/services/categories.ts:86`).
- Edit/delete route + service pattern already exists for expenses and should be copied 1:1 (`src/pages/api/expenses/[id].ts`, `src/lib/services/expenses.ts:159`).

## What We're NOT Doing

- **No new "is_default" flag / no protecting seeded categories** — all categories are editable and deletable identically (decision: defaults are ordinary user-owned rows).
- **No cascade delete of expenses** — deletion is restricted when expenses exist; we do not offer "delete category and its expenses" or reassignment in this change.
- **No native `window.confirm()` dialog and no new shadcn Dialog component** — delete uses a lightweight inline two-click confirm (Delete → Confirm/Cancel) within the row.
- **No bulk edit/delete, no reordering, no category color/icon** — out of scope for FR-004.
- **No change to the create flow's contract** — create keeps working exactly as today; the form is generalized, not replaced.

## Implementation Approach

Build bottom-up in the same order the codebase already establishes for expenses: RLS + service (with unit tests) → API route → UI. Each layer is independently verifiable. The service layer is where the two real risks live (duplicate-on-rename mapping and delete-restrict mapping), so it lands first with unit coverage; the API and UI are thin wiring on top.

## Critical Implementation Details

- **Delete error disambiguation**: a `23503` on category delete is the only signal that expenses still reference it; map it to a dedicated `CategoryInUseError` (→ 409) so the UI can show an actionable message, distinct from a 404 (not found) or a generic 500.
- **No-op self-save must not false-positive**: because the unique index is over `(user_id, lower(trim(name)))` and an UPDATE that keeps the same normalized name does not violate it, no special client guard is needed — the server is authoritative. Do not add a client-side "did the name change?" check; it would diverge from the create flow.

## Phase 1: Data & Service Layer

### Overview

Add UPDATE + DELETE RLS policies and the `updateCategory` / `deleteCategory` service functions with typed errors, plus unit tests for the new logic.

### Changes Required:

#### 1. RLS migration

**File**: `supabase/migrations/<YYYYMMDDHHmmss>_add_category_update_delete_policies.sql` (new, timestamp per repo naming convention, ordered after existing migrations)

**Intent**: Grant authenticated users the ability to update and delete their own category rows; without these, service updates/deletes silently affect 0 rows.

**Contract**: Two policies on `public.categories`:
- `categories_update_own` — `for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)`
- `categories_delete_own` — `for delete to authenticated using (auth.uid() = user_id)`

(Mirror the wording of `expenses_update_own` / `expenses_delete_own` in `20260722090000_create_expenses.sql:21`. No schema/column change; the FK `on delete restrict` already provides the guard for delete.)

#### 2. Category service — update & delete

**File**: `src/lib/services/categories.ts`

**Intent**: Add an `updateCategory` and a `deleteCategory` mirroring `updateExpense`/`deleteExpense`, reuse the existing duplicate mapping for renames, and add typed errors for the new failure modes.

**Contract**:
- `export const updateCategorySchema = createCategorySchema;` (name + description, same rules).
- New error classes: `CategoryNotFoundError` (message "Category not found.") and `CategoryInUseError` (message names that the category still has expenses).
- Factor the existing 23505→`DuplicateCategoryError` block out of `createCategory` into a private helper `throwDuplicate(supabase, userId, name)` and call it from both create and update.
- `updateCategory(supabase, userId, id, input: UpdateCategoryRequest): Promise<Category>` — `.from("categories").update({ name, description }).eq("id", id).eq("user_id", userId).select("id, name, description, created_at").maybeSingle()`; on `23505` → duplicate helper; on `null` data → `CategoryNotFoundError`.
- `deleteCategory(supabase, userId, id): Promise<void>` — `.delete().eq("id", id).eq("user_id", userId).select("id").maybeSingle()`; on error code `23503` → `CategoryInUseError`; on `null` data → `CategoryNotFoundError`. (Define `FK_VIOLATION = "23503"` constant.)

#### 3. Shared types

**File**: `src/types.ts`

**Intent**: Add the request type for updates.

**Contract**: `export interface UpdateCategoryRequest extends CreateCategoryRequest {}` (or a type alias). The PATCH response reuses the existing `{ category: Category }` shape (`CreateCategoryResponse`).

#### 4. Service unit tests

**File**: `src/lib/services/categories.test.ts`

**Intent**: Cover the new pure/error logic added in this phase without a live DB.

**Contract**: Add tests for `CategoryNotFoundError` and `CategoryInUseError` message/`name` (mirroring the existing `DuplicateCategoryError` test), and confirm `updateCategorySchema` validates/rejects the same cases `createCategorySchema` does.

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly against a fresh local DB: `npx supabase db reset` (or the repo's migration-safety check)
- Unit tests pass: `npm run test` (or the project's vitest command)
- Type checking passes: `npm run build` typecheck / `npx astro check`
- Linting passes: `npm run lint`

#### Manual Verification:

- Applying the migration on a DB that already has categories does not error and does not alter existing rows.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding.

---

## Phase 2: API Route

### Overview

Expose the new service functions via a RESTful `[id]` route mirroring the expenses route.

### Changes Required:

#### 1. Category item route

**File**: `src/pages/api/categories/[id].ts` (new)

**Intent**: Provide `PATCH` (edit name/description) and `DELETE` for a single category, with auth guard and typed-error → HTTP mapping, mirroring `src/pages/api/expenses/[id].ts`.

**Contract**:
- `export const prerender = false;`
- `PATCH`: 401 if no `context.locals.user`; parse body with `updateCategorySchema` (400 on failure); call `updateCategory(...)`; return `{ category }` at 200. Map `DuplicateCategoryError` → 409, `CategoryNotFoundError` → 404; rethrow others.
- `DELETE`: 401 if unauthenticated; call `deleteCategory(...)`; return `204` with null body. Map `CategoryInUseError` → 409, `CategoryNotFoundError` → 404; rethrow others.
- Reuse the local `json(body, status)` helper pattern from the sibling route.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run build` / `npx astro check`
- Linting passes: `npm run lint`
- Existing integration/unit suites still pass: `npm run test`

#### Manual Verification:

- `PATCH /api/categories/<id>` with a new name updates and returns the row (200).
- `PATCH` with a name colliding with another category returns 409 and the duplicate message.
- `PATCH` with an unknown id returns 404.
- `DELETE /api/categories/<id>` on a category with no expenses returns 204.
- `DELETE` on a category that has expenses returns 409 with the in-use message; the expenses remain.

**Implementation Note**: Pause for manual confirmation before proceeding.

---

## Phase 3: Frontend Edit/Delete UX

### Overview

Generalize the create form into a shared create/edit form, add per-row Edit and Delete controls that coexist with the drill-down link, and wire the handlers in `CategoriesManager`.

### Changes Required:

#### 1. Shared create/edit form

**File**: `src/components/categories/AddCategoryForm.tsx` (generalize; rename to `CategoryForm.tsx` optional)

**Intent**: Support an "edit" mode where the form is pre-populated with an existing category and submitting calls the update handler, while preserving the existing create behavior when no category is being edited.

**Contract**: Accept the editing target and both handlers, e.g. `editing: Category | null`, `onCreate`, `onUpdate(id, input)`, `onCancelEdit`. When `editing` is set, initialize name/description from it, switch the submit button to "Save changes", and show a Cancel control; on submit route to `onUpdate` vs `onCreate` by mode. Keep the existing required-field validation and `DuplicateCategoryAlert`. Reset fields after a successful create as today; after a successful update, exit edit mode.

#### 2. Category list rows — Edit + Delete controls

**File**: `src/components/categories/CategoryList.tsx`

**Intent**: Add an Edit (pencil) button and a Delete button to each row without removing the existing S-06 drill-down link, using an inline two-click delete confirm.

**Contract**: Row becomes a flex layout: the existing `<a>` drill-down (unchanged target) plus an Edit button (calls `onEdit(category)`) and a Delete button. Delete uses local per-row confirm state — first click reveals Confirm/Cancel; Confirm calls `onDelete(category.id)`. New props: `onEdit(category)`, `onDelete(id)`. Buttons use `getByRole`-friendly accessible names ("Edit <name>", "Delete <name>"). No native `confirm()`.

#### 3. Manager wiring

**File**: `src/components/categories/CategoriesManager.tsx`

**Intent**: Own edit-target state and the update/delete handlers, threading them to the list and form.

**Contract**: Add `editing: Category | null` state and `handleUpdate(id, input)` (`PATCH /api/categories/<id>`; on 409 set `duplicateError`; on ok replace the row in `categories` and clear editing) and `handleDelete(id)` (`DELETE /api/categories/<id>`; on ok remove from `categories`; on 409 surface the in-use message to the user). Pass `onEdit`/`onDelete` to `CategoryList` and `editing`/`onUpdate`/`onCancelEdit` to the form. Clear `duplicateError` when switching edit target.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run build` / `npx astro check`
- Linting passes: `npm run lint`
- Production build succeeds: `npm run build`

#### Manual Verification:

- Editing a category's name and saving updates it in the list without a page reload.
- Editing only the description (name unchanged) saves with no false duplicate warning.
- Renaming to another category's name shows the red duplicate alert; the row is unchanged.
- Deleting a category with no expenses removes it after the inline confirm.
- Deleting a category that has expenses shows the in-use message and leaves both category and expenses intact.
- The drill-down link still navigates to the category's filtered expenses.
- Editing works on a default (seeded) category as well as a user-created one.

**Implementation Note**: Final phase — after automated + manual verification, the change is ready for `/10x-impl-review`.

---

## Testing Strategy

### Unit Tests:

- New error classes (`CategoryNotFoundError`, `CategoryInUseError`) carry the right `name`/`message`.
- `updateCategorySchema` accepts/rejects the same inputs as `createCategorySchema`.
- Existing `normalizeCategoryName` / `DuplicateCategoryError` tests remain green.

### Integration Tests:

- If the repo's integration suite covers categories, add update/delete happy-path + duplicate-rename (409) + delete-in-use (409) cases mirroring the expense integration tests; otherwise rely on the manual API checks in Phase 2.

### Manual Testing Steps:

1. Sign in, open `/categories`.
2. Edit "Groceries" → rename to "Food"; confirm the list updates.
3. Edit "Food" again, change only the description; save; confirm no duplicate warning.
4. Rename "Transport" to "Food"; confirm the duplicate alert appears and Transport is unchanged.
5. Add a throwaway category, then delete it via the inline confirm; confirm it disappears.
6. Log an expense under a category, then try to delete that category; confirm the in-use message and that the expense survives.
7. Click a category's drill-down link; confirm it still opens the filtered expenses view.

## Performance Considerations

Negligible — single-row update/delete by primary key under RLS, and a list that is already fully loaded client-side. No new N+1 or query hotspots.

## Migration Notes

The new migration only adds RLS policies; it is additive and safe on an existing database with data. No backfill. Rollback is dropping the two policies.

## References

- Change identity: `context/changes/category-editing/change.md`
- Mirror pattern (API): `src/pages/api/expenses/[id].ts`
- Mirror pattern (service): `src/lib/services/expenses.ts:159` (`updateExpense`), `:179` (`deleteExpense`)
- Existing category service: `src/lib/services/categories.ts:75` (`createCategory` duplicate mapping)
- RLS baseline: `supabase/migrations/20260721120000_create_categories.sql`
- FK restrict constraint: `supabase/migrations/20260722090000_create_expenses.sql:10`
- Roadmap parked item: `context/foundation/roadmap.md` §Parked (FR-004)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Data & Service Layer

#### Automated

- [x] 1.1 Migration applies cleanly against a fresh local DB — 78bebc9
- [x] 1.2 Unit tests pass — 78bebc9
- [x] 1.3 Type checking passes — 78bebc9
- [x] 1.4 Linting passes — 78bebc9

#### Manual

- [x] 1.5 Migration on a DB with existing categories does not error or alter existing rows — 78bebc9

### Phase 2: API Route

#### Automated

- [x] 2.1 Type checking passes — ca3d59a
- [x] 2.2 Linting passes — ca3d59a
- [x] 2.3 Existing integration/unit suites still pass — ca3d59a

#### Manual

- [x] 2.4 PATCH with a new name updates and returns the row (200) — ca3d59a
- [x] 2.5 PATCH with a colliding name returns 409 + duplicate message — ca3d59a
- [x] 2.6 PATCH with an unknown id returns 404 — ca3d59a
- [x] 2.7 DELETE on a category with no expenses returns 204 — ca3d59a
- [x] 2.8 DELETE on a category with expenses returns 409 + in-use message; expenses remain — ca3d59a

### Phase 3: Frontend Edit/Delete UX

#### Automated

- [x] 3.1 Type checking passes
- [x] 3.2 Linting passes
- [x] 3.3 Production build succeeds

#### Manual

- [x] 3.4 Editing a name and saving updates the list without reload
- [x] 3.5 Editing only the description saves with no false duplicate warning
- [x] 3.6 Renaming to an existing name shows the duplicate alert; row unchanged
- [x] 3.7 Deleting a category with no expenses removes it after inline confirm
- [x] 3.8 Deleting a category with expenses shows in-use message; both survive
- [x] 3.9 Drill-down link still navigates to filtered expenses
- [x] 3.10 Editing works on a default (seeded) category
