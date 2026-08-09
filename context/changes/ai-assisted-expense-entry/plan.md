# AI-assisted expense entry (S-17) Implementation Plan

## Overview

Add a free-text entry mode to the existing add-expense dialog (S-16): the user types something like "lidl 200zł, orlen 150zł", the app sends that text to an OpenRouter model via the Vercel AI SDK, and the parsed result — one or more draft expenses (amount, description, best-guess category) — is shown in a review list the user must adjust/confirm before anything is saved. This closes out roadmap slice S-17 (PRD FR-025–028, US-06), which is currently `blocked` pending a provider decision that `context/changes/ai-assisted-expense-entry/frame.md` already resolved: reuse the OpenRouter account already used by `packages/code-reviewer`, gated on verifying it actually runs under this app's Cloudflare Workers (`workerd`) runtime.

## Current State Analysis

- **Add-expense dialog exists (S-16, done)** but only as a structured form — `src/components/expenses/ExpenseFormDialog.tsx` has an `add`/`edit` mode prop, no free-text/AI mode scaffolding.
- **`POST /api/expenses` accepts one expense per call** (`src/pages/api/expenses.ts:48-76`, `createExpenseSchema` is a `z.object`, not an array) — AI parsing produces N expenses, so bulk creation is new.
- **No AI SDK usage anywhere under `src/`** — `ai` and `@openrouter/ai-sdk-provider` exist only in the standalone `packages/code-reviewer` package (its own `package.json`, not an npm workspace member), consumed via plain `process.env.OPENROUTER_API_KEY` from a Node CLI. Never run under Cloudflare Workers.
- **`OPENROUTER_API_KEY` is already a real GitHub Actions repo secret** (used by `.github/workflows/ai-code-review.yml`), but wired only into that CI-only Node job — never into `ci.yml`'s build/deploy steps or the deployed worker.
- **The repo's secret convention for the deployed app is `astro:env/server`**: `astro.config.mjs:77-82` declares `SUPABASE_URL`/`SUPABASE_KEY` via `envField.string({ context: "server", access: "secret", optional: true })`, sourced from `.dev.vars` locally and, in CI, injected as plain `env:` vars during `npm run build` (`.github/workflows/ci.yml:22-25,55-57`) — **not** via `wrangler secret put` (no such step exists; `wrangler.jsonc` declares no `[vars]`/secret bindings). The Cloudflare adapter bakes these values in at build time, so wiring a new secret is a matter of extending `env.schema` + the CI `env:` blocks, not provisioning new Cloudflare infrastructure.
- **No AI-provenance column** exists on `expenses` (`supabase/migrations/20260722090000_create_expenses.sql`); PRD assumes no new fields are needed and this plan doesn't add any.
- **Zod/service conventions**: schemas colocated in `src/lib/services/*.ts`, `create<Entity>Schema` naming, domain error classes mapped to HTTP status in the route (`src/pages/api/expenses.ts:67-75`).
- **AI SDK version installed**: `ai@7.0.55` (in `packages/code-reviewer`). Its bundled docs (`node_modules/ai/docs/03-ai-sdk-core/10-generating-structured-data.mdx`) present `generateText` + `Output.array({ element })` as the current structured-output path for extracting a list of typed items — this plan uses that, not the older standalone `generateObject`.

## Desired End State

A signed-in user can, from the add-expense dialog, switch to a free-text field, submit text describing one or more purchases, see a review list of parsed draft expenses (amount, description, category — each editable; category is blank and must be manually picked whenever the model can't confidently match one of the user's existing categories), and confirm to save all of them in one atomic request. The dialog can always fall back to the existing structured form. The whole flow works under the deployed Cloudflare Workers runtime, verified via `npm run build && npm run preview` locally before merge. `roadmap.md` S-17 and the PRD's AI Open Questions are updated to reflect the resolved provider/runtime decisions.

### Key Discoveries:

