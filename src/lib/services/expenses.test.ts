import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MonthlySummaryEntry } from "@/types";
import {
  computeComparison,
  createExpenseSchema,
  listExpenses,
  mergeCategoriesWithTotals,
  previousMonthReferenceDate,
  updateExpenseSchema,
} from "./expenses";

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

describe("listExpenses", () => {
  interface QueryBuilderMock {
    select: () => QueryBuilderMock;
    eq: (column: string, value: unknown) => QueryBuilderMock;
    order: () => Promise<{ data: unknown[]; error: null }>;
  }

  // Records every `.eq()` filter applied to the query so a test can assert
  // exactly which columns were constrained — the category clause is what
  // distinguishes a filtered call from an unfiltered one.
  function makeSupabaseMock() {
    const eqCalls: [string, unknown][] = [];
    const builder: QueryBuilderMock = {
      select: () => builder,
      eq: (column, value) => {
        eqCalls.push([column, value]);
        return builder;
      },
      order: () => Promise.resolve({ data: [], error: null }),
    };
    const supabase = { from: () => builder } as unknown as SupabaseClient;
    return { supabase, eqCalls };
  }

  it("constrains only by user_id when no filter is given", async () => {
    const { supabase, eqCalls } = makeSupabaseMock();
    await listExpenses(supabase, "user-1");
    expect(eqCalls).toEqual([["user_id", "user-1"]]);
    expect(eqCalls.some(([column]) => column === "category_id")).toBe(false);
  });

  it("adds a category_id clause when a categoryId filter is given", async () => {
    const { supabase, eqCalls } = makeSupabaseMock();
    await listExpenses(supabase, "user-1", { categoryId: "cat-9" });
    expect(eqCalls).toEqual([
      ["user_id", "user-1"],
      ["category_id", "cat-9"],
    ]);
  });

  it("ignores an empty filter object (no category clause)", async () => {
    const { supabase, eqCalls } = makeSupabaseMock();
    await listExpenses(supabase, "user-1", {});
    expect(eqCalls).toEqual([["user_id", "user-1"]]);
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

describe("previousMonthReferenceDate", () => {
  it("rolls back to the prior month within the same year", () => {
    const result = previousMonthReferenceDate(new Date(Date.UTC(2026, 6, 15))); // July 2026
    expect(result.getUTCFullYear()).toBe(2026);
    expect(result.getUTCMonth()).toBe(5); // June (0-indexed)
    expect(result.getUTCDate()).toBe(1);
  });

  it("rolls back across the year boundary for January", () => {
    const result = previousMonthReferenceDate(new Date(Date.UTC(2026, 0, 15))); // January 2026
    expect(result.getUTCFullYear()).toBe(2025);
    expect(result.getUTCMonth()).toBe(11); // December (0-indexed)
    expect(result.getUTCDate()).toBe(1);
  });
});

describe("computeComparison", () => {
  function entry(categoryId: string, categoryName: string, total: string, rank = 1): MonthlySummaryEntry {
    return { categoryId, categoryName, total, rank };
  }

  it("computes an increase with correct percentage and absolute amount", () => {
    const result = computeComparison([entry("c1", "Groceries", "150.00")], [entry("c1", "Groceries", "100.00")]);
    const groceries = result.categories.find((c) => c.categoryId === "c1");
    expect(groceries?.status).toBe("changed");
    expect(groceries?.changeAmount).toBe("50.00");
    expect(groceries?.changePercent).toBe(50);
    expect(result.totalChangeAmount).toBe("50.00");
    expect(result.totalChangePercent).toBe(50);
  });

  it("computes a decrease with correct percentage and absolute amount", () => {
    const result = computeComparison([entry("c1", "Groceries", "50.00")], [entry("c1", "Groceries", "100.00")]);
    const groceries = result.categories.find((c) => c.categoryId === "c1");
    expect(groceries?.status).toBe("changed");
    expect(groceries?.changeAmount).toBe("-50.00");
    expect(groceries?.changePercent).toBe(-50);
  });

  it("classifies a category with no prior spend as new, with a null percentage", () => {
    const result = computeComparison([entry("c1", "Travel", "80.00")], []);
    const travel = result.categories.find((c) => c.categoryId === "c1");
    expect(travel?.status).toBe("new");
    expect(travel?.changePercent).toBeNull();
    expect(travel?.changeAmount).toBe("80.00");
  });

  it("classifies a category with prior spend but none this month as dropped", () => {
    const result = computeComparison([], [entry("c1", "Travel", "80.00")]);
    const travel = result.categories.find((c) => c.categoryId === "c1");
    expect(travel?.status).toBe("dropped");
    expect(travel?.current).toBe("0.00");
    expect(travel?.changeAmount).toBe("-80.00");
  });

  it("marks comparisonAvailable false when the previous month had no spend", () => {
    const result = computeComparison([entry("c1", "Groceries", "50.00")], []);
    expect(result.comparisonAvailable).toBe(false);
  });

  it("marks comparisonAvailable true when the previous month had any spend", () => {
    const result = computeComparison([entry("c1", "Groceries", "50.00")], [entry("c1", "Groceries", "10.00")]);
    expect(result.comparisonAvailable).toBe(true);
  });

  it("reconciles the total delta with the sum of per-category deltas", () => {
    const result = computeComparison(
      [entry("c1", "Groceries", "150.00"), entry("c2", "Travel", "80.00")],
      [entry("c1", "Groceries", "100.00"), entry("c3", "Utilities", "40.00")],
    );
    const sumOfDeltas = result.categories.reduce((acc, c) => acc + Number(c.changeAmount), 0);
    expect(sumOfDeltas.toFixed(2)).toBe(result.totalChangeAmount);
  });
});
