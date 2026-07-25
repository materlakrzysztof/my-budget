import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Signs up a brand-new, real user directly against the E2E Supabase project
 * (bypassing the Astro app and Playwright entirely). The project has
 * mailer_autoconfirm enabled, so signUp() returns an active session
 * immediately — a null session here means that assumption broke and the
 * whole suite's premise is invalid, so this fails loudly rather than
 * silently falling back to a separate sign-in step.
 */
export async function signUpTestUser(prefix: string): Promise<{ supabase: SupabaseClient; userId: string }> {
  const { SUPABASE_URL, SUPABASE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error(
      "[signUpTestUser] SUPABASE_URL/SUPABASE_KEY missing from process.env — env.ts should have set these.",
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const email = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const password = "TestPassword123!";

  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    throw new Error(`[signUpTestUser] signUp failed for prefix "${prefix}": ${error.message}`);
  }
  if (!data.session || !data.user) {
    throw new Error(
      `[signUpTestUser] signUp for prefix "${prefix}" returned no session — the E2E project's ` +
        "mailer_autoconfirm assumption no longer holds; this suite's premise is invalid.",
    );
  }

  return { supabase, userId: data.user.id };
}
