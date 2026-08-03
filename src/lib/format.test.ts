import { describe, expect, it } from "vitest";
import { formatAmount } from "./format";

// pl-PL renders the grouping/currency-code separator as a non-breaking space
// (U+00A0), not a regular space — asserted explicitly to avoid an invisible mismatch.
const NBSP = " ";

describe("formatAmount", () => {
  it("formats USD with pl-PL comma decimal and currency code suffix", () => {
    expect(formatAmount("40", "USD")).toBe(`40,00${NBSP}USD`);
  });

  it("formats PLN with the zł symbol", () => {
    expect(formatAmount("40", "PLN")).toBe(`40,00${NBSP}zł`);
  });

  it("always renders exactly 2 decimal places regardless of input precision", () => {
    expect(formatAmount("40.5", "USD")).toBe(`40,50${NBSP}USD`);
    expect(formatAmount("40", "EUR")).toBe(`40,00${NBSP}€`);
  });

  it("groups thousands with a non-breaking space (U+00A0)", () => {
    expect(formatAmount("12345.6", "PLN")).toBe(`12${NBSP}345,60${NBSP}zł`);
  });
});
