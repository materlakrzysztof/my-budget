---
project: MyBudget
assessed_at: 2026-07-23T00:00:00Z
agent_readiness: ready
context_type: brownfield
stack_components:
  language: TypeScript (strict)
  framework: Astro 6 (SSR) + React 19 islands
  build_tool: Vite (via Astro) + Tailwind 4
  test_runner: Vitest (unit) + Playwright (e2e)
  package_manager: npm
  ci_provider: GitHub Actions
  deployment_target: Cloudflare Workers
gates_passed: 4
gates_failed: 0
---

## Stack Components

**Language — TypeScript, strict mode.** `tsconfig.json` extends `astro/tsconfigs/strict` and adds a `@/*` path alias to `./src/*`. Type checking runs via `@astrojs/check` and the Astro/TS toolchain; no `any`-permissive config detected.

**Framework — Astro 6 (SSR) with React 19 islands.** `astro.config.mjs` sets `output: "server"`, so every page is server-rendered by default via `@astrojs/cloudflare`. React is used selectively for interactive islands, following Astro's own architectural pattern rather than a full SPA. Auth and Supabase env wiring go through `astro:env/server`, keeping secrets server-only.

**Build tool — Vite (bundled with Astro) + Tailwind 4.** No custom Vite config beyond what Astro and `@tailwindcss/vite` provide. shadcn/ui components ("new-york" variant) live in `src/components/ui/`.

**Test runner — Vitest (unit) + Playwright (e2e).** Both configured with dedicated config files (`vitest.config.*`, `playwright.config.ts`) and dedicated npm scripts (`test:unit`, `test:e2e`, plus a `dev:e2e` variant that runs Astro under a separate Cloudflare env).

**Supporting infra:** Supabase for auth/Postgres (SSR client via `@supabase/ssr`, migrations under `supabase/migrations/` following the `YYYYMMDDHHmmss_description.sql` convention, 2 migrations present). CI via GitHub Actions (`.github/workflows/ci.yml`, lint + build on push/PR). Deployment via Cloudflare Workers (`wrangler.jsonc`, `wrangler deploy`). ESLint (type-checked rules) + Prettier (with Astro and Tailwind plugins) enforced pre-commit via husky + lint-staged. Both `CLAUDE.md` and `AGENTS.md` exist as instruction files (near-duplicate content, `AGENTS.md` slightly more generic).

## Quality Gate Assessment

| Component  | Typed | Convention | Training Data | Documented | Verdict |
| ---------- | ----- | ---------- | -------------- | ---------- | ------- |
| Language   | ✓     | —          | —              | —          | pass    |
| Framework  | —     | ✓          | ✓              | ✓          | pass    |
| Build tool | —     | ✓          | ✓              | ✓          | pass    |
| Test runner| —     | ✓          | ✓              | ✓          | pass    |

Legend: ✓ = pass, ✗ = fail, ~ = partial, — = not applicable

### Gate Details

**Typed — pass.** `tsconfig.json` extends `astro/tsconfigs/strict`; the whole app (Astro pages, API routes, React islands) is TypeScript with strict compiler options. API routes validate input with zod (per CLAUDE.md convention), giving typed contracts at the boundary too.

**Convention-based — pass.** Astro ships file-based routing and a strong island-architecture opinion (an explicit "passes" example in the quality-gate reference). The project layers additional conventions on top: `src/lib/` for services/helpers, `src/components/hooks/` for extracted React hooks, `src/types.ts` for shared DTOs, `src/middleware.ts` for the single auth-resolution point. These are documented in CLAUDE.md, not just implicit.

**Popular in training data — pass, within the JS/meta-framework family.** Astro, React, Vite, Vitest, Playwright, and Supabase are all mainstream, high-training-data-representation choices within the JS/TS ecosystem — none is a niche or recently-forked variant.

**Well-documented — pass.** Astro, React, Vite, Tailwind, Vitest, Playwright, and Supabase all ship current, versioned, official docs. Cloudflare's Workers/`@astrojs/cloudflare` integration docs are actively maintained, though (see note below) the Workers runtime itself has narrower Node-API coverage than a typical Node.js host — a runtime-compatibility nuance, not a documentation gap.

## Gaps & Compensation

No quality gate failed for any detected component — there is nothing here that needs a compensation strategy in the sense the framework defines (typed/convention/training-data/documented gaps patched via instruction-file rules).

Two non-gate observations worth carrying forward, since they're the kind of friction that shows up in agent-assisted work even on an otherwise clean stack:

1. **Cloudflare Workers runtime (workerd) has a narrower Node.js compatibility surface than a typical Node host.** An agent generating server-side code from general Node/Astro training data may reach for APIs (certain `node:` built-ins, some npm packages with native bindings) that don't run under workerd. This isn't a gate failure — it's a deployment-target nuance.
2. **`CLAUDE.md` and `AGENTS.md` are separately maintained near-duplicates.** They already differ in their opening line, which means they can silently drift as one is updated and the other isn't.

### Recommended Instruction File Additions

Not required for gate compliance, but worth adding to close the two observations above:

```markdown
## Cloudflare Workers runtime constraints

This app runs on Cloudflare Workers (`workerd`), not Node.js. Before adding a
dependency or using a Node built-in, confirm it's supported in the Workers
runtime (check `nodejs_compat` coverage) — some `node:` APIs and native-binding
packages are unavailable even though they work in local `npm run dev` under
Node tooling.
```

```markdown
## Keeping CLAUDE.md and AGENTS.md in sync

CLAUDE.md and AGENTS.md are maintained as separate files and can drift. When
editing repository guidance, update both, or note in the PR description that
one intentionally diverges and why.
```

## Summary

**Overall verdict: ready.** Every detected component — TypeScript, Astro 6 SSR, React 19 islands, Vite, Tailwind 4, Vitest, and Playwright — clears all four agent-friendliness criteria with no compensation required. This is a strongly agent-friendly stack: strict typing end-to-end, an opinionated file-based framework, mainstream/well-represented choices in training data, and current versioned docs across the board. The two notes above (Workers runtime compatibility, CLAUDE.md/AGENTS.md drift) are low-severity process hygiene items, not stack risks.

**Recommended next step:** `/10x-health-check` — with a stack this clean, the health check can focus on dependency/security posture and CI/config completeness rather than agent-readiness gaps.
