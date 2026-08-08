import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import {
  createCategory,
  createCategorySchema,
  DuplicateCategoryError,
  listCategories,
} from "@/lib/services/categories";
import { t } from "@/i18n";
import type { CreateCategoryResponse, ListCategoriesResponse } from "@/types";

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

  const categories = await listCategories(supabase, context.locals.user.id);
  return json({ categories } satisfies ListCategoriesResponse, 200);
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
  const parsed = createCategorySchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: "Invalid input", issues: parsed.error.issues }, 400);
  }

  try {
    const category = await createCategory(supabase, context.locals.user.id, parsed.data);
    return json({ category } satisfies CreateCategoryResponse, 201);
  } catch (err) {
    if (err instanceof DuplicateCategoryError) {
      return json({ error: err.message }, 409);
    }
    throw err;
  }
};
