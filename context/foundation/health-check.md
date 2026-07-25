---
project: my-budget
checked_at: 2026-07-23T00:00:00Z
health_status: critical-issues
context_type: brownfield
language_family: js
stack_assessment_available: true
checks_run:
  - lockfile
  - dependency_audit
  - outdated_deps
  - test_runner
  - ci_cd
  - configuration
audit_findings:
  critical: 1
  high: 11
  moderate: 7
  low: 2
test_runner_detected: true
ci_provider: GitHub Actions
recommended_fixes: 6
---

## Dependency Health

### Lockfile

```
Status: present (package-lock.json)
Package manager: npm
```

### Security Audit

```
Tool: npm audit --json
Summary: 1 CRITICAL, 11 HIGH, 7 MODERATE, 2 LOW (21 total, 993 resolved deps)
Direct vs transitive: 2 direct (astro: high, wrangler: moderate); 19 transitive
```

#### CRITICAL findings

- **tar** (transitive, via `wrangler` → `miniflare`) — range `<=7.5.18`: multiple advisories (file smuggling via PAX header confusion, process crash via PAX numeric path type confusion, decompression DoS, infinite loop on negative entry size, uncaught-exception DoS via NUL byte). Fix available via `npm audit fix`. This is pulled in by the local Cloudflare Workers dev/emulation tooling (`wrangler`/`miniflare`), not a runtime dependency of the deployed app — lower real-world exposure than a direct prod dependency, but still worth patching since it affects local dev.

#### HIGH findings

