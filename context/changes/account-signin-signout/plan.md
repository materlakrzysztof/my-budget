# Account Creation & Sign-In/Out — Confirmation, Redirect Fix, E2E Coverage — Implementation Plan

## Overview

Roadmap slice `S-01` (`context/foundation/roadmap.md`) targets FR-001 ("user can create an account") and FR-002 ("user can log in and log out"). Both are already implemented and verified end-to-end in production (`context/deployment/deploy-plan.md`). This plan is a confirmation pass, not new feature work: it closes the one real gap found during research (a hardcoded reliance on Supabase's static Site URL for the signup confirmation link), stands up the project's first Playwright E2E infrastructure, and locks in risk-tied browser coverage for the critical auth path before S-02 (`expense-categories`) and S-03 build on top of it.

## Current State Analysis

- `src/pages/api/auth/{signup,signin,signout}.ts` implement create-account, sign-in, and sign-out against Supabase Auth via `@supabase/ssr`, each redirecting on success/failure.
- `src/components/auth/{SignUpForm,SignInForm}.tsx` provide client-side validation (email format, password ≥ 6 chars, confirm-password match) and render server errors via `ServerError.tsx`, which just displays whatever `error.message` string it's given.
- `src/middleware.ts` protects `/dashboard`, redirecting unauthenticated users to `/auth/signin`.
- `src/components/Topbar.astro` conditionally renders "Sign in / Sign up" vs. the signed-in user's email + a "Sign out" form, based on `Astro.locals.user`.
- `src/pages/auth/confirm-email.astro` already branches on `import.meta.env.DEV`: in dev it shows "Registration successful — you can now sign in" (no email step); in prod it shows "check your email."
- `supabase/config.toml`'s `[auth.email]` has `enable_confirmations = false` — local Supabase never requires (or sends) a confirmation email, which is exactly what `confirm-email.astro`'s dev branch already assumes.
- `context/deployment/deploy-plan.md` documents a known gotcha: `signup()` doesn't set `emailRedirectTo`, so Supabase falls back to the project's static **Site URL** dashboard setting. This was hand-fixed once in the Supabase dashboard for the current production URL, but breaks silently the moment a second environment (a preview deploy, a new project) needs a different confirmation-link target.
- There is no automated test coverage anywhere in the repo — no unit test runner, no Playwright — and CI (`.github/workflows/ci.yml`) runs lint + build only.

## Desired End State

FR-001/FR-002 are confirmed correct across environments — the signup confirmation link always points at the origin that issued it, not a manually-maintained dashboard setting — and the account-creation/sign-in/sign-out path has a green, risk-tied Playwright suite that future slices can extend and that fails the moment auth or middleware regresses.

Verify via: `npm run test:e2e` passes locally against `npx supabase start` + `npm run dev`.

### Key Discoveries:

- `src/pages/auth/confirm-email.astro:4` — `isAutoConfirmed = import.meta.env.DEV` already encodes the dev/prod split this plan's E2E tests must run against (dev, auto-confirmed, no email).
- `supabase/config.toml:209` — `enable_confirmations = false` is the local-only setting that makes dev-mode auto-confirmation possible; it does not affect the deployed cloud project.
- `context/deployment/deploy-plan.md:98` — prior art on the exact redirect gotcha this plan fixes, including how it was worked around once by hand.
- `src/components/auth/ServerError.tsx:10` — server errors render as plain text in a `<p>`, no distinct ARIA role — E2E assertions should use `getByText`, not `getByRole`, for these.

## What We're NOT Doing

- Not touching categories or expenses (`S-02`, `S-03` — separate roadmap slices).
- Not wiring E2E into CI. Running Playwright in CI would also require a local Supabase instance (Docker) in the runner, which is a real added complexity this `low-complexity`-goal slice defers; noted alongside the existing "CI auto-deploy-on-merge" item already parked in `context/foundation/roadmap.md`.
- Not adding double-submit protection or hardening the post-login redirect target — explicitly declined during planning; the existing pending-state UX and hardcoded `/` redirect are considered sufficient for now.
- Not changing password policy, adding MFA, OAuth providers, or any auth capability beyond FR-001/FR-002.
- Not restyling the auth pages (the starter's placeholder cosmic-gradient theme) — cosmetic, out of scope for this slice.

## Implementation Approach

Two phases: first close the concrete correctness gap and stand up the test infrastructure as prerequisite build work (ordinary code + config changes); then drive the actual E2E test generation through the project's own `/10x-e2e` skill against the running local dev stack, reusing the dev-mode auto-confirm behavior the scaffold already anticipates rather than fighting it.

## Critical Implementation Details

**Local dev auto-confirms; E2E must run against local Supabase, not the cloud project.** Because `supabase/config.toml` sets `enable_confirmations = false`, `npx supabase start` never requires or sends a confirmation email — `supabase.auth.signUp()` returns an already-usable session locally, matching `confirm-email.astro`'s `import.meta.env.DEV` branch. E2E specs must assert against that dev-mode copy ("Registration successful… You can now sign in") and must never attempt to read or click a confirmation email locally, since none is sent. This also means the `emailRedirectTo` fix in Phase 1 can't be manually verified against local dev directly (no email is ever generated there) — the manual verification step instead temporarily flips `enable_confirmations` on to force a real email into the local Inbucket viewer, then reverts it.

**`.dev.vars` must point at local Supabase before any of this works — it currently doesn't.** `confirm-email.astro`'s `import.meta.env.DEV` check only controls which _copy_ is shown; it has no relationship to which Supabase project `npm run dev` is actually talking to. As of this plan, `.dev.vars` still holds the **cloud** project's URL/anon key (set up in `context/deployment/deploy-plan.md`'s one-time prod smoke test) — so today, `npm run dev` would show the reassuring dev-mode "Registration successful" copy while the cloud project silently still requires a real confirmation click, breaking every check below. Before starting Phase 1's manual verification (or Phase 2's E2E work), back up the current `.dev.vars` values, run `npx supabase start`, and replace `.dev.vars` with the printed local API URL and anon key (`npx supabase status` reprints them later if needed).

