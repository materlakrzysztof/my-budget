---
id: add-expense-dialog
title: Add-expense dialog (global entry point)
roadmap_ref: S-16
prd_refs: [FR-025]
status: implemented
created: 2026-07-29
updated: 2026-07-30
---

# Add-expense dialog (global entry point)

Unify expense entry behind a single, app-wide in-place dialog. The Topbar
"Add Expense" action opens the structured add-expense dialog on any page (no
navigation), instead of routing to `/expenses?action=add`. Extracts the shared
`useCreateExpense` hook (which S-10 will also reuse) and establishes an
`expense-created` refresh event so open pages update in place. Leaves a clean
seam for S-17's free-text/AI mode toggle (FR-026) without shipping any AI code.
Traces to roadmap S-16 / PRD FR-025.
