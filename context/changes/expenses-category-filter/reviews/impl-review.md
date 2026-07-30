<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Category Filter on Expenses List Implementation Plan

- **Plan**: context/changes/expenses-category-filter/plan.md
- **Scope**: Phase 1 of 2, Phase 2 of 2 (full plan)
- **Date**: 2026-07-29
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 2 warnings, 2 observations

## Verdicts

| Dimension           | Verdict |
| -------------------- | ------- |
| Plan Adherence        | PASS    |
| Scope Discipline      | PASS    |
| Safety & Quality      | WARNING |
| Architecture          | PASS    |
| Pattern Consistency   | WARNING |
| Success Criteria      | PASS    |

## Success criteria verification

- `npm run lint` — re-run, PASS (0 errors).
- `npm run test:unit` — re-run, PASS (61/61).
- `npm run build` — verified during implementation (commit 6dc7ea1), no changes since; not re-run to save time.
- `npm run test:e2e` — verified during implementation: new spec and the adapted drilldown spec both pass in isolation; one unrelated full-suite flake (`dashboard-month-comparison.spec.ts`) matches a documented pre-existing pattern (shared-Supabase contention) and is untouched by this diff.
- Manual verification: user confirmed complete for both phases (Progress rows 1.4-1.7, 2.3, all with SHA `6dc7ea1` / `f53d273`).

## Findings

### F1 — Filter `<select>` changes race: rapid selections can leave list/URL/picker inconsistent

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/components/expenses/ExpensesManager.tsx:63-68
- **Detail**: `handleCategoryFilterChange` sets `selectedCategoryId`, awaits `refresh(nextId)`, then calls `history.replaceState`. There is no request-sequencing guard — if the user changes the picker twice in quick succession (or a slow network reorders responses), an older, slower `refresh()` call can resolve after a newer one and overwrite `expenses` and the URL with stale data, leaving the rendered list, the `<select>` value, and the URL in three different states. This is new code — the pre-existing behavior served a static SSR-only `categoryFilter` prop with a full-page `<a href="/expenses">` navigation for clearing, so no such race existed before this diff.
- **Fix A ⭐ Recommended**: Track a monotonically increasing request sequence (`const requestSeq = useRef(0)`); capture the incremented value at the start of `refresh()`, and only apply `setExpenses` (and, in `handleCategoryFilterChange`, the `replaceState` call) if that captured value still matches the ref when the fetch resolves.
  - Strength: Simple, idiomatic React data-fetching guard; no changes to the fetch call itself.
  - Tradeoff: Doesn't cancel the wasted in-flight request — it still completes, just gets ignored.
  - Confidence: HIGH — standard, low-risk mitigation pattern.
  - Blind spot: Must remember to guard both the `setExpenses` call inside `refresh()` and the `replaceState` call in the handler, not just one of them.
- **Fix B**: Use an `AbortController` per call — store the current controller in a ref, `.abort()` the previous one when a new `refresh()` starts, pass its `signal` into `fetch`, and silently skip `setExpenses`/`replaceState` on an `AbortError`.
  - Strength: Actually cancels the superseded network request instead of just ignoring its result.
  - Tradeoff: More code — needs careful handling so an aborted request isn't surfaced as a user-facing error.
  - Confidence: MEDIUM — mechanically sound, but slightly more surface area for mistakes than a sequence counter.
  - Blind spot: Interaction with the existing `serverError` state on abort hasn't been traced end-to-end.
- **Decision**: FIXED via Fix A — added `filterRequestSeq` ref; `refresh()` now returns whether it was still the latest request, and `handleCategoryFilterChange` only calls `replaceState` when `refresh()` reports it applied.

### F2 — Filter-change refresh failure is silently swallowed

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/expenses/ExpensesManager.tsx:53-61
- **Detail**: `refresh()` only updates state `if (expensesRes.ok)`; a non-OK response or a thrown fetch error (e.g. offline) is swallowed with no `setServerError` and no user-facing feedback. This pattern predates this diff, but the diff now routes a much more frequently triggered action (every `<select>` change) through the same unguarded path, so filter changes can now silently leave the list stale far more often than before.
- **Fix**: Wrap the fetch in try/catch (or check `.ok` explicitly) and call `setServerError` on failure, consistent with how `handleFormSubmit`/`handleConfirmDelete` already report failures.
- **Decision**: FIXED — `refresh()` now wraps the fetch in try/catch and calls `setServerError` on a non-OK response or thrown error. Also added a page-level error banner (shown only when no dialog is open, avoiding a duplicate with the dialogs' own `serverError` render) since the picker's filter change has no open dialog to surface the existing dialog-only banner.

### F3 — Filter `<select>` duplicates `ExpenseFormDialog`'s field styling instead of reusing `fieldClassName` + `cn()`

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/expenses/ExpensesManager.tsx:163-177, src/components/expenses/ExpenseFormDialog.tsx:15-16,106-114
- **Detail**: `ExpenseFormDialog.tsx` defines a shared `fieldClassName` constant and composes it via `cn(...)` for its category `<select>`. The new filter `<select>` instead hand-duplicates the same visual classes as one long literal string and doesn't use `cn()` at all — diverging from the project's stated convention ("use the `cn()` helper ... do not concatenate class strings manually"). `fieldClassName` is module-private today, so the duplication was effectively forced.
- **Fix**: Export `fieldClassName` from `ExpenseFormDialog.tsx` (or hoist it to `src/lib/utils.ts`) and reuse it via `cn()` in the filter select's className, so the two selects' styling can't drift apart independently.
- **Decision**: FIXED — exported `fieldClassName` from `ExpenseFormDialog.tsx`; `ExpensesManager.tsx`'s filter select now composes it via `cn(...)` instead of duplicating the literal string.

### F4 — Inconsistent URL-encoding of the category id between the fetch call and `replaceState`

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/expenses/ExpensesManager.tsx:54,67
- **Detail**: `refresh()`'s fetch URL correctly does `encodeURIComponent(categoryId)`, but the `replaceState` URL three lines later interpolates `nextId` raw. Category ids are server-generated UUIDs so this isn't currently exploitable, but it's an inconsistency within the same function.
- **Fix**: Use `encodeURIComponent(nextId)` in the `replaceState` call for symmetry with the fetch call.
- **Decision**: FIXED — `replaceState` now encodes `nextId` with `encodeURIComponent`, matching the fetch call.
