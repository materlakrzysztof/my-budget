---
change_id: landing-page
title: Public landing page (+ authed redirect to dashboard)
status: archived
created: 2026-07-27
updated: 2026-07-28
archived_at: 2026-07-28
---

## Notes

Roadmap slice S-12 `landing-page`. PRD FR-021: a visitor sees a public landing page
describing the app; authenticated users proceed to the dashboard. Replaces the
untouched starter boilerplate (`src/components/Welcome.astro`, "10x Astro Starter")
with a real MyBudget landing, and adds a server-side authed redirect in
`src/pages/index.astro`.

Key decisions (see plan-brief.md): copy ships in **English now** (Polish key-layer is
S-11 `polish-ui`, not yet built — the strings get retro-fitted there); hero + 3
feature cards reusing the existing cosmic aesthetic; feature **only shipped
capabilities** (expense logging + categories, monthly dashboard, per-user currency) —
no not-yet-built AI entry; **Sign up primary / Sign in secondary** CTA; reuse the
shared Topbar; authed → `/dashboard` via a server redirect in `index.astro` (global
auth guardrail FR-014 untouched); product name **"MyBudget"**.
