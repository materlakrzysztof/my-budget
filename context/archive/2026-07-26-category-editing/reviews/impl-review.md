<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Category Editing & Deletion (FR-004)

- **Plan**: context/changes/category-editing/plan.md
- **Scope**: All phases (1–3 of 3)
- **Date**: 2026-07-27
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 1 observation

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | WARNING |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | WARNING |
| Success Criteria    | PASS    |

Automated success criteria all pass: `npm run lint` (clean), `npm run test:unit` (47 passed), `npm run test:schema-safety` (8 passed), `npm run build` (completes). All Manual Progress items are checked with commit evidence and are corroborated by updated E2E specs.

## Findings

### F1 — Phase 3 form built as a shadcn Dialog modal, explicitly excluded by the plan

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Scope Discipline
- **Location**: src/components/categories/CategoryFormDialog.tsx
- **Detail**: The plan's "What We're NOT Doing" states: _"No native window.confirm() dialog and no new shadcn Dialog component."_ Phase 3 planned to **generalize the inline `AddCategoryForm.tsx`** into a shared create/edit form. Instead `AddCategoryForm.tsx` was deleted and replaced by a new `CategoryFormDialog.tsx` built on the shadcn `Dialog` component, and `CategoriesManager` was restructured around a `dialogMode` state machine. The deviation is deliberate and documented in commit 799e552 (attributed to user feedback during verification, to match the existing expenses edit UX). The desired end-state capabilities are all delivered and tested; the inline two-click delete (`CategoryList.tsx`) was honored as planned. No _new_ shadcn component was installed — `src/components/ui/dialog.tsx` already existed — but the modal pattern the plan ruled out was introduced to this flow. The downstream E2E edits (`categories-add-new.spec.ts`, `categories-duplicate-blocked.spec.ts`, `helpers.ts`) exist only to drive the modal.
- **Fix A ⭐ Recommended**: Document the deviation in the plan as an addendum (note the inline-form → Dialog switch and the reason), so the plan stays the source of truth.
  - Strength: Preserves shipped, tested work; the modal genuinely matches the existing expenses UX, improving consistency over the planned inline form.
  - Tradeoff: The "What We're NOT Doing" guardrail is retroactively relaxed rather than honored.
  - Confidence: HIGH — the code is complete, green, and consistent with `ExpenseFormDialog`.
  - Blind spot: Whoever set the "no Dialog" constraint isn't notified of the reversal.
- **Fix B**: Revert to the planned inline generalized form.
  - Strength: Honors the original scope guardrail strictly.
  - Tradeoff: Discards working, tested UI and diverges from the expenses edit pattern the rest of the app now uses.
  - Confidence: MEDIUM — reintroduces an inline-form/E2E rewrite for little user-facing benefit.
  - Blind spot: Whether the "no Dialog" line was a hard product constraint or just a default assumption.
- **Decision**: FIXED via Fix A — plan addendum A1 added documenting the modal deviation.

### F2 — Failed delete (non-409) throws with no user feedback

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/categories/CategoriesManager.tsx:79-81
- **Detail**: On any non-409 delete failure (404, 500, network) `handleDelete` does `throw new Error("Failed to delete category")`. That rejection propagates up through `CategoryList.handleConfirmDelete` (CategoryList.tsx:22-30), whose `try/finally` only resets `deletingId`/`confirmingId` and re-throws — so the failure becomes an unhandled promise rejection and the user sees no on-screen message. The sibling `ExpensesManager.handleConfirmDelete` instead sets a `serverError` message and treats an already-gone row as success. The 409 (in-use) path here is correct; only the fallthrough failure path is unhandled.
- **Fix**: Mirror the expenses pattern — on `!response.ok` set `listError` ("Failed to delete category. Please try again.") and return instead of throwing; optionally treat 404 as a successful removal from the list.
- **Decision**: FIXED — non-409 failures now set `listError`; 404 treated as successful removal (CategoriesManager.tsx:79-85).

### F3 — Submit/delete fetch calls not wrapped for network failure

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/categories/CategoriesManager.tsx:46-50
- **Detail**: `handleSubmit`'s `fetch`/`response.json()` are not wrapped in try/catch, so a genuine network failure rejects and surfaces as an unhandled rejection with no `serverError` shown (the dialog's `finally` only resets `submitting`). Note the established sibling `ExpensesManager.handleFormSubmit` has the identical gap, so this is pre-existing pattern behavior, not a regression introduced by this change — flagged for parity and because the F2 fix invites addressing both together.
- **Fix**: Wrap the fetch in try/catch and set a generic `serverError`/`listError` on network failure (apply alongside F2 for a consistent error story).
- **Decision**: FIXED — both `handleSubmit` and `handleDelete` fetches wrapped in try/catch, setting `serverError`/`listError` on network failure.

### F4 — PATCH 404 shows a generic message instead of the server's

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/categories/CategoriesManager.tsx:52-63
- **Detail**: The update path treats only 409 as a "show server message" case; a 404 (category deleted concurrently) falls through to the generic "Failed to update category." The expenses sibling explicitly surfaces the server message for `422 || 409 || 404` (`ExpensesManager.tsx:117`). Minor and acceptable — categories has no 422/ownership case — but the concurrent-delete message is less informative than the sibling.
- **Fix**: Optionally surface the server's error body for 404 as well, matching the expenses handler.
- **Decision**: SKIPPED — generic message accepted for this flow.
