# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-07-24

## 1. Strategy

Tests follow three non-negotiable principles for this project:

1. **Cost × signal.** The cheapest test that gives a real signal for the
   risk wins. Do not promote to e2e because e2e "feels safer." Do not put a
   vision model on top of a deterministic visual diff that already catches
   the regression.
2. **User concerns are first-class evidence.** Risks anchored in "the team
   is worried about X, and the failure would surface somewhere in area Y"
   carry the same weight as PRD lines or hot-spot data.
3. **Risks are scenarios, not code locations.** This plan documents _what
   could fail_ and _why we believe it's likely_ — drawn from documents,
   interview, and codebase _signal_ (churn, structure, test base). It does
   NOT claim to know which line owns the failure. That knowledge is
   produced by `/10x-research` during each rollout phase. If the plan and
   research disagree about where the failure lives, research is the
   ground truth.

Hot-spot scope: skipped this round — the scoped `src/` git log returned only
2 commits in the last 30 days (below the 5-commit threshold; the project is
~3 weeks old). Likelihood ratings below rely on the PRD, roadmap, and the
Phase 2 interview instead.

## 2. Risk Map

The top failure scenarios this project must protect against, ordered by
risk = impact × likelihood. Risks are failure scenarios in user / business
terms, not test names. The Source column cites the _evidence that surfaced
this risk_ — never a specific file as "where the failure lives" (that is
research's job, see §1 principle #3).

| #   | Risk (failure scenario)                                                                             | Impact      | Likelihood  | Source (evidence — not anchor)                                                                                     |
| --- | --------------------------------------------------------------------------------------------------- | ----------- | ----------- | ------------------------------------------------------------------------------------------------------------------ |
| 1   | An authenticated user can read or mutate another user's categories or expenses (IDOR / RLS gap)     | High        | Medium      | PRD Guardrails ("a user's financial data is never visible to other users"); CLAUDE.md RLS convention; interview Q1 |
| 2   | Monthly summary total or per-category ranking doesn't reconcile with the underlying expense entries | High        | Medium-High | PRD Guardrails + Business Logic section; interview Q1, Q3                                                          |
| 3   | A backdated expense is attributed to the wrong month (current instead of past, or vice versa)       | High        | Medium      | PRD US-02 + Acceptance Criteria; interview Q1                                                                      |
| 4   | An expense is saved under the wrong category                                                        | Medium-High | Medium      | interview Q1; PRD FR-008                                                                                           |
| 5   | A migration or deploy that passes in dev/staging corrupts or silently omits data in production      | High        | Medium      | interview Q2; roadmap Baseline (CI runs lint+build only, no DB-related gate)                                       |

Risk #1 is this product's mandatory abuse/authorization scenario (the
product has auth and stores personal financial data — this class of risk
almost never surfaces from a happy-path interview on its own).

### Risk Response Guidance

