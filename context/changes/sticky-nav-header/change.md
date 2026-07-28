---
change_id: sticky-nav-header
title: Sticky navigation header (Topbar pins to top on scroll)
status: implemented
created: 2026-07-27
updated: 2026-07-28
archived_at: null
---

## Notes

Presentational change: make the `Topbar` navigation header stick to the top of the
viewport while the page scrolls, with a frosted readable background. Touches
`src/layouts/Layout.astro` (structure) and `src/components/Topbar.astro` (sticky +
background). No data model, API, or state changes.

Key decisions (see plan-brief.md): frosted backdrop-blur background, sticky on all
breakpoints, header lifted out of Layout's padding wrapper to pin flush at top-0,
static appearance (no scroll-driven JS), config Banner left in normal flow. Header
sits at z-40 so dialogs (z-50) still cover it.
