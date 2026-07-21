---
change_id: account-signin-signout
title: Confirm account creation and sign-in/out, close the redirect gap, add E2E coverage
status: implementing
created: 2026-07-21
updated: 2026-07-21
archived_at: null
---

## Notes

Roadmap slice S-01 (`context/foundation/roadmap.md`). FR-001/FR-002 are already implemented and verified live in production (`context/deployment/deploy-plan.md`). This change is a confirmation pass: close the one real gap found (missing `emailRedirectTo`), stand up the project's first Playwright E2E coverage, and lock in the critical auth path before S-02 (`expense-categories`) builds on top of it.