| Risk | What would prove protection                                                                                                                                                 | Must challenge                                                                                                                                                                                                                                                                                                                                                                                                  | Context `/10x-research` must ground                                                                                                                                                                                                                                                                                                                    | Likely cheapest layer                                                                                                                                                                                                                                                                                                                                                           | Anti-pattern to avoid                                                                                                                                                                                                         |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #1   | User A, authenticated, cannot read/list/mutate a category or expense belonging to user B even when given B's record ID directly, not just hidden in the UI                  | "RLS is enabled" is not proof by itself — must challenge whether policies are scoped per-operation and whether any API route uses the service-role key (which bypasses RLS entirely)                                                                                                                                                                                                                            | RLS policy definitions once written; Supabase client instantiation pattern (anon vs service role); API route auth wiring for categories/expenses                                                                                                                                                                                                       | integration (two real Supabase sessions against actual RLS, not a UI-level e2e check)                                                                                                                                                                                                                                                                                           | Testing only that the UI hides cross-user rows, instead of a direct API/DB-level ownership check with a second real user                                                                                                      |
| #2   | For a given month, the sum of category totals equals an independently-computed sum of the raw expense entries, and categories are ordered largest-to-smallest               | "The total matches because the same aggregation function produced both numbers" — the oracle problem. Now resolved (2026-07-23 research): the sum runs as a database-side query, not an app-level reduce, so it cannot be proven with a pure unit test at all; the multi-entry reconciliation case is already covered, oracle-free, by an existing test — remaining exposure is narrower than originally framed | Ranking/order logic is app-level and already covered by a pure unit test with independently-typed expected totals; the sum itself is DB-side and only provable by executing it, so context to ground is now whether the summary query enforces per-user scoping end-to-end (shared boundary with Risk #1) rather than "where does the aggregation run" | The multi-entry sum-reconciliation gap is already closed at the integration/e2e layer — no new unit test is buildable or needed for the sum itself. The one remaining gap (a second user's expenses must never appear in this user's category total) closes via the same two-real-user integration test Risk #1 needs; do not add a redundant app-level "aggregation unit test" | Asserting output equals a value copied from running the same implementation once (golden-master from the code itself); also, re-testing multi-entry summation that existing coverage already proves without an oracle problem |
| #3   | An expense dated in a previous month appears in that month's summary, not the current month's, and the current month's summary is unaffected — per PRD US-02                | "Date grouping is obviously correct" — challenge timezone/day-boundary handling (an expense near local midnight could land in the wrong month)                                                                                                                                                                                                                                                                  | How "month" is derived from a stored date (server vs client timezone); the expense date column type                                                                                                                                                                                                                                                    | unit test on the date-to-month attribution function with boundary-date fixtures                                                                                                                                                                                                                                                                                                 | Testing only "today's date," never a real month-boundary case                                                                                                                                                                 |
| #4   | The category a user selects when creating an expense is the category persisted and displayed, verified with ≥2 distinct categories so a swap is actually observable         | "The selection is fine" when only one category exists in the test proves nothing; also challenge silent fallback-to-default on empty/invalid selection                                                                                                                                                                                                                                                          | Expense-create request/handler contract; how `category_id` is validated and persisted                                                                                                                                                                                                                                                                  | integration test on the expense-create endpoint with ≥2 seeded categories                                                                                                                                                                                                                                                                                                       | Single-category e2e test where a category mixup is structurally invisible                                                                                                                                                     |
| #5   | A migration applied to a production-like schema still produces the correct data shape, and a deploy doesn't ship with missing seed/reference data (e.g. default categories) | "Passed on staging" ≠ "safe for production" — challenge whether staging schema/data actually resembles production at apply time                                                                                                                                                                                                                                                                                 | Supabase migration process/tooling in use; whether a default-categories seed exists; CI's current DB-related steps (none today)                                                                                                                                                                                                                        | CI quality gate — apply migrations to a fresh/throwaway database (dry-run/schema-diff), plus a post-deploy data-smoke check                                                                                                                                                                                                                                                     | Treating "migration file exists and build passes" as sufficient signal without ever applying it to a production-like schema                                                                                                   |

