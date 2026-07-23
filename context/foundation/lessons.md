# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Integration tests hitting Supabase Auth signUp have no distinguishing failure mode for transient network/rate-limit errors

**Context**: `tests/integration/supabase-client.ts:23` (`signUpTestUser`)

**Problem**: A transient network blip or Auth rate-limit response fails the same way as a genuine RLS/auth regression — the error message alone can't tell them apart, which can cost debugging time chasing a false alarm.

**Rule**: Wrap real Auth `signUp`/`signInWithPassword` calls in test helpers with a short retry (1-2 attempts) on network/5xx errors, but never swallow or retry a 4xx auth-shaped failure (wrong credentials, RLS denial) — a naked single attempt makes flaky infra failures indistinguishable from a real regression.

**Applies to**: Any test helper that hits a real external auth/DB service directly (`tests/integration/**`, `tests/e2e/**`) via `@supabase/supabase-js` or a similar SDK, not just this file.