- **astro** (direct) — range `<=7.0.9`: reflected XSS via unescaped slot name ([GHSA-8hv8-536x-4wqp](https://github.com/advisories/GHSA-8hv8-536x-4wqp)), Host header SSRF in prerendered error page fetch ([GHSA-2pvr-wf23-7pc7](https://github.com/advisories/GHSA-2pvr-wf23-7pc7)), plus several moderate/low XSS variants (spread props, view transitions, hydrated islands). **This is the one to prioritize** — it's a direct dependency and the core SSR framework actually serving requests in production. `npm outdated` shows `wanted: 6.4.8`, `latest: 7.1.3`; the vulnerable range extends through `7.0.9`, so a same-major bump to 6.4.8 will not fully clear it — closing it requires moving to Astro 7.1.3+ (a major version bump; review the [Astro 7 migration notes](https://docs.astro.build) before upgrading).
- **ws** — range `8.0.0 - 8.20.1`: uninitialized memory disclosure, memory-exhaustion DoS via tiny fragments. Transitive via `@cloudflare/vite-plugin` / `miniflare` (dev tooling) and a duplicate copy under `@supabase/realtime-js` (this one *is* runtime-relevant since Supabase realtime ships in the app bundle).
- **undici** — range `7.0.0 - 7.27.2`: TLS validation bypass via SOCKS5 proxy agent, HTTP header injection via Set-Cookie percent-decoding, WebSocket DoS, cross-origin request routing issue, cookie SameSite downgrade, cache poisoning. Transitive (Node fetch internals pulled in by tooling).
- **vite** — range `7.0.0 - 7.3.3`: NTLMv2 hash disclosure via UNC path handling on Windows, `server.fs.deny` bypass on Windows alternate paths. Both are dev-server-only issues (matter most for local dev on Windows, which is this project's primary dev OS).
- **miniflare**, **brace-expansion**, **devalue**, **fast-uri**, **js-yaml**, **sharp**, **svgo** — all transitive, pulled in by the Astro/Cloudflare/Wrangler toolchain. All have `fixAvailable: true`.

MODERATE (7) and LOW (2) findings — mostly transitive (`@astrojs/language-server`, `@cloudflare/vite-plugin`, `wrangler` itself as a direct moderate finding via `esbuild`/`miniflare`, `yaml`, `yaml-language-server`, `volar-service-yaml`, `@babel/core`) — all have fixes available, none block agent work directly.

### Outdated Dependencies

```
Packages with major version gaps (2+): 1
```

- **typescript**: `5.9.3` → `7.0.2` (2 major versions behind — crosses both 6.x and 7.x)

Several other direct dependencies are 1 major version behind and worth tracking alongside the security fix above, since upgrading astro will likely need to happen in the same pass:

- **astro**: `6.3.1` → `7.1.3` (also the package with the HIGH security findings above)
- **@astrojs/react**: `5.0.4` → `6.0.1`
- **@astrojs/cloudflare**: `13.5.0` → `14.1.4`
- **eslint**: `9.39.4` → `10.7.0`
- **lint-staged**: `16.4.0` → `17.2.0`

## Test Suite

```
Test runner: Vitest (unit) + Playwright (e2e)
Tests found: 17 unit tests (6 suites) + 11 e2e tests (11 files)
Test execution: passing (unit suite run to completion: 17/17 passed; e2e suite enumerated successfully via --list)
```

```
Configuration: vitest.config.ts (implied by `npm run test:unit`), playwright.config.ts
Framework: Vitest 4.1.10, @playwright/test 1.61.1
```

Both suites are healthy and runnable locally. This is a strong foundation for agent-assisted work — the agent has a working way to verify its own changes.

## CI/CD

```
Provider: GitHub Actions
Configuration: .github/workflows/ci.yml
```

| Stage      | Status | Notes                                                                 |
| ---------- | ------ | ---------------------------------------------------------------------- |
| Lint       | ✓      | `npm run lint` (ESLint, type-checked rules)                             |
| Test       | ✗      | Neither `test:unit` nor `test:e2e` is invoked — CI never runs the test suites |
| Build      | ✓      | `npm run build` (astro build)                                          |
| Type check | ~      | No dedicated `astro check`/`tsc --noEmit` step, but ESLint's `strictTypeChecked` + `projectService: true` performs type-aware linting as a side effect of the lint step, catching many (not all) type errors |
| Security   | ✗      | No `npm audit`, no Dependabot config (`.github/dependabot.yml` absent), no CodeQL |

The missing test step is the most significant CI gap: 28 passing tests exist locally but nothing stops a regression from merging, since CI only lints and builds.

## Configuration

```
All expected high/medium-severity configuration is present. One low-severity gap detected.
```

### Low severity

- **`.editorconfig`** — not present. Cross-editor formatting consistency currently relies solely on Prettier being run manually/pre-commit. Fix: add a `.editorconfig` matching the existing Prettier settings (2-space indent, LF line endings, UTF-8, trailing newline).

Everything else checked out: `.prettierrc.json` and `eslint.config.js` present and active via husky + lint-staged pre-commit hooks; `tsconfig.json` extends `astro/tsconfigs/strict` (strict mode on); `.gitignore` present; `.env.example` present.

## Stack Assessment Cross-Reference

```
Stack assessment: context/foundation/stack-assessment.md
Agent readiness (from stack-assess): ready
```

The stack assessment found no quality-gate failures (typed/convention/training-data/documented all pass), so there are no gate gaps for this report to reinforce or mitigate. The two non-gate observations it raised are worth noting alongside this report's findings:

| Stack-Assess Observation | Health-Check Finding | Status |
| --- | --- | --- |
| CLAUDE.md/AGENTS.md can drift (separately maintained) | Both files present and confirmed to differ from line 1 onward | Reinforced — the drift has already started |
| Cloudflare Workers runtime has a narrower Node-API surface | CI has no step that exercises the deployed Workers runtime (build only compiles; `wrangler dev`/deploy isn't part of CI) | Reinforced — a Workers-incompatible API could pass CI and only surface at deploy/runtime |

## Recommended Fixes

### Fix before agent work (Category A)

### 1. Patch the direct-dependency security findings

**Impact**: `astro` (direct dependency, HIGH: reflected XSS, Host-header SSRF) is the SSR framework actually serving every request in production. An agent working on this codebase without knowing this exists could ship features on top of a framework version with known exploitable XSS/SSRF paths.
**Severity**: critical
**Effort**: moderate (dependency bump + re-run full test suite) to significant (if the Astro 7 major migration surfaces breaking changes)
**Fix**:

```bash
npm audit fix          # clears the transitive findings with non-breaking fixes
npm install astro@latest  # 6.3.1 -> 7.1.3, closes the astro-specific XSS/SSRF findings; review Astro 7 release notes for breaking changes first
npm run test:unit && npm run test:e2e && npm run build
```

### 2. Add the test suites to CI

**Impact**: 28 tests exist and pass locally, but CI currently only lints and builds — a regression can merge to `master` without any test running. The agent cannot rely on CI as a safety net; every verification currently depends on someone remembering to run tests locally.
**Severity**: high
**Effort**: quick (unit) / moderate (e2e — needs Playwright browser install + Supabase/e2e env in CI)
**Fix**: add to `.github/workflows/ci.yml` after the lint step:

```yaml
- run: npm run test:unit
```

For e2e, a follow-up step (needs `npx playwright install --with-deps` and the `CLOUDFLARE_ENV=e2e` dev server per `dev:e2e`) is more involved — track separately if CI runtime budget is a concern.

### 3. Add a CI security-scanning step

**Impact**: Given the current 1 CRITICAL + 11 HIGH findings, nothing today would alert the team if a future dependency bump introduces a new vulnerability, or regresses one already patched.
**Severity**: medium
**Effort**: quick
**Fix**: enable Dependabot for npm (`.github/dependabot.yml`) and/or add a non-blocking audit step to CI:

```yaml
- run: npm audit --audit-level=high
  continue-on-error: true
```

### 4. Add an explicit type-check step to CI

**Impact**: ESLint's typed-linting catches many type errors as a side effect, but it isn't a substitute for `astro check`, which also validates `.astro` template type usage (props, slots) that ESLint's TS-only linting doesn't cover.
**Severity**: medium
**Effort**: quick
**Fix**: add a `check` script and CI step:

```json
"check": "astro check"
```

```yaml
- run: npm run check
```

### 5. Plan the TypeScript major-version upgrade separately

**Impact**: TypeScript is 2 major versions behind (5.9.3 → 7.0.2). This is the largest version gap in the dependency tree and is likely to introduce breaking type-checking changes; bundling it with the security-driven Astro upgrade (fix #1) would make it hard to isolate which change broke what.
**Severity**: low
**Effort**: significant (>1 hour — review TypeScript 6 and 7 breaking changes, expect new strict-mode errors to surface)
**Fix**: schedule as its own pass, after the Astro security upgrade lands and is verified independently.

### 6. Add `.editorconfig`

**Impact**: minor — cross-editor formatting consistency currently depends entirely on Prettier running via the pre-commit hook; an editor without Prettier-on-save could drift before commit.
**Severity**: low
**Effort**: quick (< 5 min)
**Fix**: add a `.editorconfig` at the repo root matching the existing Prettier config (2-space indent, LF, UTF-8, final newline).

### Addressed in upcoming lessons (Category B)

None outstanding — CI/CD, agent instruction files (`CLAUDE.md`/`AGENTS.md`), and deployment configuration (`wrangler.jsonc`) are already in place. This project is further along than a typical health-check candidate at this stage of the course chain; the remaining Category B pattern (build these later) doesn't apply here.

## Summary

Health status: critical-issues

The project's foundations are strong — TypeScript strict mode, a working Vitest + Playwright test suite (28 passing tests), lint/format enforced pre-commit, and a working CI build. The `critical-issues` verdict is driven by the dependency audit: 1 CRITICAL finding (transitive, dev-tooling-only — lower real exposure) and 11 HIGH findings, the most important of which is a direct, in-production dependency (`astro`, XSS/SSRF, needs a major-version bump to fully close). Compounding that, CI currently runs lint and build but never the test suite, so regressions in either the app or a future dependency bump have no automated safety net today.

Next step: address fix #1 (astro security upgrade) and fix #2 (wire the test suites into CI) first — those two close the gap between "tests exist" and "tests actually protect the branch." The remaining fixes are lower urgency and can follow. Once addressed, proceed to agent onboarding — both greenfield and brownfield paths converge with equivalent context artifacts from here.
