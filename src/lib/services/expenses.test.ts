import { describe, expect, it } from "vitest";
import { createExpenseSchema, mergeCategoriesWithTotals, updateExpenseSchema } from "./expenses";

describe("mergeCategoriesWithTotals", () => {
  it("defaults a category with no matching total to 0.00", () => {
    const result = mergeCategoriesWithTotals([{ id: "c1", name: "Groceries" }], []);
    expect(result).toEqual([{ categoryId: "c1", categoryName: "Groceries", total: "0.00", rank: 1 }]);
  });

  it("sorts descending by numeric total", () => {
    const result = mergeCategoriesWithTotals(
      [
        { id: "c1", name: "Groceries" },
        { id: "c2", name: "Transport" },
      ],
      [
        { categoryId: "c1", total: "10.00" },
        { categoryId: "c2", total: "50.00" },
      ],
    );
    expect(result.map((r) => r.categoryId)).toEqual(["c2", "c1"]);
    expect(result.map((r) => r.rank)).toEqual([1, 2]);
  });

  it("breaks ties alphabetically by category name", () => {
    const result = mergeCategoriesWithTotals(
      [
        { id: "c1", name: "Zebra" },
        { id: "c2", name: "Apple" },
      ],
      [
        { categoryId: "c1", total: "20.00" },
        { categoryId: "c2", total: "20.00" },
      ],
    );
    expect(result.map((r) => r.categoryId)).toEqual(["c2", "c1"]);
  });

  it("assigns sequential ranks after sorting", () => {
    const result = mergeCategoriesWithTotals(
      [
        { id: "c1", name: "A" },
        { id: "c2", name: "B" },
        { id: "c3", name: "C" },
      ],
      [
        { categoryId: "c1", total: "5.00" },
        { categoryId: "c2", total: "15.00" },
        { categoryId: "c3", total: "10.00" },
      ],
    );
    expect(result.map((r) => r.rank)).toEqual([1, 2, 3]);
    expect(result.map((r) => r.categoryId)).toEqual(["c2", "c3", "c1"]);
  });
});

describe("createExpenseSchema", () => {
  const validCategoryId = "11111111-1111-4111-8111-111111111111";

  function todayIso(): string {
    return new Date().toISOString().slice(0, 10);
  }

  function futureIso(): string {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  }

  it("accepts a well-formed positive amount", () => {
    const result = createExpenseSchema.safeParse({ categoryId: validCategoryId, amount: "12.50", date: todayIso() });
    expect(result.success).toBe(true);
  });

  it("rejects a zero amount", () => {
    const result = createExpenseSchema.safeParse({ categoryId: validCategoryId, amount: "0", date: todayIso() });
    expect(result.success).toBe(false);
  });

  it("rejects a negative amount", () => {
    const result = createExpenseSchema.safeParse({ categoryId: validCategoryId, amount: "-5.00", date: todayIso() });
    expect(result.success).toBe(false);
  });

  it("rejects an amount with more than 2 decimal places", () => {
    const result = createExpenseSchema.safeParse({ categoryId: validCategoryId, amount: "5.123", date: todayIso() });
    expect(result.success).toBe(false);
  });

  it("accepts today's date", () => {
    const result = createExpenseSchema.safeParse({ categoryId: validCategoryId, amount: "10.00", date: todayIso() });
    expect(result.success).toBe(true);
  });

  it("accepts a past date", () => {
    const result = createExpenseSchema.safeParse({
      categoryId: validCategoryId,
      amount: "10.00",
      date: "2020-01-01",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a future date", () => {
    const result = createExpenseSchema.safeParse({ categoryId: validCategoryId, amount: "10.00", date: futureIso() });
    expect(result.success).toBe(false);
  });

  it("rejects a missing categoryId", () => {
    const result = createExpenseSchema.safeParse({ amount: "10.00", date: todayIso() });
    expect(result.success).toBe(false);
  });

  it("rejects an empty categoryId", () => {
    const result = createExpenseSchema.safeParse({ categoryId: "", amount: "10.00", date: todayIso() });
    expect(result.success).toBe(false);
  });
});

describe("createExpenseSchema — name field", () => {
  const base = { categoryId: "11111111-1111-4111-8111-111111111111", amount: "10.00", date: "2020-01-01" };

  it("trims and passes through a normal name", () => {
    const result = createExpenseSchema.safeParse({ ...base, name: "  Birthday dinner  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe("Birthday dinner");
  });

  it("accepts a name of exactly 100 characters", () => {
    const result = createExpenseSchema.safeParse({ ...base, name: "a".repeat(100) });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe("a".repeat(100));
  });

  it("rejects a name longer than 100 characters", () => {
    const result = createExpenseSchema.safeParse({ ...base, name: "a".repeat(101) });
    expect(result.success).toBe(false);
  });

  it("normalizes an empty string to null", () => {
    const result = createExpenseSchema.safeParse({ ...base, name: "" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBeNull();
  });

  it("normalizes a whitespace-only name to null", () => {
    const result = createExpenseSchema.safeParse({ ...base, name: "   " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBeNull();
  });

  it("defaults an omitted name to null", () => {
    const result = createExpenseSchema.safeParse({ ...base });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBeNull();
  });

  it("updateExpenseSchema applies the same name normalization", () => {
    const result = updateExpenseSchema.safeParse({ ...base, name: "   " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBeNull();
  });
});
