---
starter_id: 10x-astro-starter
package_manager: npm
project_name: my-budget
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: false
---

## Why this stack

A solo developer shipping MyBudget's MVP in 3 weeks after-hours needs login and persistent per-user data (categories, expenses) with minimal manual setup. 10x-astro-starter is the recommended default for `(web, js)` and bundles Astro + React + TypeScript with Supabase (Postgres + auth + storage) and Cloudflare deployment already wired via the `@astrojs/cloudflare` adapter, so auth and data storage come out of the box rather than being assembled by hand. It clears all four agent-friendly gates (typed, convention-based, popular in training, well-documented) and carries first-class bootstrapper confidence. AI-based auto-categorization and realtime features are out of scope for v1 per the PRD's Non-Goals, so those flags are false; payments and background jobs are not part of this product. Deployment stays on Cloudflare Pages, the starter's native default, to avoid the extra adapter-swap work that a Vercel deploy would require. CI runs on GitHub Actions with auto-deploy-on-merge, the standard shape for a solo project.
