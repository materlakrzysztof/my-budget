import { describe, expect, it } from "vitest";
import {
  CategoryInUseError,
  CategoryNotFoundError,
  DuplicateCategoryError,
  createCategorySchema,
  normalizeCategoryName,
  updateCategorySchema,
} from "@/lib/services/categories";

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
    expect(error.message).toBe("Kategoria o nazwie „Food” już istnieje.");
  });
});

describe("CategoryNotFoundError", () => {
  it("has a stable name and message", () => {
    const error = new CategoryNotFoundError();
    expect(error.name).toBe("CategoryNotFoundError");
    expect(error.message).toBe("Kategoria nie została znaleziona.");
  });
});

describe("CategoryInUseError", () => {
  it("has a stable name and message", () => {
    const error = new CategoryInUseError();
    expect(error.name).toBe("CategoryInUseError");
    expect(error.message).toBe("Ta kategoria nadal ma przypisane wydatki i nie może zostać usunięta.");
  });
});

describe("updateCategorySchema", () => {
  it("accepts the same shape as createCategorySchema", () => {
    const input = { name: "Food", description: "Meals and snacks" };
    expect(updateCategorySchema.safeParse(input).success).toBe(true);
    expect(updateCategorySchema.safeParse(input)).toEqual(createCategorySchema.safeParse(input));
  });

  it.each([
    ["empty name", { name: "", description: "x" }],
    ["empty description", { name: "x", description: "" }],
    ["name too long", { name: "a".repeat(51), description: "x" }],
    ["description too long", { name: "x", description: "a".repeat(201) }],
  ])("rejects %s", (_label, input) => {
    expect(updateCategorySchema.safeParse(input).success).toBe(false);
  });
});
