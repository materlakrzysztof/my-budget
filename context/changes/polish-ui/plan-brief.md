# Polish UI (message-key layer) — Plan Brief

> Full plan: `context/changes/polish-ui/plan.md`

## What & Why

Present MyBudget's entire user-facing UI in Polish, with all strings externalized
to a lightweight typed message-key layer so a future language could be added
without a rewrite. The app is in daily use by one Polish household budgeter, yet
every screen is currently hardcoded English — this closes roadmap S-11 / PRD
FR-020. No language-switcher UI ships; Polish is the only language.

## Starting Point

There is no i18n layer today. Strings are hardcoded inline across two runtimes —
Astro SSR pages/components and React islands (which receive plain data props, no
shared context). Amounts format as `en-US` (`$1,234.56`), `<html lang="en">`, and
~15 e2e specs plus `format.test.ts` assert on the English copy and `$` formatting.

## Desired End State

Every reachable screen — nav, headings, forms, empty states, validation, API
errors, page titles, auth pages — renders in Polish. Amounts read `1 234,56 zł`,
count strings are grammatically correct across Polish plural forms, and all
translated copy lives only in `src/i18n/pl.ts`. Lint, build, unit, and e2e suites
pass against the Polish copy.

## Key Decisions Made

| Decision              | Choice                                             | Why (1 sentence)                                                             | Source |
| --------------------- | -------------------------------------------------- | --------------------------------------------------------------------------- | ------ |
| Layer design          | Static typed dict + `t()` helper (`src/i18n/`)     | Both runtimes import directly — no provider/props-threading; TS catches missing keys. | Plan   |
| String scope          | All four surfaces: chrome, validation/errors, titles/a11y, config banner | Deliver a fully Polish experience, not a half-translated one.               | Plan   |
| Number formatting     | Switch `format.ts` to `pl-PL`                      | A Polish UI showing `$1,234.56` looks broken; numbers should match the language. | Plan   |
| Pluralization         | `Intl.PluralRules("pl")` helper for count strings  | Correct one/few/many/other grammar with no library, scoped to the few count strings. | Plan   |
| Test strategy         | Update specs to Polish, referencing dict / roles   | Keeps tests meaningful and DRY; future copy edits change in one place.       | Plan   |

## Scope

**In scope:** message-key layer (`src/i18n/pl.ts` + `t()` + `plural()`); Polish
translation of all SSR + island copy, client validation, user-facing API errors,
page titles, config banner; `pl-PL` amount formatting; `<html lang="pl">`; unit +
e2e test realignment.

**Out of scope:** language switcher / second language; runtime locale negotiation;
any i18n library; currency conversion or currency-symbol change (relabel-only
stays); copy rewrites / UX redesign; translating code comments, logs, or
`context/**` docs.

## Architecture / Approach

A single Polish dictionary object with feature-namespaced keys
(`nav.dashboard`, `expense.form.amountLabel`, `errors.currencySaveFailed`) is
imported directly by both `.astro` frontmatter and `.tsx` islands. A typed `t()`
accessor makes a missing/renamed key a compile-time error (no silent English
fallback); `plural(count, variants)` selects Polish forms via
`Intl.PluralRules`. Formatting changes at the single point `src/lib/format.ts`.

## Phases at a Glance

| Phase                       | What it delivers                                              | Key risk                                                        |
| --------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------- |
| 1. Foundation               | `src/i18n/` dict + `t()` + `plural()`, `pl-PL` formatting, `lang=pl`, unit tests | `pl-PL` changes amount output (non-breaking-space grouping).   |
| 2. Astro (SSR) surfaces     | Nav, layout titles/meta, banner, all `.astro` pages in Polish | Stray inline literals missed; per-page title wiring.          |
| 3. React island surfaces    | All `.tsx` copy incl. client validation + plural counts       | Client-side validation strings are scattered inside components. |
| 4. Server & API messages    | User-facing error/validation strings routed through dict      | Separating user-facing copy from developer-only log text.     |
| 5. Test alignment           | Unit + e2e specs assert Polish; full suite green              | e2e copy-coupling; amount assertions vs `U+00A0` grouping.    |

**Prerequisites:** none — independent slice, parallel with the rest of the
iteration. **Estimated effort:** ~3–4 focused sessions across 5 phases (broad but
mechanical).

## Open Risks & Assumptions

- Switching to `pl-PL` uses a non-breaking space (`U+00A0`) as the thousands
  separator — exact-money string assertions must account for it.
- Roadmap S-11 detail says `Status: done` but the codebase is fully English —
  treated here as **not done**; correct the roadmap and archive on completion.
- Assumes no user-facing string is generated where the dictionary can't reach it
  (e.g. third-party widget copy) — none found in the current codebase.

## Success Criteria (Summary)

- No English UI copy remains on any reachable screen; `<html lang="pl">`.
- Amounts render `1 234,56 zł`; count strings grammatically correct at 1/3/5.
- Lint, build, unit, and e2e suites all pass against the Polish copy.
