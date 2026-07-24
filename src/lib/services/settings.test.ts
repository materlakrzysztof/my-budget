import { describe, expect, it } from "vitest";
import { CURRENCIES } from "@/types";
import { updateSettingsSchema } from "./settings";

describe("updateSettingsSchema", () => {
  it.each(CURRENCIES)("accepts %s", (currency) => {
    const result = updateSettingsSchema.safeParse({ currency });
    expect(result.success).toBe(true);
  });

  it("rejects an unsupported currency code", () => {
    const result = updateSettingsSchema.safeParse({ currency: "XYZ" });
    expect(result.success).toBe(false);
  });
});
