/**
 * @10x/code-reviewer — public API barrel.
 *
 * A minimal, strongly-typed foundation for AI-powered code review built on the
 * Vercel AI SDK (`ai`) with the OpenRouter provider. This module is a pure,
 * side-effect-free re-export of the package's focused modules:
 *
 *   - `./schemas.ts` — zod schemas describing a structured review result.
 *   - `./prompts.ts` — system instructions and the review prompt builder.
 *   - `./model.ts`   — the OpenRouter model factory (`createReviewModel`).
 *   - `./agent.ts`   — the reusable `ToolLoopAgent` (`createReviewAgent`) and
 *                      the `reviewCode()` convenience wrapper.
 *
 * The runnable demo lives in `./cli.ts` (run via `npm run start`), kept out of
 * this barrel so importing the package has no side effects.
 *
 * Configuration is read from the environment (with per-call overrides):
 *   - OPENROUTER_API_KEY  (required) — your OpenRouter API key.
 *   - OPENROUTER_MODEL    (optional) — model id, defaults to DEFAULT_MODEL.
 */

export * from "./schemas.ts";
export * from "./prompts.ts";
export * from "./model.ts";
export * from "./agent.ts";