- `packages/code-reviewer/src/model.ts:36-48` is the pattern to mirror for the app's model factory — fetch-based, no Node-only APIs, portable to Workers.
- `roadmap.md:185` scopes the review step to exactly **amount, description, category** — not date. Dates are silently set to today, matching the structured form's own default (`ExpenseFormDialog.tsx:19-21,47`) but *without* exposing a date field in the AI review list.
- A live OpenRouter model-list check (`https://openrouter.ai/api/v1/models`) confirms `anthropic/claude-haiku-4.5` as a current, well-priced ($1/$5 per M tokens vs. the code-reviewer's Sonnet-class default) fast model in the same provider family the frame's data-handling reasoning already covers.
- Supabase's JS client `.insert([...])` with an array performs a single `INSERT` statement — atomic (all rows or none) without needing an RPC/transaction wrapper, satisfying the chosen "atomic bulk save" design.

## What We're NOT Doing

- No new `expenses` table columns (no AI-provenance/source flag) — confirmed by the frame and PRD as unneeded.
- No date field in the AI review list — parsed expenses always use today's date (see Key Discoveries).
- No rate limiting / per-user cost guard on the parse endpoint — relies on the existing auth gate; can be added later if usage data shows a need (explicit user decision).
- No streaming of partial AI output (`streamText`/`partialOutputStream`) — a simple loading state satisfies the "continuous visible progress" NFR without the added complexity of incremental UI updates.
- No live-OpenRouter integration test in CI — unit tests mock the AI SDK call; the real integration is verified manually via the Workers-runtime spike and standard manual QA (explicit user decision).
- No automatic category creation — a parsed line with no confident category match is left blank and must be picked manually (explicit user decision; also a PRD non-goal).
- No separate `packages/*` workspace for this feature — it's app runtime code living in `src/lib`, not a standalone CLI tool like `packages/code-reviewer`.
- No persistence or server-side logging of the raw submitted free text beyond the request lifecycle — matches the PRD guardrail that only the submitted text is sent for analysis and nothing extra is retained.

## Implementation Approach

Reuse the OpenRouter account and Vercel AI SDK already evaluated in `packages/code-reviewer`, but build a fresh, app-local integration (`src/lib/ai/model.ts` + `src/lib/services/expense-ai-parser.ts`) since the runtime, secret-loading convention, and dependency footprint (npm workspace vs. standalone package) all differ. Phase 1 bundles the provider foundation with the real parsing service and its API route — rather than a throwaway spike — so the Workers-runtime feasibility check (the frame's go/no-go gate) exercises actual shipping code under `npm run preview` instead of disposable scaffolding. Category matching is enforced at the schema level: the parse request builds a per-user Zod schema whose `categoryId` field is a dynamic enum of that user's real category ids (or `null`), so the model can never invent or silently pick an unlisted category. Bulk save is a new, atomic endpoint rather than N sequential calls to the existing single-create endpoint, so a partially-reviewed list can't end up partially saved.

## Critical Implementation Details

### Dynamic category-enum schema

The parse route must build its Zod element schema per-request from the signed-in user's actual categories (fetched via the existing `listCategories`), not a static schema — this is what makes "leave category unset, force manual pick" enforceable by validation rather than by prompt instruction alone:

```ts
const categoryIds = categories.map((c) => c.id);
const draftSchema = z.object({
  description: z.string().max(100),
  amount: z.number().positive(),
  categoryId: categoryIds.length > 0 ? z.enum(categoryIds as [string, ...string[]]).nullable() : z.null(),
});
```

### Amount normalization

The model returns `amount` as a `number` (not a string) so the server — not the model — controls formatting: normalize with `amount.toFixed(2)` before it flows into anything that touches `amountSchema` (`^\d+(\.\d{1,2})?$`) in `src/lib/services/expenses.ts:25-30`, avoiding validation mismatches from inconsistent model-generated string formats (e.g. "200", "200.0", "200 zł").

### Build-time secret wiring, not a Cloudflare runtime secret

`OPENROUTER_API_KEY` reaches the deployed worker the same way `SUPABASE_URL`/`SUPABASE_KEY` do: declared in `astro.config.mjs`'s `env.schema` and passed as a plain `env:` var to the `npm run build` step in `ci.yml`'s `ci` and `deploy` jobs (reusing the GitHub repo secret that already exists for `ai-code-review.yml`). No `wrangler secret put` step is needed or should be added — that would be a new, inconsistent secret-delivery mechanism relative to the rest of the app.

## Phase 1: AI provider foundation + expense-parsing service (runtime spike)

### Overview

Wire `OPENROUTER_API_KEY` through the app's existing secret convention, build the model factory and the free-text-to-drafts parsing service, and expose it via a new API route. Manually verifying this route under `npm run preview` (real Workers runtime, not `astro dev`'s Vite server) **is** the frame's go/no-go spike — if the OpenRouter call doesn't resolve under `workerd`, this phase's manual verification fails and the reframe from `frame.md` needs revisiting before Phase 2 proceeds.

### Changes Required:

#### 1. Dependencies

**File**: `package.json`

**Intent**: Add the AI SDK and OpenRouter provider to the root app (currently only present in the standalone `packages/code-reviewer`).

**Contract**: Add `"ai": "^7.0.55"` and `"@openrouter/ai-sdk-provider": "^3.0.0"` to `dependencies`, matching the versions already vetted in `packages/code-reviewer/package.json` to avoid behavioral drift between the two integrations.

#### 2. Secret declaration

**File**: `astro.config.mjs`

**Intent**: Declare `OPENROUTER_API_KEY` as a server-only secret through the same mechanism as `SUPABASE_URL`/`SUPABASE_KEY`.

**Contract**: Add `OPENROUTER_API_KEY: envField.string({ context: "server", access: "secret", optional: true })` to `env.schema` (`astro.config.mjs:77-82`). `optional: true` matches the existing two fields so local dev/CI without the var don't hard-fail unrelated work.

#### 3. Local + CI secret plumbing

**Files**: `.env.example`, `.github/workflows/ci.yml`

**Intent**: Document the new local var and wire the already-existing `OPENROUTER_API_KEY` GitHub repo secret into the app's build (not just the separate `ai-code-review.yml` CI job).

**Contract**: Add `OPENROUTER_API_KEY=###` to `.env.example`. Add `OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}` to the `env:` block of the `npm run build` step in both the `ci` job (`ci.yml:22-25`) and the `deploy` job (`ci.yml:55-57`) — same pattern as the existing Supabase vars, no new secret needs provisioning.

#### 4. Model factory

**File**: `src/lib/ai/model.ts` (new)

**Intent**: Build a configured OpenRouter language model for the app, mirroring `packages/code-reviewer/src/model.ts`'s shape but reading the key from `astro:env/server` instead of `process.env` (Workers has no `process.env`), and defaulting to a cheaper/faster model than the code-reviewer's Sonnet-class default.

**Contract**: Export `createExpenseParserModel(config?: { apiKey?: string; model?: string }): LanguageModel` and `DEFAULT_MODEL = "anthropic/claude-haiku-4.5"`. Throw a clear error if no key resolves (`config.apiKey ?? OPENROUTER_API_KEY` from `astro:env/server`).

#### 5. Expense-parsing service

**File**: `src/lib/services/expense-ai-parser.ts` (new)

**Intent**: Given free text and the user's categories, call the model with `generateText` + `Output.array({ element: draftSchema })` (see Critical Implementation Details) and return normalized draft expenses.

**Contract**: Export `parseExpensesFromText(model: LanguageModel, text: string, categories: { id: string; name: string }[]): Promise<ParsedExpenseDraft[]>`. Input `text` is validated separately (trimmed, 1–500 chars) before this is called. Cap the requested/accepted item count at 20 drafts per call (prompt instruction + a `.max(20)` on the array schema) as a sane bound given no rate limiting exists. Catch `NoObjectGeneratedError`/`NoOutputGeneratedError` (from `"ai"`) and provider/network errors, rethrow as a new `AiParseError` domain error (same pattern as `FutureDateError` etc. in `src/lib/services/expenses.ts:57-83`). Amount normalization per Critical Implementation Details.

#### 6. Shared types

**File**: `src/types.ts`

**Intent**: Add the request/response DTOs for the parse step, following the existing `*Request`/`*Response` naming convention.

**Contract**: Add `ParseExpensesRequest { text: string }`, `ParsedExpenseDraft { description: string; amount: string; categoryId: string | null; categoryName: string | null }`, `ParseExpensesResponse { items: ParsedExpenseDraft[] }`.

#### 7. Parse API route

**File**: `src/pages/api/expenses/parse.ts` (new)

**Intent**: Auth-gate, validate the free text, fetch the user's categories, call the parsing service, and return drafts — nothing is persisted here.

**Contract**: `export const prerender = false;` `POST` follows the existing auth/client-guard pattern (`src/pages/api/expenses.ts:48-56`): 401 if no `context.locals.user`, 500 if Supabase isn't configured. Validate body with a new `parseExpensesRequestSchema` (`z.object({ text: z.string().trim().min(1).max(500) })`); 400 on failure. Fetch categories via `listCategories`. Call `parseExpensesFromText`; on `AiParseError` return `502` with a user-facing message (no retry-able specifics leaked); on success return `200` with `{ items } satisfies ParseExpensesResponse`.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro sync && npx tsc --noEmit` (or the project's existing typecheck path)
- Linting passes: `npm run lint`
- Unit tests pass: `npm run test:unit` (new tests for `expense-ai-parser.ts`: dynamic schema building, successful parse with a mocked model call, `NoObjectGeneratedError` → `AiParseError` mapping, amount normalization)

