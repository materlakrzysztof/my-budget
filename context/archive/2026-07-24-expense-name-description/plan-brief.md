# Expense Name Field — Plan Brief

> Full plan: `context/changes/expense-name-description/plan.md`

## What & Why

Add an optional `name` field a user can set when adding or editing an expense, so entries are easier to tell apart later than just amount/category/date. Closes the "expense identity" gap named in `prd-v2.md`'s Problem Statement (FR-002, US-01) and roadmap slice S-05.

## Starting Point

`expenses` today has no name/description column — only `category_id, amount, date, created_at`. The codebase also has no existing "optional/nullable text field" convention: `categories.description` is required (`not null`, Zod `min(1)`), so this change establishes the first optional-field pattern rather than copying one.

## Desired End State

A user can type an optional label (max 100 chars) in the add/edit expense dialog. It shows in the expense list next to the date/category line. Leaving it blank behaves exactly as today. Pre-existing expenses show no name and are otherwise untouched. The monthly summary is unaffected — confirmed the underlying view and aggregation logic never touch this column.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Field shape | Single `name` field (not separate name+description) | PRD-v2 FR-002 names one field, singular | Plan |
| Length/UI | Plain `<Input>`, max 100 chars | Matches a short label, not a long note; consistent with quick-entry UX | Plan |
| Nullability | Nullable DB column + Zod `.optional()`, blank → `null` | No existing optional-field convention to copy; explicit null vs empty-string distinction avoids ambiguity | Plan |
| List display | Shown in `ExpenseList`, as a new line (not merged into the existing `·` line) | Fulfills the actual PRD goal (telling expenses apart) and avoids breaking the `·`-based e2e locator | Plan |
| Test coverage | Unit + integration only, no new e2e file | Matches roadmap's low-complexity bias for this additive, low-risk slice; existing e2e specs get one assertion added instead | Plan |

## Scope

**In scope:**
- New nullable `name` column on `expenses` (new migration)
- Zod validation (trim, max 100, blank → `null`)
- Add/edit form field, list display
- Unit test for schema behavior, integration test for persistence, assertions added to 2 existing e2e specs

**Out of scope:**
- Separate `description` field
- Full-text/keyword search over the field
- Backfill of existing rows (they get `null` automatically)
- New dedicated e2e spec file
- Any change to the monthly summary view or its aggregation

## Architecture / Approach

Standard additive layering: migration → Zod schema + service layer (select/map/write) → shared types → form/list UI → tests. The empty-string-to-`null` normalization lives once in the Zod schema so every caller gets consistent behavior.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Data & Validation Layer | Migration, Zod schema, service-layer mapping, shared types | First nullable-field convention in this codebase — must decide null vs empty-string once, consistently |
| 2. UI — Form & List | Name field in add/edit dialog, name shown in expense list | Must not disturb the `·`-separated line existing e2e helpers key off of |
| 3. Testing | Unit test (schema), integration test (persistence), 2 existing e2e specs extended | None — purely additive test coverage |

**Prerequisites:** None — independent of S-04/S-06/S-07 per roadmap.
**Estimated effort:** Small — roughly 1 session across 3 phases (smallest of the four v2 slices).

## Open Risks & Assumptions

- Assumes a plain short `<Input>` (not a `<Textarea>`) is the right widget for a 100-char label — if usage later shows people want longer notes, a follow-up change would need to revisit the length/UI decision.

## Success Criteria (Summary)

- User can add/edit an expense with an optional name and see it in the expense list
- Leaving the name blank behaves exactly as before (no visual regression, stored as `null`)
- Monthly summary totals are unaffected
