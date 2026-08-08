# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Integration tests hitting Supabase Auth signUp have no distinguishing failure mode for transient network/rate-limit errors

**Context**: `tests/integration/supabase-client.ts:23` (`signUpTestUser`)

**Problem**: A transient network blip or Auth rate-limit response fails the same way as a genuine RLS/auth regression — the error message alone can't tell them apart, which can cost debugging time chasing a false alarm.

**Rule**: Wrap real Auth `signUp`/`signInWithPassword` calls in test helpers with a short retry (1-2 attempts) on network/5xx errors, but never swallow or retry a 4xx auth-shaped failure (wrong credentials, RLS denial) — a naked single attempt makes flaky infra failures indistinguishable from a real regression.

**Applies to**: Any test helper that hits a real external auth/DB service directly (`tests/integration/**`, `tests/e2e/**`) via `@supabase/supabase-js` or a similar SDK, not just this file.

## Redirect guards must exit before rendering page markup

**Context**: `src/pages/index.astro:5`

**Problem**: The authenticated redirect path sets status and `Location` but still continues rendering landing markup, which can violate a no-content-flash redirect contract.

**Rule**: When implementing authenticated redirects in Astro frontmatter, always `return Astro.redirect(...)` to exit request handling before markup rendering.

**Applies to**: All Astro page frontmatter redirect guards in `src/pages/**` where no-flash auth navigation is required.

## New workspace packages under packages/* are invisible to root CI unless explicitly wired in

**Context**: `eslint.config.js:75`, `vitest.config.ts:5` (`packages/code-reviewer`)

**Problem**: Root lint/test explicitly exclude `packages/code-reviewer`, and the `ai-code-review` composite action only runs `npm ci` + `review:pr` — never lint or test. The package ships a real, passing test suite (`schemas.test.ts`, `prompts.test.ts`, `gate.test.mjs`) that CI never executes, so regressions in it go undetected.

**Rule**: Any new `packages/*` subpackage must get its own lint+test step wired into a workflow (`ci.yml` or a dedicated job) before its tests count as CI coverage — a passing local test suite that no workflow invokes provides no regression protection.

**Applies to**: `packages/**` subpackages added outside the root workspace, and any new composite action/workflow that consumes one.
