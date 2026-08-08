/**
 * @10x/code-reviewer — model factory.
 *
 * Isolates OpenRouter provider/model construction so the agent (and any future
 * eval config) can build a language model without depending on agent logic.
 *
 * Configuration is read from the environment (with per-call overrides):
 *   - OPENROUTER_API_KEY  (required) — your OpenRouter API key.
 *   - OPENROUTER_MODEL    (optional) — model id, defaults to DEFAULT_MODEL.
 */

import type { LanguageModel } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import process from "node:process";

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
