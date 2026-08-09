import type { LanguageModel } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { OPENROUTER_API_KEY } from "astro:env/server";

/** Default OpenRouter model for expense parsing — fast/cheap relative to the code-reviewer's Sonnet-class default. */
export const DEFAULT_MODEL = "anthropic/claude-haiku-4.5";

export interface ExpenseParserModelConfig {
  /** OpenRouter API key. Falls back to the astro:env/server OPENROUTER_API_KEY secret. */
  apiKey?: string;
  /** Model id (e.g. "anthropic/claude-haiku-4.5"). Falls back to DEFAULT_MODEL. */
  model?: string;
}

/**
 * Build a configured OpenRouter language model for expense parsing.
 * Throws if no API key can be resolved. Reads from `astro:env/server` rather
 * than `process.env` since Cloudflare Workers has no Node `process.env`.
 */
export function createExpenseParserModel(config: ExpenseParserModelConfig = {}): LanguageModel {
  const apiKey = config.apiKey ?? OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing OpenRouter API key. Set OPENROUTER_API_KEY or pass { apiKey } to createExpenseParserModel().",
    );
  }

  const provider = createOpenRouter({ apiKey });

  return provider(config.model ?? DEFAULT_MODEL);
}
