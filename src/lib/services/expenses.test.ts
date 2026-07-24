import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createExpenseSchema, listExpenses, mergeCategoriesWithTotals } from "./expenses";

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
