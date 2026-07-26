import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import {
  CategoryInUseError,
  CategoryNotFoundError,
  DuplicateCategoryError,
  deleteCategory,
  updateCategory,
  updateCategorySchema,
} from "@/lib/services/categories";
import type { CreateCategoryResponse } from "@/types";

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
    return json({ error: "Supabase is not configured" }, 500);
  }

  const body: unknown = await context.request.json().catch(() => null);
  const parsed = updateCategorySchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: "Invalid input", issues: parsed.error.issues }, 400);
  }

  try {
    const category = await updateCategory(supabase, context.locals.user.id, context.params.id ?? "", parsed.data);
    return json({ category } satisfies CreateCategoryResponse, 200);
  } catch (err) {
    if (err instanceof CategoryNotFoundError) {
      return json({ error: err.message }, 404);
    }
    if (err instanceof DuplicateCategoryError) {
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
    return json({ error: "Supabase is not configured" }, 500);
  }

  try {
    await deleteCategory(supabase, context.locals.user.id, context.params.id ?? "");
    return new Response(null, { status: 204 });
  } catch (err) {
    if (err instanceof CategoryNotFoundError) {
      return json({ error: err.message }, 404);
    }
    if (err instanceof CategoryInUseError) {
      return json({ error: err.message }, 409);
    }
    throw err;
  }
};
