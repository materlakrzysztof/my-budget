# AI-assisted expense entry (S-17) — Plan Brief

> Full plan: `context/changes/ai-assisted-expense-entry/plan.md`
> Frame brief: `context/changes/ai-assisted-expense-entry/frame.md`

## What & Why

S-17 is not blocked on "which AI provider" — that evaluation already happened and produced a working answer (OpenRouter + Vercel AI SDK, used today by `packages/code-reviewer`). It's blocked on two narrower things: an explicit decision to reuse that same OpenRouter account for a new purpose (parsing users' personal expense text), and verifying that integration actually runs under this app's Cloudflare Workers runtime rather than only Node/CI. This plan resolves both and builds the full free-text entry + review flow (PRD FR-025–028).

## Starting Point

The add-expense dialog (S-16, done) is a structured-only form with no free-text scaffolding. `POST /api/expenses` accepts one expense per call. No AI SDK code exists anywhere under the app's `src/` — the only precedent is `packages/code-reviewer`, a standalone package that calls OpenRouter from a Node CLI via plain `process.env`, never from the deployed Worker.

## Desired End State

From the add-expense dialog, a user switches to free-text mode, types e.g. "lidl 200zł, orlen 150zł", and sees an editable review list of parsed expenses (amount, description, category) they must adjust/confirm before anything saves — with category left blank whenever the model can't confidently match one of the user's existing categories. The structured form remains one click away at all times. The whole flow is verified working under the real Cloudflare Workers runtime, not just local dev.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Provider | Reuse OpenRouter, same account | Already evaluated and paid for; frame confirmed reuse is acceptable for this data | Frame |
| Secret wiring | `astro:env/server` + CI build-time env, no `wrangler secret put` | Matches the app's existing `SUPABASE_URL`/`KEY` convention exactly — no new infra | Question round 1 |
| Model | `anthropic/claude-haiku-4.5` (not the code-reviewer's Sonnet default) | User chose cheaper/faster; live OpenRouter pricing check picked a concrete, current model in the same trusted provider family | Question round 1 + Plan research |
| Bulk save | New atomic `POST /api/expenses/bulk` | Confirming a reviewed list must be all-or-nothing, not partially saved | Question round 1 |
| No category match | Leave blank, force manual pick | Never silently mis-categorize; enforced at the Zod schema level via a per-request category-id enum | Question round 1 |
| Parse/save failure UX | Inline error + retry; structured form always available | User is never blocked; reuses the dialog's existing fallback for free | Question round 2 |
| Rate limiting | None in this slice | Matches the app's no-rate-limiting precedent everywhere else; revisit if usage data warrants it | Question round 2 |
| AI testing depth | Unit tests with a mocked AI SDK call only | Deterministic, zero CI cost/flakiness; real integration verified manually via the runtime spike | Question round 2 |
| Phase grouping | Runtime spike folded into Phase 1's real service, not a throwaway spike | Verifying Workers-fit requires an actual route; building it for real avoids disposable code | Plan |

## Scope

**In scope:**
- Free-text mode toggle + review UI in the existing add-expense dialog
- `POST /api/expenses/parse` (AI parse, not persisted) and `POST /api/expenses/bulk` (atomic save)
- `OPENROUTER_API_KEY` wired into the deployed app via the existing secret convention
- Unit tests (mocked AI calls); manual Workers-runtime verification
- `roadmap.md`/`prd.md` updates closing out S-17's blocker

**Out of scope:**
- New `expenses` table columns / AI-provenance tracking
- Date field in the AI review step (always defaults to today)
- Rate limiting, streaming partial output, live-provider integration tests in CI
- Automatic category creation

## Architecture / Approach

New app-local `src/lib/ai/model.ts` (OpenRouter model factory) + `src/lib/services/expense-ai-parser.ts` (prompt, per-user dynamic Zod schema, `generateText` + `Output.array()`), called from a new `/api/expenses/parse` route. Confirmed drafts flow through a new `/api/expenses/bulk` route backed by a single atomic multi-row insert. A new `AiExpenseEntryForm` React component, toggled inside the existing `ExpenseFormDialog`, owns the free-text → parse → review → confirm UI, wired into both existing dialog mount points (`GlobalAddExpense`, `ExpensesManager`).

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. AI provider foundation + parsing service | Secret wiring, model factory, parse service + route — this **is** the runtime spike | OpenRouter call might not resolve under `workerd`; go/no-go gate before continuing |
| 2. Bulk-create service + route | Atomic multi-row save endpoint | Partial-failure semantics must be verified, not assumed |
| 3. UI — free-text mode + review step | Toggle, review list, wiring into both dialog mount points | Review-list UX (no date field, forced category pick) diverges subtly from the structured form |
| 4. Docs & roadmap closeout | `roadmap.md`/`prd.md` updated | Low — mechanical doc sync |

**Prerequisites:** S-16 (done). A real `OPENROUTER_API_KEY` value available locally in `.dev.vars` to run the Phase 1 spike.
**Estimated effort:** ~3-4 sessions across 4 phases; Phase 1 is the highest-risk/most novel, Phases 2-4 are comparatively routine given existing patterns to follow.

## Open Risks & Assumptions

- If Phase 1's manual Workers-runtime spike fails (OpenRouter/AI SDK doesn't resolve under `workerd`), the reframe in `frame.md` collapses back toward "provider not actually usable" and S-17 stays genuinely blocked pending a different technical approach.
- `anthropic/claude-haiku-4.5` pricing/availability was checked live during planning; if it's retired by implementation time, swap `DEFAULT_MODEL` in `src/lib/ai/model.ts` for a current equivalent (the existing `OPENROUTER_MODEL` env override already covers this without a code change).

## Success Criteria (Summary)

- A user can parse free text into draft expenses, edit/confirm them, and see them saved — without ever losing access to the structured form.
- The full flow works under the deployed Cloudflare Workers runtime, not just local Vite dev.
- No parsed expense is ever saved with a category the model invented or guessed low-confidence — it's either a real existing category or blank, enforced by validation.
