/**
 * @10x/code-reviewer — CLI demo.
 *
 * A runnable sample review, kept out of the package's import path so the
 * `index.ts` barrel stays side-effect-free (safe to import from evals/tests).
 * Run with `npm run start` (or `node src/cli.ts`) with OPENROUTER_API_KEY set.
 */

import { fileURLToPath } from "node:url";
import process from "node:process";

import { reviewCode } from "./agent.ts";

/** Review a small buggy sample and print the structured result as JSON. */
async function main(): Promise<void> {
  if (!process.env.OPENROUTER_API_KEY) {
    console.error(
      "OPENROUTER_API_KEY is not set.\n" +
        "Set it and re-run, e.g.:\n" +
        "  OPENROUTER_API_KEY=sk-or-... node src/cli.ts",
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
