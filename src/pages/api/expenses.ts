import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { listCategories } from "@/lib/services/categories";
import {
  createExpense,
  createExpenseSchema,
  CategoryOwnershipError,
  FutureDateError,
  InvalidAmountError,
  listExpenses,
} from "@/lib/services/expenses";
import { t } from "@/i18n";
import type { ExpenseResponse, ListExpensesResponse } from "@/types";

export const prerender = false;

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export const GET: APIRoute = async (context) => {
  if (!context.locals.user) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return json({ error: t("errors.supabaseNotConfigured") }, 500);
  }

  // Resolve the requested category against the user's own categories, mirroring
  // the SSR path in expenses.astro: an unrecognized/foreign id is treated as no
  // filter (full list), not as a filter yielding an empty list. RLS + the
  // user_id scope already make a foreign id safe; this keeps the API and SSR
  // behavior identical for an invalid param.
  const category = context.url.searchParams.get("category");
  let filter: { categoryId: string } | undefined;
  if (category) {
    const categories = await listCategories(supabase, context.locals.user.id);
    const owned = categories.find((c) => c.id === category);
    filter = owned ? { categoryId: owned.id } : undefined;
  }

  const expenses = await listExpenses(supabase, context.locals.user.id, filter);
  return json({ expenses } satisfies ListExpensesResponse, 200);
};

export const POST: APIRoute = async (context) => {
  if (!context.locals.user) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return json({ error: t("errors.supabaseNotConfigured") }, 500);
  }

  const body: unknown = await context.request.json().catch(() => null);
  const parsed = createExpenseSchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: "Invalid input", issues: parsed.error.issues }, 400);
  }

  try {
    const expense = await createExpense(supabase, context.locals.user.id, parsed.data);
    return json({ expense } satisfies ExpenseResponse, 201);
  } catch (err) {
    if (err instanceof FutureDateError || err instanceof InvalidAmountError) {
      return json({ error: err.message }, 422);
    }
    if (err instanceof CategoryOwnershipError) {
      return json({ error: err.message }, 409);
    }
    throw err;
  }
};
