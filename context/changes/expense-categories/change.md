---
change_id: expense-categories
title: View default expense categories and add new ones with a similar-name guard
status: implemented
created: 2026-07-21
updated: 2026-07-22
archived_at: null
---

## Notes

Roadmap slice S-02 (`context/foundation/roadmap.md`). Targets FR-003 (view default categories) and FR-005 (add a new category with a description; system warns/blocks if a similar name already exists). First real build slice: introduces the `categories` table, its RLS policy, the first zod usage, the first `src/lib/services/` module, the first `src/types.ts`, and the first JSON (fetch-based) API contract in this codebase. Depends on S-01 (`account-signin-signout`).