## Phase 1: Fix the email-redirect gap and stand up Playwright E2E infrastructure

### Overview

Closes the one real correctness gap found in the shipped auth flow, then adds the test infrastructure Phase 2 depends on. No behavior changes to signin/signout; no changes to categories/expenses.

### Changes Required:

#### 1. Signup confirmation redirect

**File**: `src/pages/api/auth/signup.ts`

**Intent**: Make the confirmation link Supabase emails always point at the origin that issued the signup request, instead of relying solely on the Supabase project's static Site URL dashboard setting — closing the gap `context/deployment/deploy-plan.md` flagged as a manual, easy-to-forget step per environment.

**Contract**: Pass an explicit `emailRedirectTo` in the `signUp()` call's `options`, derived from the request's own URL so it resolves correctly under any origin (localhost, a preview branch, the production Workers domain) without hardcoding one:

```ts
const { error } = await supabase.auth.signUp({
  email,
  password,
  options: { emailRedirectTo: new URL("/auth/confirm-email", context.url).toString() },
});
```

#### 2. Playwright dependency and script

**File**: `package.json`

**Intent**: Give the project a way to install and run Playwright, matching what `/10x-e2e` assumes is already in place ("a way to run a single spec").

**Contract**: Add `@playwright/test` to `devDependencies`; add a `"test:e2e": "playwright test"` script.

#### 3. Playwright configuration

**File**: `playwright.config.ts` (new)

**Intent**: Wire Playwright to boot the existing local dev workflow automatically — `npm run dev` against `http://localhost:4321` — rather than introducing a separate test-only server or build step.

**Contract**: `testDir` set to `tests/e2e` (the file-placement default `/10x-e2e` falls back to when no convention exists yet); `use.baseURL` set to `http://localhost:4321`; `webServer` runs `npm run dev`, reuses an existing server outside CI (`reuseExistingServer: !process.env.CI`), and treats `process.env.CI` as the signal to always start fresh.

#### 4. Ignore Playwright output

**File**: `.gitignore`

**Intent**: Keep generated test artifacts out of version control, consistent with the existing `dist/`/`.astro/` entries.

**Contract**: Add `test-results/` and `playwright-report/`.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Type checking passes: `npx astro check`
- Build passes: `npm run build`
- Playwright config is valid and discoverable: `npx playwright test --list` reports `Total: 0 tests in 0 files` (Playwright exits 1 with "No tests found" when the config loads correctly but no specs exist yet — `/10x-e2e` adds the first ones in Phase 2)

#### Manual Verification:

- Precondition: back up the current (cloud) `.dev.vars` values, run `npx supabase start`, and replace `.dev.vars` with the printed local API URL and anon key — confirm `npm run dev` is now talking to local Supabase, not the cloud project.
- Regression check: with local Supabase running (`npx supabase start`) and `npm run dev`, sign up with a new email — confirm the existing dev-mode flow (auto-confirmed, no email step) still lands on `/auth/confirm-email` with the "Registration successful" copy and then signs in normally.
- Redirect-fix check: temporarily set `enable_confirmations = true` under `[auth.email]` in `supabase/config.toml`, restart local Supabase, sign up with a new email, open the local Inbucket viewer (`http://127.0.0.1:54324`), and confirm the confirmation link's origin matches `http://localhost:4321` (not a stale or hardcoded value). Revert the config change afterward.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: E2E-cover the account creation and sign-in/out critical path

### Overview

Drives risk-tied Playwright coverage for the three behaviors this slice cares about protecting, via `/10x-e2e account-signin-signout phase 2`: the happy path proving FR-001/FR-002 end-to-end, and the two edge cases selected during planning (duplicate email, wrong password) — chosen because they're the most likely real-world stumbles and, for wrong-password, a basic no-user-enumeration security check.

### Changes Required:

#### 1. Happy-path critical flow

**File**: `tests/e2e/auth-happy-path.spec.ts` (new, generated by `/10x-e2e`)

