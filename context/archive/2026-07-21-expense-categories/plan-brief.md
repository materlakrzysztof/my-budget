# Expense Categories — Plan Brief

> Full plan: `context/changes/expense-categories/plan.md`

## What & Why

Let a signed-in user view their default expense categories and add new ones with a description, so the expense-logging slice (`S-03`) has something to categorize against. FR-003 (view defaults) and FR-005 (add new, warn/block on a similar existing name).

## Starting Point

No `categories` table, no `zod`, no `src/lib/services/`, no `src/types.ts`, and no JSON API contract exist in this codebase yet — auth (`S-01`) is the only shipped slice, and its three API routes use form-POST + redirect, not JSON. This is the first real data-modeling and JSON-API work in the repo.

## Desired End State

A user visiting `/categories` for the first time sees 8 pre-seeded default categories (Groceries, Transport, Housing, Utilities, Entertainment, Health, Clothing, Other). They can add a new category with a name and description; it appears instantly. Trying to add a name that's a case/whitespace variant of an existing one is rejected inline with a clear message — no duplicate categories can exist per user.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Default-category seeding | Per-user copy, lazily created on first read | No service-role key exists to seed at signup time before a session exists; lazy seeding needs only the user's own authenticated session | Plan |
| API contract | JSON fetch (`GET`/`POST /api/categories`) | The live duplicate-name check needs an inline response, not a full-page reload like the auth routes use | Plan |
| Similar-name matching | Exact match after trim + case-fold | Keeps the rule simple, predictable, and testable for an MVP; deliberately not fuzzy/typo-tolerant | Plan |
| Duplicate handling | Hard block, not a soft warning | A DB-level uniqueness constraint and a "save anyway" UX turned out to be mutually exclusive once both target the same normalized definition of "similar" — resolved in favor of the constraint | Plan |
| Uniqueness enforcement | DB unique index on `(user_id, lower(trim(name)))`, plus service-layer error mapping | Guarantees no duplicates even under a race, with a friendly message instead of a raw Postgres error | Plan |
| Test coverage | Vitest (new) for pure service logic + Playwright E2E for the full flow | Playwright alone can't give fast, isolated coverage of the normalization/error-mapping functions | Plan |
| Page placement | New protected `/categories` page | Clean separation, and a natural extension point when `S-03`'s expense form needs a category picker | Plan |

## Scope

**In scope:**
- `categories` table + RLS + normalized-uniqueness index (first migration in the repo)
- `GET`/`POST /api/categories` JSON endpoints, zod-validated
- `/categories` page + React island (list + add form), Topbar nav link
- Vitest unit tests for pure logic; Playwright E2E for the full flow

**Out of scope:**
- Editing or deleting categories (FR-004 deferred to v2; no delete FR at all)
- Fuzzy/typo-tolerant similarity (Levenshtein/trigram)
- Expense logging or the monthly summary (`S-03`)
- CI automation for applying migrations to cloud Supabase projects (manual dashboard step, same gap already parked for `account-signin-signout`)

## Architecture / Approach

A `src/lib/services/categories.ts` module owns all business logic (default content, normalization, lazy seeding, duplicate mapping) and is called from two places that both need it: the `/categories` Astro page's SSR frontmatter (initial render, no self-fetch) and the `GET`/`POST /api/categories` JSON routes (the client island's live add-form, and future reuse by `S-03`'s expense form). A React island (`CategoriesManager`) owns client-side list state so a successful add appears instantly without a page reload.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Database schema | `categories` table, RLS, uniqueness index | First-ever migration in this repo; no `supabase link` set up, so applying to cloud projects is manual |
| 2. Service layer & API | Types, zod, service module, JSON endpoints, vitest | First zod/service-layer/JSON-contract precedent — nothing to copy, sets the pattern for later features |
| 3. UI | `/categories` page, island, form, nav link | First proper ARIA-alert component in the app (fixing a gap flagged in `account-signin-signout`) |
| 4. E2E | 3 Playwright specs via `/10x-e2e` | Depends on Phase 1's migration being applied to the E2E Supabase project first |

**Prerequisites:** `account-signin-signout` (S-01) shipped and its E2E Supabase project confirmed working; that project must receive this plan's migration before Phase 4 can run. **Not yet true as of 2026-07-21** — that plan's step 1.6 is blocked on a Supabase mailer rate-limit issue and its Phase 2 (E2E specs) hasn't started; Phase 1's manual verification and all of Phase 4 here are gated on that resolving first.
**Estimated effort:** ~3-4 sessions across 4 phases, solo/after-hours.

## Open Risks & Assumptions

- Assumes the E2E Supabase project from `account-signin-signout` stays the shared target for this feature's E2E specs too (no new project needed).
- Assumes 8 default categories is the right starter set — easy to adjust the list in `DEFAULT_CATEGORIES` later, but existing users who've already been seeded won't retroactively get changes without a separate data migration.
- No service-role key is configured; if a future feature needs to seed data outside a user's own session, that gap will need revisiting.

## Success Criteria (Summary)

- A new user sees exactly 8 default categories on their first visit to `/categories`, with no duplicates ever created.
- Adding a new, uniquely-named category appears instantly, without a page reload.
- Adding a case/whitespace-duplicate name is rejected inline, naming the conflicting category.
