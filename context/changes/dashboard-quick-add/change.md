---
id: dashboard-quick-add
title: Dashboard quick-add expense
roadmap_ref: S-10
prd_refs: [FR-019]
status: impl_reviewed
created: 2026-07-29
updated: 2026-07-29
---

# Dashboard quick-add expense

Let the user start adding an expense in one click from the dashboard via an
in-place dialog — no navigation. On save, the dashboard summary re-fetches and
updates in place. Traces to roadmap S-10 / PRD FR-019. Prerequisite S-08
(monthly-dashboard) is shipped; this slice also extracts the shared create-expense
hook that S-16 (add-expense-dialog) will build on.