**Intent**: Prove the full FR-001/FR-002 journey survives as one real, cross-boundary flow: sign up → dev-mode auto-confirm → sign in → reach the protected `/dashboard` → sign out → confirm `Topbar` reverts to "Not signed in" **and** that `/dashboard` is actually inaccessible again (redirects to `/auth/signin`) — the real proof of "log out," not just a UI-state check. This is the exact sequence `deploy-plan.md` verified by hand once in production; automating it catches a regression the moment auth or `middleware.ts` changes.

**Contract**: One spec, role-based locators, a unique timestamped test email, no `waitForTimeout` — per `references/e2e-quality-rules.md`.

#### 2. Duplicate-email signup

**File**: `tests/e2e/auth-duplicate-email.spec.ts` (new, generated by `/10x-e2e`)

**Intent**: Confirm Supabase's "already registered" error surfaces to the user via `ServerError` rather than failing silently or with a confusing message.

**Contract**: Sign up once, then attempt signup again with the same email; assert the error text renders (`getByText`, per `ServerError.tsx`'s plain-`<p>` markup).

#### 3. Wrong-password signin

**File**: `tests/e2e/auth-wrong-password.spec.ts` (new, generated by `/10x-e2e`)

**Intent**: Confirm signin with a valid email and an incorrect password shows a clear error without revealing whether the email itself is registered (basic user-enumeration hygiene).

**Contract**: Sign up a user, then attempt signin with a wrong password; assert a generic error renders and the user is not redirected to `/`.

### Success Criteria:

#### Automated Verification:

- `npx playwright test tests/e2e/auth-happy-path.spec.ts` passes
- `npx playwright test tests/e2e/auth-duplicate-email.spec.ts` passes
- `npx playwright test tests/e2e/auth-wrong-password.spec.ts` passes
- Full E2E suite passes: `npm run test:e2e`

#### Manual Verification:

- For each of the three specs, confirm the deliberate-break check `/10x-e2e` runs actually turned the test red before the fix/revert (not a decorative assertion).
- Confirm the full suite (`npm run test:e2e`) still matches the behavior `deploy-plan.md` verified manually in production — no regression introduced by Phase 1's redirect fix.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- None planned. `SignUpForm`/`SignInForm`'s client-side `validate()` logic (email format, password length, confirm-match) is simple, already exercised indirectly by the E2E happy path, and not worth a separate unit layer for this slice.

### Integration Tests:

- Not applicable — this stack has no dedicated integration-test layer; Playwright E2E fills that role here since the risks (middleware redirects, Supabase error surfacing, session cookies) only manifest across real boundaries.

### Manual Testing Steps:

1. Back up the current (cloud) `.dev.vars` values, run `npx supabase start`, and replace `.dev.vars` with the printed local API URL and anon key.
2. `npm run dev`.
3. Sign up with a new email; confirm the dev-mode "Registration successful" page, then sign in.
4. Confirm `/dashboard` shows the signed-in email and a working "Sign out" button; confirm `Topbar` reflects signed-in state on other pages.
5. Sign out; confirm `Topbar` reverts to "Sign in / Sign up" and `/dashboard` redirects to `/auth/signin`.
6. Repeat the redirect-fix manual check from Phase 1 (temporarily enabling confirmations) before considering the change done.

## Performance Considerations

None — this change touches only auth request handling (already fast, single Supabase call) and adds a local-only test layer with no production runtime impact.

## Migration Notes

Not applicable — no data model or schema changes in this slice.

## References

- Roadmap slice: `context/foundation/roadmap.md` (`S-01`)
- Prior deploy verification: `context/deployment/deploy-plan.md`
- PRD requirements: `context/foundation/prd.md` (FR-001, FR-002)
- E2E conventions: `.claude/skills/10x-e2e/SKILL.md`, `.claude/skills/10x-e2e/references/`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Fix the email-redirect gap and stand up Playwright E2E infrastructure

#### Automated

- [x] 1.1 Lint passes: `npm run lint`
- [x] 1.2 Type checking passes: `npx astro check`
- [x] 1.3 Build passes: `npm run build`
- [x] 1.4 Playwright config is valid and discoverable: `npx playwright test --list` reports 0 tests in 0 files

#### Manual

- [x] 1.5 Precondition: `.dev.vars` repointed at local Supabase (not cloud)
- [x] 1.6 Regression check: dev-mode auto-confirm signup/signin flow still works
- [x] 1.7 Redirect-fix check: confirmation email link origin verified via local Inbucket

### Phase 2: E2E-cover the account creation and sign-in/out critical path

#### Automated

- [ ] 2.1 `tests/e2e/auth-happy-path.spec.ts` passes
- [ ] 2.2 `tests/e2e/auth-duplicate-email.spec.ts` passes
- [ ] 2.3 `tests/e2e/auth-wrong-password.spec.ts` passes
- [ ] 2.4 Full E2E suite passes: `npm run test:e2e`

#### Manual

- [ ] 2.5 Each spec's deliberate-break check confirmed red-then-green
- [ ] 2.6 Full suite re-confirmed against `deploy-plan.md`'s production behavior
