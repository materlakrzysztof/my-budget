# Public Landing Page — Plan Brief

> Full plan: `context/changes/landing-page/plan.md`

## What & Why

Replace the untouched starter boilerplate at `/` with a real public landing page for
**MyBudget** that describes the app's shipped capabilities, and route authenticated
visitors straight to the dashboard. This is roadmap slice **S-12 `landing-page`** /
PRD **FR-021** — a public shop-window for visitors, while returning users skip to the
app.

## Starting Point

Today `/` renders `src/components/Welcome.astro` — the generic "10x Astro Starter"
boilerplate (English, generic dev-tooling cards). `/` is public and has **no** authed
redirect, so a logged-in user sees the boilerplate instead of the dashboard. The
dashboard (`/dashboard`) exists and is live. No i18n layer exists yet.

## Desired End State

Logged-out visitors to `/` see a MyBudget hero (headline, subcopy, a primary **Sign
up** CTA + secondary **Sign in**) and a three-card grid describing shipped features —
expense logging & categories, the monthly dashboard, per-user currency — in the
existing cosmic style, with a real MyBudget page title. Logged-in visitors are
redirected server-side to `/dashboard`. Existing auth-redirect behavior is untouched.

## Key Decisions Made

| Decision                | Choice                                             | Why (1 sentence)                                                                     | Source |
| ----------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------ | ------ |
| Copy language           | English now (translate in S-11)                    | Consistent with the currently-English app; the Polish key-layer is a separate slice  | Plan   |
| Content depth           | Hero + 3 feature cards (reuse existing structure)  | Proven on-brand layout already exists; enough to describe the app                     | Plan   |
| Features shown          | Only shipped capabilities                          | Honest shop-window — nothing advertised that a new signup can't do today             | Plan   |
| CTA emphasis            | Sign up primary, Sign in secondary                 | Standard landing convention; optimizes new-visitor conversion, keeps sign-in present | Plan   |
| Header                  | Reuse the shared Topbar                            | Zero extra work; authed users are redirected away so never see it here               | Plan   |
| Authed redirect         | Server redirect in `index.astro` (`Astro.locals.user`) | Localized to the one page; leaves the global auth guardrail (FR-014) untouched   | Plan   |
| Branding                | "MyBudget"                                          | Matches the PRD project name; gives the public page a real title/SEO                 | Plan   |

## Scope

**In scope:**
- Server-side authed redirect `/` → `/dashboard` in `index.astro`.
- Real page title / optional meta for the landing.
- Rewrite `Welcome.astro` into the MyBudget landing (hero + 3 shipped-feature cards,
  Sign-up-primary CTA), reusing the cosmic aesthetic.

**Out of scope:**
- Polish translation / message-key layer (S-11).
- Advertising unbuilt AI-assisted entry.
- Long-form marketing (screenshots, testimonials, how-it-works).
- Dedicated marketing header / suppressing the Topbar.
- Any change to `middleware.ts`, `PROTECTED_ROUTES`, or auth flows.

## Architecture / Approach

Two files, two phases. `index.astro` gains a frontmatter branch:
`if (Astro.locals.user) return Astro.redirect("/dashboard")`, plus a MyBudget
`title`. `Welcome.astro` is rewritten in place — same cosmic scaffolding, new copy,
new CTA hierarchy, three shipped-capability cards. No new components, no data flow, no
middleware change, no client JS.

## Phases at a Glance

| Phase                             | What it delivers                                        | Key risk                                                    |
| --------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------- |
| 1. Redirect + page metadata       | Authed `/` → `/dashboard`; real MyBudget title          | Must not break the global auth-redirect guardrail (FR-014)  |
| 2. Product landing content        | MyBudget hero + shipped-feature cards + Sign-up CTA     | Copy accuracy — only advertise what's actually built        |

**Prerequisites:** None — dashboard already live as the redirect target; no dependency
on S-11.
**Estimated effort:** ~1 short session across 2 small phases, 2 files.

## Open Risks & Assumptions

- Assumes the English strings will be lifted into message keys during S-11 with a
  small edit — written plainly to make that easy.
- Assumes "MyBudget" is the intended visible product name (from prd.md); a different
  intended brand would mean a copy tweak.
- The authed redirect uses `Astro.locals.user` already resolved by middleware — must
  render before any landing markup to avoid a content flash.

## Success Criteria (Summary)

- Logged out, `/` shows the MyBudget landing; logged in, `/` lands on `/dashboard`
  with no flash.
- Existing auth redirects (unauthenticated → `/auth/signin`) still work unchanged.
- Landing features only shipped capabilities, with a clear Sign-up-primary CTA;
  `npm run build` / `lint` / `format` clean.
