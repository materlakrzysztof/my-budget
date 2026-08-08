import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import {
  CategoryOwnershipError,
  deleteExpense,
  ExpenseNotFoundError,
  FutureDateError,
  InvalidAmountError,
  updateExpense,
  updateExpenseSchema,
} from "@/lib/services/expenses";
import { t } from "@/i18n";
import type { ExpenseResponse } from "@/types";

export const prerender = false;

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export const PATCH: APIRoute = async (context) => {
  if (!context.locals.user) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return json({ error: t("errors.supabaseNotConfigured") }, 500);
  }

  const body: unknown = await context.request.json().catch(() => null);
  const parsed = updateExpenseSchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: "Invalid input", issues: parsed.error.issues }, 400);
  }

  try {
    const expense = await updateExpense(supabase, context.locals.user.id, context.params.id ?? "", parsed.data);
    return json({ expense } satisfies ExpenseResponse, 200);
  } catch (err) {
    if (err instanceof ExpenseNotFoundError) {
      return json({ error: err.message }, 404);
    }
    if (err instanceof FutureDateError || err instanceof InvalidAmountError) {
      return json({ error: err.message }, 422);
    }
    if (err instanceof CategoryOwnershipError) {
      return json({ error: err.message }, 409);
    }
    throw err;
  }
};

export const DELETE: APIRoute = async (context) => {
  if (!context.locals.user) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return json({ error: t("errors.supabaseNotConfigured") }, 500);
  }

  try {
    await deleteExpense(supabase, context.locals.user.id, context.params.id ?? "");
    return new Response(null, { status: 204 });
  } catch (err) {
    if (err instanceof ExpenseNotFoundError) {
      return json({ error: err.message }, 404);
    }
    throw err;
  }
};