#### Manual Verification:

- With a real `OPENROUTER_API_KEY` in `.dev.vars`, run `npm run build && npm run preview` (real Cloudflare Workers runtime) and `POST` sample text (e.g. `"lidl 200zł, orlen 150zł"`) to `/api/expenses/parse` — confirm a 200 with two plausible draft items. **This is the frame's go/no-go spike.**
- Confirm a category-less line (e.g. a purchase type with no matching category) returns `categoryId: null`, not an invented id.
- Confirm an unauthenticated request returns 401 and an empty/oversized `text` returns 400.

---

## Phase 2: Bulk-create service + API route

### Overview

Let the confirmed review list be saved in one atomic request, reusing per-item validation already established for single-expense creation.

### Changes Required:

#### 1. Bulk-create service

**File**: `src/lib/services/expenses.ts`

**Intent**: Insert multiple expenses for the signed-in user in a single database round trip so the save is all-or-nothing.

**Contract**: Add `bulkCreateExpenseSchema = z.array(createExpenseSchema).min(1).max(20)` (matching the parser's 20-item cap) and `createExpensesBulk(supabase, userId, inputs: CreateExpenseRequest[]): Promise<Expense[]>`, implemented as a single `supabase.from("expenses").insert(inputs.map(...)).select(EXPENSE_SELECT)` call (array insert = one SQL statement = atomic), reusing `toExpense`/`mapWriteError` from the existing single-create path.

#### 2. Shared types

**File**: `src/types.ts`

**Intent**: DTOs for the bulk endpoint.

**Contract**: Add `BulkCreateExpensesRequest { expenses: CreateExpenseRequest[] }`, `BulkCreateExpensesResponse { expenses: Expense[] }`.

#### 3. Bulk API route

**File**: `src/pages/api/expenses/bulk.ts` (new)

**Intent**: Auth-gate, validate, and persist the confirmed review list.

**Contract**: `export const prerender = false;` `POST` follows the same auth/client-guard/error-mapping pattern as `src/pages/api/expenses.ts:48-76` (`FutureDateError`/`InvalidAmountError` → 422, `CategoryOwnershipError` → 409), validating with `bulkCreateExpenseSchema`. On success, `201` with `{ expenses } satisfies BulkCreateExpensesResponse`.

#### 4. Bulk-create client hook

**File**: `src/components/hooks/useCreateExpensesBulk.ts` (new)

**Intent**: Client-side wrapper mirroring `useCreateExpense.ts`'s shape for the new endpoint.

**Contract**: Export `useCreateExpensesBulk()` returning `{ createExpensesBulk }`, with `CreateExpensesBulkResult = { ok: true; expenses: Expense[] } | { ok: false; error: string }`, same status-code handling (422/409/404 → server message, other non-ok → generic `t("errors.createExpenseFailed")`).

### Success Criteria:

#### Automated Verification:

- Type checking passes
- Linting passes: `npm run lint`
- Unit tests pass: `npm run test:unit` (new tests for `createExpensesBulk`: single insert call with all rows, error mapping identical to single-create, schema `.min(1).max(20)` bounds)

#### Manual Verification:

- `POST /api/expenses/bulk` with a 2-item array under `npm run preview` returns 201 with both expenses; the DB reflects both rows.
- A batch containing one invalid row (e.g. a foreign `categoryId`) fails the whole request (409/422) with **zero** rows persisted — confirms atomicity.

---

## Phase 3: UI — free-text mode + review step

### Overview

Add the mode toggle and free-text/review UI to the add-expense dialog, wired into both places it's mounted (`GlobalAddExpense`, `ExpensesManager`).

### Changes Required:

#### 1. Mode toggle in the dialog shell

**File**: `src/components/expenses/ExpenseFormDialog.tsx`

**Intent**: When `mode === "add"`, let the user switch between the existing structured form and the new free-text flow; `mode === "edit"` never shows the toggle (AI assistance is add-only per FR-026).

**Contract**: Add local `entryMode: "structured" | "ai"` state (default `"structured"`), a small toggle control in the dialog header area, and conditionally render either the existing form JSX or `<AiExpenseEntryForm>`. Add a required `onBulkSubmit: (inputs: CreateExpenseRequest[]) => Promise<void>` prop threaded down to `AiExpenseEntryForm`, alongside the existing `onSubmit`.

#### 2. Free-text + review component

**File**: `src/components/expenses/AiExpenseEntryForm.tsx` (new)

**Intent**: Own the free-text textarea, the parse call, the editable review list, and the confirm action.

**Contract**: Props: `categories: Category[]`, `onBulkSubmit: (inputs: CreateExpenseRequest[]) => Promise<void>`. Internal states: `text`, `status: "idle" | "parsing" | "reviewing" | "confirming"`, `drafts: ParsedExpenseDraft[]` (editable — description/amount/category per row, row removal), `error: string | null`. "Parse" calls `POST /api/expenses/parse`; on failure, show the error inline with a retry action and keep the free-text field populated (per the "inline error + retry" decision) — the mode toggle stays available so the user can always fall back to the structured form. "Confirm" maps `drafts` → `CreateExpenseRequest[]` (each `date` set to today via the same `todayIsoDate()` helper already in `ExpenseFormDialog.tsx:19-21`) and calls `onBulkSubmit`; block confirm while any row's `categoryId` is null (per the "force manual pick" decision) with the same validation-error styling used elsewhere in the dialog. No date field is rendered in the review rows (see Key Discoveries).

#### 3. Wire bulk handler — global trigger

**File**: `src/components/expenses/GlobalAddExpense.tsx`

**Intent**: Implement the bulk-save path analogous to the existing `handleSubmit`.

**Contract**: Add `handleBulkSubmit(inputs: CreateExpenseRequest[])` using `useCreateExpensesBulk`; on success, `closeDialog()` and call `dispatchExpenseCreated()` once (undetailed — `ExpensesManager`'s listener already ignores the event detail and just refetches, per `src/lib/expense-events.ts:6-8` and `ExpensesManager.tsx:86-89`). Pass as `onBulkSubmit` to `ExpenseFormDialog`.

#### 4. Wire bulk handler — expenses page

**File**: `src/components/expenses/ExpensesManager.tsx`

**Intent**: Same bulk-save wiring for the page-local dialog instance.

**Contract**: Add an analogous `handleBulkFormSubmit` using `useCreateExpensesBulk`; on success, `closeFormDialog()` then `await refresh()`. Pass as `onBulkSubmit` to `ExpenseFormDialog` (`ExpensesManager.tsx:229-238`).

#### 5. Copy

**File**: `src/i18n/pl.ts`

**Intent**: Add the new user-facing strings under a new `expense.ai.*` namespace, following the existing flat-key convention (`expense.validation.*` as precedent for nesting).

**Contract**: Keys for: mode toggle labels, free-text placeholder/label, "Parse" button + loading label, per-row category-required validation message, parse-failure message, confirm button + loading label, empty-drafts state (all rows removed).

### Success Criteria:

#### Automated Verification:

- Type checking passes
- Linting passes: `npm run lint`
- Existing expense-dialog-related unit tests still pass: `npm run test:unit`

#### Manual Verification:

- From `/expenses` and from the global add-expense trigger, switch to free-text mode, submit `"lidl 200zł, orlen 150zł"`, see two review rows with plausible amounts/descriptions.
- Edit a row's category and amount, remove a row, confirm — remaining rows appear in the expense list with today's date.
- Leave a row's category unset and try to confirm — blocked with a validation message; the row that failed to auto-match shows the AI's guess was correctly left blank rather than silently assigned.
- Force a parse failure (e.g. temporarily blank the local API key) — inline error + retry shown, structured-form toggle still works.
- Full flow re-verified under `npm run build && npm run preview` (Workers runtime), not just `astro dev`.

---

## Phase 4: Docs & roadmap closeout

### Overview

Reflect the resolved provider/runtime decisions back into the planning artifacts so `roadmap.md` and the PRD stop describing S-17 as blocked on an unmade decision.

### Changes Required:

#### 1. Roadmap

**File**: `context/foundation/roadmap.md`

**Intent**: Close out S-17's blocker now that it's resolved, and update the backlog handoff table.

**Contract**: Update `S-17`'s `Blockers` and `Status` fields (`roadmap.md:190,196`) to reflect implementation, per this plan's phases. Update `Open Roadmap Questions` item 1 (`roadmap.md:215`) to record the resolution (OpenRouter reuse, `astro:env/server` wiring, `claude-haiku-4.5`) instead of "owner: user, block: yes". Update the `S-17` row in the `Backlog Handoff` table (`roadmap.md:211`).

#### 2. PRD

**File**: `context/foundation/prd.md`

**Intent**: Reflect the same resolution in the PRD's Open Questions and Implementation Status sections.

**Contract**: Update Open Question 1 (`prd.md:277`) with the resolution. Update the `FR-025–028` row of the Implementation Status table (`prd.md:271`) from "planned (later slice)" to reflect the roadmap slice id and status once implemented.

### Success Criteria:

#### Automated Verification:

- Linting/formatting passes on the changed markdown: `npm run format`

#### Manual Verification:

- `roadmap.md` and `prd.md` read consistently with the shipped feature — no stray "not yet selected"/"owner: user, block: yes" language remains for S-17.

---

## Testing Strategy

### Unit Tests:

- `expense-ai-parser.test.ts`: dynamic schema construction (enum built from a given category list, `null` allowed), successful parse mapped to `ParsedExpenseDraft[]`, amount normalization (`toFixed(2)`), `NoObjectGeneratedError`/provider-error → `AiParseError` — all via a mocked model/`generateText` call (no real OpenRouter call in CI, per the testing-depth decision).
- `expenses.test.ts` additions: `createExpensesBulk` issues one `.insert()` call with all mapped rows; write-error mapping matches the single-create path; `bulkCreateExpenseSchema` bounds (`.min(1)`, `.max(20)`).
- `useCreateExpensesBulk.test.ts`: status-code → result mapping, mirroring the existing `useCreateExpense.test.ts` pattern.

### Integration Tests:

- None added for the AI call itself (explicit decision — real-provider verification is manual, not CI). Existing `vitest.integration.config.ts`/`vitest.schema-safety.config.ts` suites are unaffected since no schema/migration changes are made.

### Manual Testing Steps:

1. Full happy path (parse → edit → confirm) from both dialog entry points, under `npm run preview`.
2. No-category-match row blocks confirmation until manually picked.
3. Parse failure shows inline error + retry; structured-form fallback always reachable.
4. Bulk-save partial failure (one row with a stale/foreign categoryId) persists zero rows.
5. Unauthenticated `POST` to both new routes returns 401.

## Performance Considerations

The AI call is the dominant latency source (NFR: "may take several seconds"); the UI must show a non-frozen loading state during `parsing`/`confirming` but no additional performance work (caching, streaming) is in scope — see What We're NOT Doing.

## Migration Notes

No database migrations — no new columns or tables.

## References

- Frame brief: `context/changes/ai-assisted-expense-entry/frame.md`
- Roadmap slice: `context/foundation/roadmap.md:183-217`
- PRD requirements: `context/foundation/prd.md:210-219,273-279`
- Existing OpenRouter/AI SDK pattern: `packages/code-reviewer/src/model.ts:1-48`
- Existing add-expense dialog: `src/components/expenses/ExpenseFormDialog.tsx`, `src/components/expenses/GlobalAddExpense.tsx`, `src/components/expenses/ExpensesManager.tsx`
- Existing single-expense service/route: `src/lib/services/expenses.ts`, `src/pages/api/expenses.ts`
- AI SDK structured-output docs (installed version): `packages/code-reviewer/node_modules/ai/docs/03-ai-sdk-core/10-generating-structured-data.mdx`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: AI provider foundation + expense-parsing service (runtime spike)

#### Automated

- [x] 1.1 Type checking passes
- [x] 1.2 Linting passes
- [x] 1.3 Unit tests pass (expense-ai-parser)

#### Manual

- [ ] 1.4 Real OpenRouter call succeeds under `npm run preview` (Workers runtime) — go/no-go spike
- [ ] 1.5 No-match line returns `categoryId: null`
- [ ] 1.6 Auth/validation edge cases (401, 400) confirmed

### Phase 2: Bulk-create service + API route

#### Automated

- [ ] 2.1 Type checking passes
- [ ] 2.2 Linting passes
- [ ] 2.3 Unit tests pass (createExpensesBulk)

#### Manual

- [ ] 2.4 Bulk POST persists all rows under `npm run preview`
- [ ] 2.5 Partial-failure batch persists zero rows (atomicity)

### Phase 3: UI — free-text mode + review step

#### Automated

- [ ] 3.1 Type checking passes
- [ ] 3.2 Linting passes
- [ ] 3.3 Existing expense-dialog unit tests still pass

#### Manual

- [ ] 3.4 Happy path from both entry points (global trigger + /expenses page)
- [ ] 3.5 Edit/remove review rows before confirming
- [ ] 3.6 No-match category blocks confirm
- [ ] 3.7 Parse failure shows inline error + retry, fallback to structured form works
- [ ] 3.8 Full flow re-verified under `npm run preview`

### Phase 4: Docs & roadmap closeout

#### Automated

- [ ] 4.1 Formatting passes on changed markdown

#### Manual

- [ ] 4.2 roadmap.md and prd.md read consistently with the shipped feature
