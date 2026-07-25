---
change_id: account-signin-signout
title: Confirm account creation and sign-in/out, close the redirect gap, add E2E coverage
status: archived
created: 2026-07-21
updated: 2026-07-23
archived_at: 2026-07-23T12:38:14Z
---

## Notes

Roadmap slice S-01 (`context/foundation/roadmap.md`). FR-001/FR-002 are already implemented and verified live in production (`context/deployment/deploy-plan.md`). This change is a confirmation pass: close the one real gap found (missing `emailRedirectTo`), stand up the project's first Playwright E2E coverage, and lock in the critical auth path before S-02 (`expense-categories`) builds on top of it.

**2026-07-21 pivot**: dropped the local-Supabase/Docker approach (previously committed as 18321ed) in favor of a dedicated E2E Supabase cloud project — avoids Docker, avoids manually swapping `.dev.vars`, and runs closer to production. Phase 1 re-opened; see `plan.md`.