Risk #3 closure note (2026-07-23, Phase 2): the monthly-summary API/UI never
expose a past month — `getMonthlySummary` always resolves to the current
month and there is no UI to view another one — so "an expense correctly
appears in its own past month's summary" has no product surface to test
through beyond what the existing e2e exclusion test
(`tests/e2e/expenses-backdated-attribution.spec.ts`) and Phase 1's
summary-view integration coverage already establish. Deliberately out of
scope, not a gap. Phase 2 closed by testing the one remaining real gap
instead: `categoryId` rejection on expense creation (Risk #4), see
`context/changes/expense-attribution-correctness/`.

Risk #5 closure note (2026-07-24, Phase 3): the new `migration-safety` CI
job proves two things on every PR — the migration sequence applies cleanly
to a fresh Postgres, and the resulting schema still has the exact shape the
app depends on (RLS enabled, the six named per-operation policies, the two
named unique constraints/index, the composite FK, and the
`monthly_category_summary` view — `tests/schema-safety/schema-shape.test.ts`)
— both checked only against the ephemeral local Postgres the same job
boots, never a hosted project. No DB-level seed/reference-data check was
needed: default categories are seeded lazily per-user at the app layer
(`src/lib/services/categories.ts:7-9,68`), not via `supabase/config.toml`'s
`seed.sql`, so there is no DB-side reference data a deploy could omit. The
post-deploy data-smoke check named in the original risk wording stays
deliberately deferred — deploy is manual with no CD to hook a check into
(`context/deployment/deploy-plan.md`); revisit once/if CD exists. See
`context/changes/testing-migration-deploy-safety-net/`.

## 3. Phased Rollout

Each row is a discrete rollout phase that will open its own change folder
via `/10x-new`. Status moves left-to-right through the values below; the
orchestrator updates Status as artifacts appear on disk.

| #   | Phase name                                     | Goal (one line)                                                                                                           | Risks covered | Test types         | Status   | Change folder                                          |
| --- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------- | ------------------ | -------- | ------------------------------------------------------ |
| 1   | Financial data isolation & summary correctness | Bootstrap a test runner and prove the two PRD guardrails (cross-user isolation, summary reconciliation) as S-02/S-03 land | #1, #2        | unit + integration | complete | `context/changes/testing-data-isolation-summary/`      |
| 2   | Expense attribution correctness                | Lock in correct month/category attribution and extend the existing Playwright suite across the full US-01/US-02 journey   | #3, #4        | unit + e2e         | complete | `context/changes/expense-attribution-correctness/`     |
| 3   | Migration & deploy safety net                  | Close the staging-vs-production data-integrity gap the team has already been burned by                                    | #5            | CI quality gate    | complete | `context/changes/testing-migration-deploy-safety-net/` |

**Status vocabulary** (fixed): `not started` → `change opened` → `researched` → `planned` → `implementing` → `complete`.

## 4. Stack

| Layer                | Tool          | Version | Notes                                                                                                                                                                                                                                  |
| -------------------- | ------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| unit + integration   | none yet      | —       | See §3 Phase 1 — first phase bootstraps the runner (candidate: Vitest, given the Vite/Astro toolchain already in use)                                                                                                                  |
| API mocking          | none yet      | —       | Mocking policy TBD in Phase 1; per convention, mock only at the network edge, never internal modules                                                                                                                                   |
| e2e                  | Playwright    | ^1.61   | Configured (`playwright.config.ts`), 11 specs shipped (auth, categories, expenses — includes partial Risk #3/#4 coverage that landed with the original feature build, not a dedicated test phase). Phase 2 here extends the same infra |
| accessibility        | none yet      | —       | No PRD/interview signal raised this as a top-5 risk; not scoped into this rollout                                                                                                                                                      |
| (optional) AI-native | not evaluated | n/a     | No AI-native layer proposed — classic unit/integration/e2e covers all 5 top risks at the cheapest layer                                                                                                                                |

**Stack grounding tools (current session):**

- Docs: none available (no Context7 or framework-docs MCP exposed this session); checked: 2026-07-21
- Search: generic WebSearch tool available, no Exa.ai; not used for this rollout (local manifest/config evidence was sufficient); checked: 2026-07-21
- Runtime/browser: claude-in-chrome extension available; not used for this rollout (Playwright already covers the e2e layer); checked: 2026-07-21
- Provider/platform: no GitHub/Cloudflare/Supabase MCP detected this session; checked: 2026-07-21

## 5. Quality Gates

| Gate                   | Where                | Required?                 | Catches                                                      |
| ---------------------- | -------------------- | ------------------------- | ------------------------------------------------------------ |
| lint + typecheck       | local + CI           | required                  | syntactic / type drift                                       |
| unit + integration     | local + CI           | required after §3 Phase 1 | logic regressions (isolation, summary math)                  |
| e2e on critical flows  | CI on PR             | required after §3 Phase 2 | broken critical user paths (log expense → see summary)       |
| migration dry-run      | CI on PR             | required                  | staging-ok/prod-broken schema or data drift                  |
| post-deploy data smoke | between merge + prod | required after §3 Phase 3 | missing/incomplete production data (e.g. default categories) |

## 6. Cookbook Patterns

How to add new tests in this project. Each sub-section fills in once the
relevant rollout phase ships; before that, it reads "TBD."

### 6.1 Adding a unit test

Runner is Vitest (`vitest.config.ts`), suite glob `src/**/*.test.ts`. Colocate
the test next to the module under test — e.g. `src/lib/services/expenses.ts`
→ `src/lib/services/expenses.test.ts`. Run locally with `npm run test:unit`;
this is wired into CI (Phase 1). For a pure-logic pattern (ranking/aggregation
with an independently-typed expected result, avoiding the oracle problem),
follow `src/lib/services/expenses.test.ts`'s `mergeCategoriesWithTotals` block.
For request-shape/boundary-value validation (zod schemas), follow the same
file's `createExpenseSchema` block — amount edge cases (zero, negative, >2
decimals), date edge cases (today/past accepted, future rejected), and
`categoryId` presence/emptiness. For normalization and typed-error-shape
patterns, see `src/lib/services/categories.test.ts` (`normalizeCategoryName`
via `it.each`, `DuplicateCategoryError`'s constructed message). Note: there is
deliberately no "date-to-month attribution" unit test — Risk #3's closure
(§2) found no app-level function that derives "month" from a stored date in a
way a unit test could target; don't invent one.

### 6.2 Adding an integration test

Runner is a separate Vitest project (`vitest.integration.config.ts`), suite
glob `tests/integration/**/*.test.ts`. This project's integration tests run
against the **real** E2E Supabase project — no mocking, credentials loaded
from `.dev.vars.e2e` (gitignored) via `tests/integration/env.ts` (fails loud
if missing/incomplete). Use `tests/integration/supabase-client.ts`'s
`signUpTestUser(prefix)` to create a real signed-up user + client; there is no
per-test cleanup — accumulating test users on the E2E project is an accepted
convention (`mailer_autoconfirm: true` on that project). Run locally with
`npm run test:integration`; this is **not** wired into CI yet (deliberately
deferred — would need new CI secrets for the E2E project). For the two-real-user
RLS/ownership pattern, follow `tests/integration/cross-user-isolation.test.ts`:
set up the "victim" through real service-layer calls, but issue the
attacker's queries as **raw** `supabase.from(...)` calls with no `user_id`
filter — using the service layer for the attacker side would only prove the
app's own filter works, not that RLS itself blocks the read/write. For a
cross-user foreign-key rejection pattern, follow
`tests/integration/expense-category-validation.test.ts` (asserts
`createExpense()` throws `CategoryOwnershipError` for a category owned by
another user). Non-vacuity check: temporarily break the guard under test
(comment out the RLS policy, or point the attacker at their own record) and
confirm the test now fails, before trusting a green run.

### 6.3 Adding an e2e test

Runner is Playwright (`playwright.config.ts`), spec dir `tests/e2e/`, run
locally with `npm run test:e2e`. Start from `tests/e2e/seed.spec.ts` — the
exemplar every generated spec in this project follows — and
`.claude/skills/10x-e2e/`. Conventions: role-based locators (`getByRole`,
`getByLabel`) over CSS/XPath; each spec is independently runnable with its
own setup/action/assertion and no shared state across specs; unique
timestamp-suffixed test data (e.g. `` `e2e-exp-backdate-${Date.now()}@example.com` ``);
wait for state, not time — see `tests/e2e/helpers.ts`'s hydration-wait
helpers for React islands (retry-click-until-visible / fill-and-verify
patterns) instead of `page.waitForTimeout()`; no dedicated cleanup step,
matching the integration-layer convention of accumulating E2E-project test
users. File naming: `<area>-<behavior>.spec.ts`. For a spec tied to a named
risk, see `tests/e2e/expenses-backdated-attribution.spec.ts` (Risk #3).

### 6.4 Adding a test for a new API endpoint

There is deliberately no separate HTTP-level integration harness in this
repo (Phase 2 evaluated and rejected one as disproportionate cost for the
signal gained) — an endpoint's coverage splits across the three layers
above instead. Request-shape/validation (zod, 400-class failures) → unit
test directly on the schema, e.g. `src/lib/services/expenses.test.ts`'s
`createExpenseSchema.safeParse` cases for missing/empty `categoryId`.
Business-logic/DB rejection reachable via a direct service call (409-class
failures) → integration test calling the service function directly,
bypassing HTTP, e.g. `tests/integration/expense-category-validation.test.ts`.
Full request→response HTTP contract, only when a failure mode genuinely
needs the deployed shape (auth/cookie/handler crossing) → covered by the
existing Playwright specs, which already exercise real API routes through
the browser — don't add a bespoke route-level harness for this.
`src/pages/api/expenses.ts`'s `POST` handler is a concrete example of a
route whose failure modes split this way: 401 unauthenticated → 400 zod
parse failure → domain errors (`FutureDateError`/`InvalidAmountError`) → 422
→ `CategoryOwnershipError` → 409.

### 6.5 Adding a migration safety check

- Add/edit the migration file under `supabase/migrations/` as normal. Locally,
  run `npx supabase start` (or `npx supabase db reset` if the stack is
  already up) to apply it to the ephemeral local Postgres, then
  `npm run test:schema-safety` to assert the resulting shape (RLS enabled,
  named policies, named constraints/indexes, views) still matches what
  `tests/schema-safety/schema-shape.test.ts` expects — extend that suite
  with new assertions for any new shape the migration introduces. The CI
  `migration-safety` job (`.github/workflows/ci.yml`) replays both steps
  automatically on every PR against a fresh throwaway database — a broken
  migration or a silently dropped RLS/policy/constraint fails the job
  before it can reach `main`. See §3 Phase 3 / Risk #5 closure note (§2).

### 6.6 Per-rollout-phase notes

- **Phase 1**: attacker-side integration assertions must bypass the service
  layer and issue raw Postgrest calls — routing them through the app's own
  service functions would only prove the app's `user_id` filter works, and a
  broken RLS policy would still pass the test vacuously.
- **Phase 2**: one endpoint's failure modes split across two test layers by
  necessity — the 400/zod path is reachable and provable with a pure unit
  test, but the 409/foreign-key path only triggers through a real DB
  round-trip, so it lives in the integration suite instead. Neither layer
  alone covers the endpoint.

## 7. What We Deliberately Don't Test

- **Admin tooling** — no admin panel is planned for this product; if one is added later, re-evaluate. (Source: Phase 2 interview Q5.)

## 8. Freshness Ledger

- Strategy (§1–§5) last reviewed: 2026-07-21
- Stack versions last verified: 2026-07-21
- AI-native tool references last verified: n/a (no AI-native layer proposed)

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive,
- a recommended tool's `checked:` date is older than three months,
- the project's tech stack changes (new framework, new test runner),
- §7 negative-space no longer matches what the team believes.
