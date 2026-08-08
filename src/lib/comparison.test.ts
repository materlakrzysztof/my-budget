import { describe, expect, it } from "vitest";
import type { MonthlySummaryEntry } from "@/types";
import { computeComparison, mergeCategoriesWithTotals, previousMonthReferenceDate } from "./comparison";

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
