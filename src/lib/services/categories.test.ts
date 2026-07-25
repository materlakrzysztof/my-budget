import { describe, expect, it } from "vitest";
import { DuplicateCategoryError, normalizeCategoryName } from "@/lib/services/categories";

describe("normalizeCategoryName", () => {
  const cases: [string, string][] = [
    ["Food", "food"],
    ["  Food  ", "food"],
    ["FOOD", "food"],
    ["food", "food"],
    ["Food   Truck", "food   truck"],
  ];

  it.each(cases)("normalizes %j to %j", (input, expected) => {
    expect(normalizeCategoryName(input)).toBe(expected);
  });
});

describe("DuplicateCategoryError", () => {
  it("carries the existing category's name in its message", () => {
    const error = new DuplicateCategoryError("Food");
    expect(error.existingName).toBe("Food");
    expect(error.message).toBe("A category named 'Food' already exists.");
  });
});
