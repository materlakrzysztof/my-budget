import { describe, expect, it } from "vitest";
import { formatAmount } from "./format";

describe("formatAmount", () => {
  it("formats USD matching today's hardcoded output", () => {
    expect(formatAmount("40", "USD")).toBe("$40.00");
  });

  it("forces 2 decimal places for a non-symbol-mapped currency", () => {
    expect(formatAmount("40", "PLN")).toBe("PLN 40.00");
  });

  it("always renders exactly 2 decimal places regardless of input precision", () => {
    expect(formatAmount("40.5", "USD")).toBe("$40.50");
    expect(formatAmount("40", "EUR")).toBe("€40.00");
  });
});
