import fs from "node:fs";
import path from "node:path";

const DEV_VARS_FILENAME = ".dev.vars.e2e";
const REQUIRED_KEYS = ["SUPABASE_URL", "SUPABASE_KEY"] as const;

/**
 * Intentionally duplicated from astro.config.mjs's parseDevVars, not
 * imported — pulling an Astro config module into a Vitest setup file would
 * drag in Astro/Vite integration-setup side effects unrelated to loading
 * two env vars.
 */
function parseDevVars(contents: string): Record<string, string> {
  const result: Record<string, string> = {};
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

const devVarsPath = path.resolve(process.cwd(), DEV_VARS_FILENAME);

if (!fs.existsSync(devVarsPath)) {
  throw new Error(
    `[tests/integration/env] ${DEV_VARS_FILENAME} not found at repo root. ` +
      "The integration suite requires a real Supabase project's anon credentials " +
      `(${REQUIRED_KEYS.join(", ")}) to run.`,
  );
}

const parsed = parseDevVars(fs.readFileSync(devVarsPath, "utf-8"));

const missingKeys = REQUIRED_KEYS.filter((key) => !parsed[key]);
if (missingKeys.length > 0) {
  throw new Error(
    `[tests/integration/env] ${DEV_VARS_FILENAME} is missing required key(s): ${missingKeys.join(", ")}.`,
  );
}

for (const key of REQUIRED_KEYS) {
  process.env[key] = parsed[key];
}
