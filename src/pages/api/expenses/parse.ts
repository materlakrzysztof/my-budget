import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { listCategories } from "@/lib/services/categories";
import { createExpenseParserModel } from "@/lib/ai/model";
import { AiParseError, parseExpensesFromText, parseExpensesRequestSchema } from "@/lib/services/expense-ai-parser";
import { t } from "@/i18n";
import type { ParseExpensesResponse } from "@/types";

export const prerender = false;

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export const POST: APIRoute = async (context) => {
  if (!context.locals.user) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return json({ error: t("errors.supabaseNotConfigured") }, 500);
  }

  const body: unknown = await context.request.json().catch(() => null);
  const parsed = parseExpensesRequestSchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: "Invalid input", issues: parsed.error.issues }, 400);
  }

  const categories = await listCategories(supabase, context.locals.user.id);

  try {
    const model = createExpenseParserModel();
    const items = await parseExpensesFromText(model, parsed.data.text, categories);
    return json({ items } satisfies ParseExpensesResponse, 200);
  } catch (err) {
    if (err instanceof AiParseError) {
      return json({ error: err.message }, 502);
    }
    throw err;
  }
};
