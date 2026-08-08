import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { getOrCreateUserSettings, updateSettingsSchema, updateUserSettings } from "@/lib/services/settings";
import { t } from "@/i18n";
import type { SettingsResponse } from "@/types";

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

  const settings = await getOrCreateUserSettings(supabase, context.locals.user.id);
  return json({ settings } satisfies SettingsResponse, 200);
};

export const PUT: APIRoute = async (context) => {
  if (!context.locals.user) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return json({ error: t("errors.supabaseNotConfigured") }, 500);
  }

  const body: unknown = await context.request.json().catch(() => null);
  const parsed = updateSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: "Invalid input", issues: parsed.error.issues }, 400);
  }

  const settings = await updateUserSettings(supabase, context.locals.user.id, parsed.data);
  return json({ settings } satisfies SettingsResponse, 200);
};
