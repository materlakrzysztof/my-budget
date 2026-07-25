import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { CURRENCIES, type UpdateSettingsRequest, type UserSettings } from "@/types";

const UNIQUE_VIOLATION = "23505";

export const updateSettingsSchema = z.object({
  currency: z.enum(CURRENCIES),
});

interface UserSettingsRow {
  currency: UserSettings["currency"];
}

function toUserSettings(row: UserSettingsRow): UserSettings {
  return { currency: row.currency };
}

async function selectUserSettings(supabase: SupabaseClient, userId: string): Promise<UserSettings | null> {
  const { data, error } = await supabase.from("user_settings").select("currency").eq("user_id", userId).maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return toUserSettings(data);
}

export async function getOrCreateUserSettings(supabase: SupabaseClient, userId: string): Promise<UserSettings> {
  const existing = await selectUserSettings(supabase, userId);
  if (existing) return existing;

  const { error } = await supabase.from("user_settings").insert({ user_id: userId, currency: "USD" });

  if (error && error.code !== UNIQUE_VIOLATION) throw error;

  const created = await selectUserSettings(supabase, userId);
  if (!created) throw new Error(`user_settings row missing for user ${userId} after get-or-create`);

  return created;
}

export async function updateUserSettings(
  supabase: SupabaseClient,
  userId: string,
  input: UpdateSettingsRequest,
): Promise<UserSettings> {
  const { data, error } = await supabase
    .from("user_settings")
    .upsert({ user_id: userId, currency: input.currency }, { onConflict: "user_id" })
    .select("currency")
    .single();

  if (error) throw error;

  return toUserSettings(data);
}
