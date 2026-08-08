/**
 * @10x/code-reviewer — entry point.
 *
 * A minimal, strongly-typed foundation for AI-powered code review built on the
 * Vercel AI SDK (`ai`) with the OpenRouter provider. The package is split into
 * focused modules that this barrel re-exports:
 *
 *   - `./schemas.ts` — zod schemas describing a structured review result.
 *   - `./prompts.ts` — system instructions and the review prompt builder.
 *   - `./model.ts`   — the OpenRouter model factory (`createReviewModel`).
 *   - `./agent.ts`   — the reusable `ToolLoopAgent` (`createReviewAgent`) and
 *                      the `reviewCode()` convenience wrapper.
 *
 * Configuration is read from the environment (with per-call overrides):
 *   - OPENROUTER_API_KEY  (required) — your OpenRouter API key.
 *   - OPENROUTER_MODEL    (optional) — model id, defaults to DEFAULT_MODEL.
 */

import { fileURLToPath } from "node:url";
import process from "node:process";

import { reviewCode } from "./agent.ts";

// Aggregate the package's public surface.
export * from "./schemas.ts";
export * from "./prompts.ts";
export * from "./model.ts";
export * from "./agent.ts";

/** Small demo used when this file is executed directly (`node src/index.ts`). */
async function main(): Promise<void> {
  if (!process.env.OPENROUTER_API_KEY) {
    console.error(
      "OPENROUTER_API_KEY is not set.\n" +
        "Set it and re-run, e.g.:\n" +
        "  OPENROUTER_API_KEY=sk-or-... node src/index.ts",
    );
    process.exitCode = 1;
    return;
  }

  const sample = [
    "export function sum(numbers) {",
    "  let total;",
    "  for (let i = 0; i <= numbers.length; i++) {",
    "    total += numbers[i];",
    "  }",
    "  return total;",
    "}",
  ].join("\n");

  const result = await reviewCode({
    code: sample,
    filename: "sum.js",
    language: "javascript",
  });

  console.log(JSON.stringify(result, null, 2));
}

// Run the demo only when invoked directly, not when imported as a module.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  void main();
}
