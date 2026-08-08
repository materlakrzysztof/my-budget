# Sticky Navigation Header — Plan Brief

> Full plan: `context/changes/sticky-nav-header/plan.md`

## What & Why

Make the navigation header (`Topbar`) stick to the top of the viewport so it stays
visible while the page scrolls, instead of scrolling away with the content. This
keeps navigation and the sign-out control reachable at any scroll position.

## Starting Point

`Topbar.astro` is a semi-transparent frosted card rendered in normal document flow,
boxed inside a `p-4 sm:p-8` wrapper in `Layout.astro` and followed by `<slot />`. It
scrolls off-screen with the page. Every page provides its own `bg-cosmic min-h-screen`
content wrapper, and modal dialogs render at `z-50`.

## Desired End State

The header is pinned flush to the top of the viewport on all screen sizes, with an
opaque cosmic-toned `backdrop-blur` background so content stays readable as it scrolls
beneath. The bar spans the full viewport width, sits below open dialogs,
and the config-error Banner still scrolls away in normal flow.

## Key Decisions Made

| Decision               | Choice                                                        | Why (1 sentence)                                                                 | Source |
| ---------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------ |
| Background treatment   | Opaque `bg-[#0f1529] backdrop-blur-md`                        | Guarantees readability with a subtle frosted enhancement                         | Plan   |
| Breakpoint behavior    | Sticky on all breakpoints                                     | Persistent nav benefits mobile users most; consistent UX                         | Plan   |
| Positioning structure  | Lift Topbar out of `p-4 sm:p-8` wrapper, pin flush at `top-0` | Avoids a padding gap above the header where content would otherwise peek through | Plan   |
| Scroll-driven behavior | Static appearance (no JS)                                     | Keeps the static Astro component JS-free and robust; nothing to hydrate          | Plan   |
| Config Banner          | Left in normal flow (scrolls away)                            | Rare misconfiguration state; not worth the stacking complexity to pin            | Plan   |
| Layering               | `z-40` (below dialog `z-50`)                                  | Modals must continue to fully cover the header                                   | Plan   |

## Scope

**In scope:**

- Restructure `Layout.astro` to lift `<Topbar />` out of the padding wrapper.
- Restyle `Topbar.astro` as a sticky, frosted, full-width `top-0 z-40` bar with its
  own padding.

**Out of scope:**

- Scroll-driven effects (shadow-on-scroll, hide-on-scroll).
- Mobile header redesign (keeps existing `flex-col` → `sm:flex-row`).
- Pinning the config-error Banner.
- Any change to links, routes, auth, page content, or cards.

## Architecture / Approach

Pure presentational change across two files. `Layout.astro` renders `<Topbar />` as a
direct body-level child (no `p-4 sm:p-8` box). `Topbar.astro`'s root becomes a
full-width `sticky top-0 z-40` bar carrying its own padding and an opaque cosmic-toned
`backdrop-blur` background. No new components, no client-side JS, no data flow.

## Phases at a Glance

| Phase                    | What it delivers                             | Key risk                                                       |
| ------------------------ | -------------------------------------------- | -------------------------------------------------------------- |
| 1. Sticky frosted header | Header pins flush to top, frosted & readable | Padding-gap artifact if the wrapper isn't restructured cleanly |

**Prerequisites:** None — no dependencies or access needed beyond the running dev app.
**Estimated effort:** ~1 short session, single phase, two files.

## Open Risks & Assumptions

- Assumes the document/`body` is the scroll container (verified — no custom `overflow`
  wrapper), so CSS `position: sticky` works without extra plumbing.
- The opaque cosmic base (`bg-[#0f1529]`) must visually sit with the cosmic gradient;
  `backdrop-blur` is an enhancement rather than a readability dependency.
- The taller `flex-col` mobile header consuming slightly more vertical space is an
  accepted trade-off.

## Success Criteria (Summary)

- Header stays pinned to the top while scrolling on `/dashboard`, `/expenses`,
  `/settings`, with content passing legibly underneath and no gap above it.
- Open dialogs fully cover the header; active-link highlighting still works.
- `npm run build`, `npm run lint`, and `npx prettier --check src/layouts/Layout.astro src/components/Topbar.astro` pass.
