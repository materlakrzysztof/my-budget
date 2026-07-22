import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import {
  createExpense,
  createExpenseSchema,
  CategoryOwnershipError,
  FutureDateError,
  listExpenses,
} from "@/lib/services/expenses";
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
    return json({ error: "Supabase is not configured" }, 500);
  }

  const expenses = await listExpenses(supabase, context.locals.user.id);
  return json({ expenses } satisfies ListExpensesResponse, 200);
};

export const POST: APIRoute = async (context) => {
  if (!context.locals.user) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return json({ error: "Supabase is not configured" }, 500);
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
    if (err instanceof FutureDateError) {
      return json({ error: err.message }, 422);
    }
    if (err instanceof CategoryOwnershipError) {
      return json({ error: err.message }, 409);
    }
    throw err;
  }
};
