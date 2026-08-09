<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Polish UI (message-key layer)

- **Plan**: context/changes/polish-ui/plan.md
- **Scope**: Full plan — Phases 1–5 of 5
- **Date**: 2026-08-09
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 5 observations

## Verdicts

| Dimension           | Verdict           |
| ------------------- | ----------------- |
| Plan Adherence      | WARNING            |
| Scope Discipline    | WARNING            |
| Safety & Quality    | PASS               |
| Architecture        | PASS               |
| Pattern Consistency | WARNING            |
| Success Criteria    | WARNING            |

## Findings

### F1 — Default category names/descriptions never migrated to Polish

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence / Success Criteria
- **Location**: src/lib/services/categories.ts:9-18 (`DEFAULT_CATEGORIES`)
- **Detail**: The eight seed categories inserted for every new signup ("Groceries", "Transport", "Housing", "Utilities", "Entertainment", "Health", "Clothing", "Other" + English descriptions) are still hardcoded English and rendered verbatim in `CategoryList.tsx`, the expense-form category `<select>`, and the dashboard breakdown. This directly contradicts the plan's Desired End State ("Every screen … renders in Polish … grepping `src/` for translated UI copy finds it only in `src/i18n/pl.ts`"). Corroborating evidence: `tests/e2e/expenses-add-and-summary.spec.ts` still does `selectOption({ label: "Groceries" })` and asserts `"Transport"` — the e2e suite locks in the English seed data rather than catching it. Manual criterion 5.5 ("full manual pass confirms no English UI copy remains on any reachable screen") was checked complete, but this string is visible to every brand-new user on first login — a plausible rubber-stamp gap.
- **Fix A ⭐ Recommended**: Translate `DEFAULT_CATEGORIES` name/description literals through new `t("category.defaults.*")` keys and update the affected e2e specs' data references to the Polish labels.
  - Strength: Closes the gap exactly as the Desired End State describes; the only literal English copy left in a fresh signup's UI.
  - Tradeoff: Touches e2e specs that assert on these names as data values (not chrome) — a handful of line edits; doesn't retroactively relabel already-seeded rows for existing users (acceptable — categories are user-owned/renameable data, not fixed labels).
  - Confidence: HIGH — grounded directly in the plan's own Desired End State wording.
  - Blind spot: Whether any existing dev/prod user data depends on the English literal for matching logic elsewhere (grep found none).
- **Fix B**: Document default category names/descriptions as seed *data* (user-editable post-creation), not UI *copy*, and explicitly scope them out via a plan addendum.
  - Strength: No code change; treats seeded rows the same as any other user-entered data.
  - Tradeoff: Leaves a visible English string on every new user's first screen, undercutting the change's stated purpose.
  - Confidence: MEDIUM — defensible distinction, but weaker than the plan's explicit "every screen" language.
  - Blind spot: Whether product/PO would accept English category names as acceptable given PRD FR-020.
- **Decision**: FIXED via Fix A — added `category.defaults.*` keys to `src/i18n/pl.ts`, switched `DEFAULT_CATEGORIES` in `src/lib/services/categories.ts` to resolve through `t()`, and translated the 10 affected e2e specs' category-name references (`categories-view-defaults`, `category-expense-drilldown`, `dashboard-month-comparison`, `dashboard-quick-add`, `expenses-add-and-summary`, `expenses-backdated-attribution`, `expenses-category-filter`, `expenses-delete-updates-summary`, `expenses-edit-updates-summary`, `expenses-global-dialog-add`). Verified: lint/unit/build green, all 10 targeted e2e specs pass (one flaky-then-passed retry on `dashboard-month-comparison`, matching the pre-existing documented session-race flake, unrelated to this change).

### F2 — `src/lib/auth-errors.ts` has no test coverage, breaking the repo's test-co-location convention

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/auth-errors.ts (new file, no `auth-errors.test.ts`)
- **Detail**: Every other file with logic in `src/lib/`/`src/lib/services/` has a co-located `*.test.ts` (`format.test.ts`, `categories.test.ts`, `expenses.test.ts`, `settings.test.ts`). `auth-errors.ts` is the one new abstraction from this change without one, despite having real branching logic (exact-string lookup + fallback). The fallback itself was verified safe (`?? t("errors.authGeneric")`, no raw English leak at either call site), but an untested exact-string match against a third party's (Supabase) wording is exactly the kind of thing that regresses silently on a dependency bump.
- **Fix**: Add `src/lib/auth-errors.test.ts` covering: a known Supabase message maps to its specific Polish string, an unmatched message falls back to `errors.authGeneric`, and no raw English string is ever returned.
- **Decision**: FIXED — added `src/lib/auth-errors.test.ts` with the three described cases. 70/70 unit tests green.

### F3 — Roadmap S-11 status and change archival not updated per the plan's own closing instruction

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/foundation/roadmap.md:39 (S-11 still `ready`); no `context/archive/polish-ui*` folder
- **Detail**: Phase 5's Implementation Note says "after green, update the roadmap S-11 status and archive the change." All Progress checkboxes are `[x]` and automated criteria are independently confirmed green (lint/build/unit tests re-run clean in this review), but the roadmap still shows S-11 as `ready` rather than done, and the change hasn't been archived.
- **Fix**: Flip roadmap.md's S-11 row to reflect completion, then run `/10x-archive polish-ui`.
- **Decision**: FIXED (partial) — flipped roadmap.md's S-11 "At a glance" status from `ready` to `done`. Archival left to the user to trigger explicitly via `/10x-archive polish-ui`.

