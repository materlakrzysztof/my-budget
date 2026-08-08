/**
 * @10x/code-reviewer — entry point.
 *
 * A minimal, strongly-typed foundation for AI-powered code review built on the
 * Vercel AI SDK (`ai`) with the OpenRouter provider. It wires three pieces that
 * later features can build on:
 *
 *   1. A configured OpenRouter model factory (`createReviewModel`).
 *   2. Zod schemas describing a structured review result (see `./schemas.ts`).
 *   3. `reviewCode()`, which asks a model for a schema-validated review.
 *
 * Configuration is read from the environment (with per-call overrides):
 *   - OPENROUTER_API_KEY  (required) — your OpenRouter API key.
 *   - OPENROUTER_MODEL    (optional) — model id, defaults to DEFAULT_MODEL.
 */

import { generateText, Output } from "ai";
import type { LanguageModel } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { reviewResultSchema } from "./schemas.ts";
import type { ReviewResult } from "./schemas.ts";
import { REVIEW_INSTRUCTIONS, buildReviewPrompt } from "./prompts.ts";
import type { ReviewCodeInput } from "./prompts.ts";

// Re-export the extracted schema and prompt surfaces so the public API of the
// package is unchanged by the modular split.
export * from "./schemas.ts";
export * from "./prompts.ts";

/**
 * Default OpenRouter model. Overridable via the OPENROUTER_MODEL env var or the
 * `model` option. Browse current ids at https://openrouter.ai/models.
 */
export const DEFAULT_MODEL = "anthropic/claude-sonnet-5";

/** Options for constructing the reviewer's underlying model. */
export interface CodeReviewerConfig {
  /** OpenRouter API key. Falls back to `process.env.OPENROUTER_API_KEY`. */
  apiKey?: string;
  /** Model id (e.g. "anthropic/claude-sonnet-5"). Falls back to env / DEFAULT_MODEL. */
  model?: string;
  /** Override the OpenRouter API base URL (rarely needed). */
  baseURL?: string;
}

/**
 * Build a configured OpenRouter language model ready to pass to the AI SDK.
 * Throws if no API key can be resolved.
 */
export function createReviewModel(config: CodeReviewerConfig = {}): LanguageModel {
  const apiKey = config.apiKey ?? process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OpenRouter API key. Set OPENROUTER_API_KEY or pass { apiKey } to createReviewModel().");
  }

  const provider = createOpenRouter({
    apiKey,
    ...(config.baseURL ? { baseURL: config.baseURL } : {}),
  });

  return provider(config.model ?? process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL);
}

/**
 * Review a snippet of code and return a schema-validated structured result.
 *
 * @example
 * const result = await reviewCode({ code, filename: "sum.ts", language: "typescript" });
 * console.log(result.summary, result.findings);
 */
export async function reviewCode(input: ReviewCodeInput, config: CodeReviewerConfig = {}): Promise<ReviewResult> {
  const model = createReviewModel(config);

  const { output } = await generateText({
    model,
    system: REVIEW_INSTRUCTIONS,
    prompt: buildReviewPrompt(input),
    output: Output.object({ schema: reviewResultSchema }),
  });

  return output;
}

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
