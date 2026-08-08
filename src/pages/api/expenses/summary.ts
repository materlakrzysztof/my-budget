import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { getMonthlySummary } from "@/lib/services/expenses";
import { t } from "@/i18n";
import type { MonthlySummaryResponse } from "@/types";

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

  const summary = await getMonthlySummary(supabase, context.locals.user.id);
  return json({ summary } satisfies MonthlySummaryResponse, 200);
};
