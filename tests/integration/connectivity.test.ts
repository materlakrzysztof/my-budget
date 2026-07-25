import { describe, expect, it } from "vitest";
import { signUpTestUser } from "./supabase-client";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe("integration test infrastructure connectivity", () => {
  it("signs up a real user against the E2E Supabase project and gets a userId back", async () => {
    const { userId } = await signUpTestUser("integration-connectivity");

    expect(userId).toMatch(UUID_PATTERN);
  });
});
