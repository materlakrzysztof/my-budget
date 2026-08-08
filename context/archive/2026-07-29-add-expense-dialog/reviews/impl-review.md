<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Add-Expense Dialog (Global Entry Point) Implementation Plan

- **Plan**: context/changes/add-expense-dialog/plan.md
- **Scope**: Phase 1 of 3, Phase 2 of 3, Phase 3 of 3 (full plan)
- **Date**: 2026-07-30
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 2 observations

## Verdicts

| Dimension            | Verdict |
| --------------------- | ------- |
| Plan Adherence        | WARNING |
| Scope Discipline      | PASS    |
| Safety & Quality      | WARNING |
| Architecture          | PASS    |
| Pattern Consistency   | WARNING |
| Success Criteria      | PASS    |

## Findings

### F1 — GlobalAddExpense's category dropdown can silently desync from validation state

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Safety & Quality
- **Location**: src/components/expenses/GlobalAddExpense.tsx:96-104, src/components/expenses/ExpenseFormDialog.tsx:41-43
- **Detail**: `ExpenseFormDialog` is rendered unconditionally from `GlobalAddExpense`'s very first render (since `categories === null` on mount makes `hasNoCategories` false, so the `else` branch renders immediately) — with `categories={categories ?? []}` still `[]` at that point, because the `/api/categories` fetch only starts once the user actually opens the dialog. `ExpenseFormDialog`'s `categoryId` state is initialized once via `useState(() => ... categories[0]?.id ?? "")`, so it locks in `""` on that first render. Unlike `ExpensesManager`, which forces a fresh mount per dialog open via `key={dialogMode}-${editingExpense?.id ?? "new"}`, `GlobalAddExpense` never passes a `key` to `ExpenseFormDialog` — so once the category fetch resolves and real categories populate the `<select>`, the browser shows the first category as visually selected (native `<select>` behavior when `value` doesn't match any `<option>`), but React's `categoryId` state is still `""`. A user who trusts the visually-populated dropdown and submits without re-clicking it hits an unexpected "Category is required" client-side validation error. The e2e suite doesn't catch this because every spec explicitly calls `.selectOption(...)`, which fires the `onChange` that would otherwise never happen in this flow.
- **Fix A ⭐ Recommended**: Give `ExpenseFormDialog` a `key` in `GlobalAddExpense` that changes exactly once, when categories finish loading (e.g. `key={categories === null ? "loading" : "loaded"}`), forcing one clean remount that re-initializes `categoryId` from the real array.
  - Strength: Minimal, one-line change; mirrors the exact pattern `ExpensesManager` already uses for the same dialog.
  - Tradeoff: Still a mount/remount workaround rather than fully controlled state — a second category-list change within the same open dialog (not currently possible here) wouldn't re-sync.
  - Confidence: HIGH — the `key`-remount idiom is already proven correct elsewhere in this exact component.
  - Blind spot: None significant.
  - Fix B: Add a `useEffect` inside `ExpenseFormDialog` that resets `categoryId` to `categories[0]?.id ?? ""` whenever the `categories` prop identity changes and `categoryId` doesn't match any current category.
    - Strength: Fixes it at the shared component, protecting any future caller with the same lazy-load pattern.
    - Tradeoff: Touches a component reused by `ExpensesManager` and `DashboardView` too — needs care not to clobber an in-progress edit.
    - Confidence: MEDIUM — mechanically sound but a wider blast radius for a bug only `GlobalAddExpense`'s call site currently has.
    - Blind spot: Haven't checked whether any test relies on `ExpenseFormDialog` never re-deriving `categoryId` after mount.
- **Decision**: FIXED via Fix A — added `key={categories === null ? "loading" : "loaded"}` to `ExpenseFormDialog` in `GlobalAddExpense.tsx`.

### F2 — First category-fetch failure permanently locks the dialog into "no categories" with no retry

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/components/expenses/GlobalAddExpense.tsx:26-37
- **Detail**: `hasFetchedCategories.current` is set to `true` before the `await`, and never reset. If `/api/categories` throws or returns non-ok on the first open (transient network blip, momentary 5xx), `categories` is set to `[]` and cached that way for the rest of the page's lifetime — every subsequent open shows the "create a category first" hint even though the account has categories, with no retry path short of a full page reload. The same staleness applies if the user adds their first category via Settings in the same session/tab.
- **Fix**: Only set `hasFetchedCategories.current = true` after a successful response; on failure, leave it `false` (or track a distinct `fetchFailed` flag) so the next dialog open retries the fetch instead of trusting a possibly-transient failure forever.
- **Decision**: FIXED — `hasFetchedCategories.current` is now only set after a successful (`response.ok`) fetch; a thrown/non-ok attempt leaves it `false` so the next open retries.

### F3 — No-categories dialog implemented as a separate component, not documented as a deviation from the plan's literal contract

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/components/expenses/GlobalAddExpense.tsx:74-94, context/changes/add-expense-dialog/plan.md (Progress row 2.6)
- **Detail**: The plan's Phase 2 contract says the no-categories state renders inside `ExpenseFormDialog` ("the dialog body shows a hint... and disables submit"). The actual implementation swaps in an entirely separate `Dialog`/`DialogContent` with just a title, a hint, and a "Go to Settings" link — `ExpenseFormDialog` isn't rendered at all in that branch. Functionally equivalent (there's no form to submit either way) and it's mentioned in the Phase 2 commit message, but unlike the two other deviations from this plan (Phase 1's hook contract, Phase 3's `exact:true` fix), Progress row 2.6 itself carries no inline deviation note — a future reader of just the Progress section would think the literal contract was followed.
- **Fix**: Append a short deviation note to Progress row 2.6, mirroring the style of rows 1.3/3.4, describing the actual separate-Dialog approach.
- **Decision**: FIXED — appended a DEVIATION note to Progress row 2.6 in plan.md.

### F4 — `dispatchOpenAddExpense` exported with no call sites

- **Severity**: ℹ️ OBSERVATION
- **Dimension**: Pattern Consistency
- **Location**: src/lib/expense-events.ts:20-22
- **Detail**: `dispatchOpenAddExpense` is exported from the event-contract module per the plan's spec, but nothing in `src/` calls it yet — only `onOpenAddExpense` (the subscribe side) is consumed by `GlobalAddExpense`. This is likely intentional forward-compatibility (a future page-local CTA, e.g. the dashboard's empty-state button, could call it instead of linking to `?action=add`), consistent with the plan's S-17/general extensibility framing, so no action is required now.
- **Decision**: SKIPPED

### F5 — `DashboardView` and `ExpensesManager` use different memoization idioms for their `expense-created` listener

- **Severity**: ℹ️ OBSERVATION
- **Dimension**: Pattern Consistency
- **Location**: src/components/dashboard/DashboardView.tsx:58, src/components/expenses/ExpensesManager.tsx:56-88
- **Detail**: `DashboardView` subscribes via an empty-dependency `useEffect` closing over a freshly-created `refreshSummary` each render (safe only because `setComparison` uses the functional-updater form, so there's no actual stale-closure bug). `ExpensesManager` instead wraps `refresh` in `useCallback` and lists it as an effect dependency. Both are correct; the two styles simply drifted from each other during implementation.
- **Decision**: SKIPPED
