# Repository Guidelines

MyBudget is an Astro 6 SSR web app (React 19 islands, Tailwind 4, Supabase auth/Postgres, Cloudflare Workers) for tracking and categorizing household expenses. Product scope lives in `@context/foundation/prd.md`; stack rationale in `@context/foundation/tech-stack.md`.

## Hard rules

- Never use Next.js directives (`"use client"`, etc.) — this is Astro + React islands, not Next.js.
- Every new Supabase table needs Row Level Security enabled with granular per-operation, per-role policies (see `supabase/migrations/`).
- Never write into `context/archive/` — it holds immutable records of completed workflow changes.

## Project Structure & Module Organization

- `src/pages/` — Astro routes; `src/pages/api/` — API endpoints (uppercase `GET`/`POST` exports, zod-validated).
- `src/components/` — Astro components for static layout; React (`.tsx`) only where interactivity is needed. `src/components/ui/` holds shadcn/ui ("new-york" variant); install additions with `npx shadcn@latest add [name]`.
- `src/lib/` — helpers/services (e.g. `@src/lib/supabase.ts` SSR client); `@src/middleware.ts` resolves the current user and gates paths listed in `PROTECTED_ROUTES`.
- `src/types.ts` — shared entity/DTO types. `supabase/migrations/` — SQL files named `YYYYMMDDHHmmss_description.sql`.
- Path alias `@/*` → `./src/*` (see `@tsconfig.json`).

## Build, Test, and Development Commands

- `npm run dev` — dev server (Cloudflare workerd runtime).
- `npm run build` / `npm run preview` — production build / preview.
- `npm run lint` / `npm run lint:fix` — ESLint with type-checked rules.
- `npm run format` — Prettier (astro + tailwind plugins).
- No test script exists yet — the CI gate is lint + build only.

## Coding Style & Naming Conventions

- TypeScript strict mode (`@tsconfig.json` extends `astro/tsconfigs/strict`).
- Merge Tailwind classes with `cn()` from `@/lib/utils`; do not concatenate class strings manually.
- Extract React hooks to `src/components/hooks/`.
- Husky + lint-staged run `eslint --fix` on `*.{ts,tsx,astro}` and `prettier --write` on `*.{json,css,md}` pre-commit.

## Testing Guidelines

No test framework is configured yet. If you add one, wire it into `@.github/workflows/ci.yml` alongside the existing lint/build steps.

## Commit & Pull Request Guidelines

Only one commit exists in history ("first commit") — no message convention established yet. PRs target `master`; CI requires `npm run lint` and `npm run build` to pass, with `SUPABASE_URL`/`SUPABASE_KEY` as repository secrets.

## Security & Configuration Tips

`SUPABASE_URL` / `SUPABASE_KEY` are server-only secrets declared via Astro's `astro:env` schema and never exposed to the client. Local values live in `.env` (Node) and `.dev.vars` (Cloudflare, gitignored) — never commit either.
