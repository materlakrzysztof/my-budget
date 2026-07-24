import { describe, expect, it } from "vitest";
import { signUpTestUser } from "./supabase-client";
import { getOrCreateUserSettings, updateUserSettings } from "@/lib/services/settings";

describe("user settings get-or-create and update", () => {
  it("seeds USD on first read and is idempotent on a second read", async () => {
    const { supabase, userId } = await signUpTestUser("integration-settings-seed");

    const first = await getOrCreateUserSettings(supabase, userId);
    expect(first).toEqual({ currency: "USD" });

    const second = await getOrCreateUserSettings(supabase, userId);
    expect(second).toEqual({ currency: "USD" });
  });

  it("updates the stored currency and get-or-create reflects it afterward", async () => {
    const { supabase, userId } = await signUpTestUser("integration-settings-update");

    await getOrCreateUserSettings(supabase, userId);

    const updated = await updateUserSettings(supabase, userId, { currency: "PLN" });
    expect(updated).toEqual({ currency: "PLN" });

    const reread = await getOrCreateUserSettings(supabase, userId);
    expect(reread).toEqual({ currency: "PLN" });
  });
});
