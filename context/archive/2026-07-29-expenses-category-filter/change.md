---
id: expenses-category-filter
title: Category filter on expenses list
roadmap_ref: S-15
prd_refs: [FR-024]
status: archived
created: 2026-07-29
updated: 2026-07-30
archived_at: 2026-07-30T05:01:44Z
---

# Category filter on expenses list

Add an in-page category picker to the expenses page so the user can filter the
expenses list by category without leaving the page. Builds on the existing
URL-based drill-down (`/expenses?category=<id>`) and the API/service filtering
that already exist: the picker manages client filter state, refetches via
`GET /api/expenses?category=`, and syncs `?category=` in the URL so drill-down
deep-links and bookmarks keep working. Traces to roadmap S-15 / PRD FR-024.
Low risk, additive affordance — no backend changes.
