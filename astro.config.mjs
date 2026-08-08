// @ts-check
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import console from "node:console";
import { defineConfig, envField } from "astro/config";

import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import cloudflare from "@astrojs/cloudflare";

/**
 * @astrojs/cloudflare's dev-mode secret loader always reads `.dev.vars`
 * (node_modules/@astrojs/cloudflare/dist/index.js, astro:config:setup hook)
 * and never respects CLOUDFLARE_ENV, unlike @cloudflare/vite-plugin's own
 * binding resolution. Without this, `astro:env/server` secrets (SUPABASE_URL,
 * SUPABASE_KEY) always come from `.dev.vars`, even when running `dev:e2e`
 * with CLOUDFLARE_ENV=e2e — silently pointing E2E runs at the wrong Supabase
 * project. This Vite plugin's `config()` hook runs after Astro integration
 * setup, so it can re-apply `.dev.vars.<CLOUDFLARE_ENV>` on top once that env
 * var is set, without ever touching the `.dev.vars` file on disk.
 */
function loadCloudflareEnvDevVars() {
  return {
    name: "load-cloudflare-env-dev-vars",
    config() {
      const cloudflareEnv = process.env.CLOUDFLARE_ENV;
      if (!cloudflareEnv) return;

      const envVarsPath = path.resolve(process.cwd(), `.dev.vars.${cloudflareEnv}`);
      if (!fs.existsSync(envVarsPath)) return;

      const parsed = parseDevVars(fs.readFileSync(envVarsPath, "utf-8"));
      Object.assign(process.env, parsed);
      console.log(`[load-cloudflare-env-dev-vars] Loaded secrets from .dev.vars.${cloudflareEnv}`);
    },
  };
}

/**
 * Minimal KEY=VALUE parser matching .dev.vars' simple, single-line format.
 * @param {string} contents
 * @returns {Record<string, string>}
 */
function parseDevVars(contents) {
  /** @type {Record<string, string>} */
  const result = {};
  for (const line of contents.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

// https://astro.build/config
export default defineConfig({
  output: "server",
  // Category management moved into Settings (FR-023); permanently redirect the
  // old standalone route so existing bookmarks and deep links keep working.
  redirects: {
    "/categories": "/settings",
  },
  integrations: [react(), sitemap()],
  vite: {
    plugins: [tailwindcss(), loadCloudflareEnvDevVars()],
  },
  adapter: cloudflare(),
  env: {
    schema: {
      SUPABASE_URL: envField.string({ context: "server", access: "secret", optional: true }),
      SUPABASE_KEY: envField.string({ context: "server", access: "secret", optional: true }),
    },
  },
});