### F4 — shadcn `DialogContent`'s default close button carries a hardcoded English "Close" screen-reader label

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/components/ui/dialog.tsx:63 (`<span className="sr-only">Close</span>`)
- **Detail**: `showCloseButton` defaults `true` on `DialogContent` and is used by every dialog in the app (`ExpenseFormDialog`, `CategoryFormDialog`, `GlobalAddExpense`), so a screen reader announces this button as "Close" in an otherwise all-Polish UI. It's untouched vendor (shadcn) boilerplate, not visually rendered text, and wasn't in the plan's file list — but it is a genuine user-facing (assistive-tech-facing) English string. (The `DialogFooter` variant's "Close" button at line 98 defaults `showCloseButton={false}` and is never enabled anywhere — dead code, not a live gap.)
- **Fix**: Pass `t("common.close")` as an `aria-label` override on `DialogPrimitive.Close`, or accept as a known vendor-boilerplate gap for a follow-up.
- **Decision**: SKIPPED

### F5 — Phase 4 commit bundles unrelated toolkit/config changes with the plan's Phase 4 work

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: commit c430a1e ("refactor(api): centralize auth error handling and tidy API/service layer")
- **Detail**: This commit's diff includes `.claude/.10x-cli-manifest.json` (1051-line diff), `.claude/settings.local.json`, `.claude/skills/10x-goal-implement/SKILL.md`, `context/changes/tool-loop-agent/**`, and `packages/code-reviewer/.claude/settings.local.json` alongside the polish-ui Phase 4 work — none of which relate to this change. Already published to `develop`; rewriting it isn't worth the disruption.
- **Fix**: No retroactive action — flag for future discipline (keep unrelated toolkit/config bumps in their own commits).
- **Decision**: SKIPPED

### F6 — Zod validation messages in `src/lib/services/expenses.ts` remain hardcoded English

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/expenses.ts:28-46 (`amountSchema`, `dateSchema`, `nameSchema` refine messages)
- **Detail**: Phase 4's contract said "zod validation messages shown inline → translate." Traced the flow: API routes return `{ error: "Invalid input", issues: parsed.error.issues }` on 400, but every client call site only reads `body.error` for 422/409/404 and falls back to a translated generic message otherwise — so these English strings never reach a rendered screen today. Still visible in raw Network/DevTools responses; a latent leak if a future caller reads `issues[].message` directly.
- **Fix**: Translate the zod refine/regex messages through `t("errors.*")` for defense-in-depth, or add a comment documenting them as internal-only.
- **Decision**: SKIPPED

### F7 — `confirm-email.astro` title doesn't follow the `meta.<page>Title` key pattern

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/auth/confirm-email.astro:22
- **Detail**: Reuses the already-resolved Polish heading string as `<Layout title={content.heading}>` rather than a dedicated `t("meta.confirmEmailTitle")` key. Functionally fine (title is still correct Polish) but doesn't match the pattern every other page follows.
- **Fix**: Add `meta.confirmEmailTitle` and use it, for consistency with the other pages.
- **Decision**: FIXED — added `meta.confirmEmailTitle` to `src/i18n/pl.ts` and switched `confirm-email.astro`'s `<Layout title>` to use it.

### F8 — `src/lib/config-status.ts` banner copy lives outside `src/i18n/pl.ts`

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/lib/config-status.ts:13-18
- **Detail**: Pre-existing hardcoded Polish literals (not English — already correct language) rendered into the config banner via `Layout.astro`, predating this change and untouched by any polish-ui commit. Not a regression, but it contradicts the plan's own claimed invariant that translated copy lives only in `src/i18n/pl.ts`.
- **Fix**: Move these literals into `pl.ts` as a small follow-up, or note the exception explicitly in the plan.
- **Decision**: FIXED — added `banner.supabaseNotConfigured` and `banner.supabaseDocsLabel` to `src/i18n/pl.ts`; `config-status.ts` now resolves both through `t()` instead of inline literals (rendered text unchanged).

## Verification notes

- **Automated criteria re-run in this review**: `npm run lint` — clean; `npm run test:unit` — 67/67 passed; `npm run build` — succeeded (pre-existing unrelated esbuild CSS warning about a Tailwind arbitrary-value class, not i18n-related).
- **`npm run test:e2e`** was not re-run in full (requires local Supabase via Docker); relied on the plan's own recorded Phase 5 evidence (44f8258: two consecutive clean/near-clean runs, one pre-existing unrelated flake documented). Spot-checked 3 spec files (`expenses-add-and-summary`, `nav-reachability`, `auth-happy-path`) plus `helpers.ts` for CLAUDE.md E2E rule compliance (getByRole/getByLabel, no waitForTimeout, per-test unique users) — all compliant.
- Everything else across all 5 phases — the i18n dictionary/accessor, `pl-PL` formatting with NBSP grouping, `Intl.PluralRules` four-form handling, all Astro/React surface migrations, and the API/service error-message routing — checked out as faithful, correctly-scoped, non-drifted implementations of the plan.
