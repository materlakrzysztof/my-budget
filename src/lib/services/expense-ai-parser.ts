import { generateText, Output, type LanguageModel } from "ai";
import { z } from "zod";
import { t } from "@/i18n";
import type { ParsedExpenseDraft } from "@/types";

const MAX_DRAFTS = 20;

export const parseExpensesRequestSchema = z.object({
  text: z.string().trim().min(1).max(500),
});

export class AiParseError extends Error {
  constructor(cause?: unknown) {
    super(t("errors.aiParseFailed"), cause ? { cause } : undefined);
    this.name = "AiParseError";
  }
}

function buildDraftSchema(categoryIds: string[]) {
  return z.object({
    description: z.string().max(100),
    amount: z.number().positive(),
    categoryId: categoryIds.length > 0 ? z.enum(categoryIds as [string, ...string[]]).nullable() : z.null(),
  });
}

function buildPrompt(text: string, categories: { id: string; name: string }[]): string {
  const categoryList =
    categories.length > 0
      ? categories.map((c) => `- ${c.id}: ${c.name}`).join("\n")
      : "(the user has no categories yet — leave categoryId null for every item)";

  return [
    "Extract individual purchases from the user's free-text expense note.",
    `Return at most ${MAX_DRAFTS} items.`,
    "For each item, provide a short description and a positive amount.",
    "For categoryId, only use an id from this list of the user's existing categories, matched by meaning to the item. If none confidently matches, set categoryId to null — never invent an id or guess when unsure.",
    categoryList,
    "",
    `User's text: ${text}`,
  ].join("\n");
}

/**
 * Parse free-text expense notes into draft expenses using the given model.
 * `text` is assumed already validated (trimmed, 1–500 chars) by the caller.
 */
export async function parseExpensesFromText(
  model: LanguageModel,
  text: string,
  categories: { id: string; name: string }[],
): Promise<ParsedExpenseDraft[]> {
  const categoryIds = categories.map((c) => c.id);
  const draftSchema = buildDraftSchema(categoryIds);
  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));

  try {
    const { output } = await generateText({
      model,
      output: Output.array({ element: draftSchema }),
      prompt: buildPrompt(text, categories),
    });

    const items = z.array(draftSchema).max(MAX_DRAFTS).parse(output);

    return items.map((item) => ({
      description: item.description,
      amount: item.amount.toFixed(2),
      categoryId: item.categoryId,
      categoryName: item.categoryId ? (categoryNameById.get(item.categoryId) ?? null) : null,
    }));
  } catch (err) {
    // Covers AI_NoObjectGeneratedError/AI_NoOutputGeneratedError (malformed or
    // missing model output), Zod validation failures against draftSchema, and
    // provider/network errors alike — all surface identically to the caller as
    // an opaque parse failure, never leaking model/provider internals.
    throw new AiParseError(err);
  }
}
