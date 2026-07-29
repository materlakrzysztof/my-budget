import type { CategoryDelta, MonthlyComparison, MonthlySummaryEntry } from "@/types";

// Pure aggregation/comparison math, deliberately free of Supabase/zod
// dependencies so it can be imported client-side (e.g. to recompute a
// MonthlyComparison after an in-place add) without pulling the server-only
// expenses service into the browser bundle.

export function mergeCategoriesWithTotals(
  categories: { id: string; name: string }[],
  totals: { categoryId: string; total: string }[],
): MonthlySummaryEntry[] {
  const totalsByCategory = new Map(totals.map((t) => [t.categoryId, t.total]));

  return categories
    .map((category) => ({
      categoryId: category.id,
      categoryName: category.name,
      total: totalsByCategory.get(category.id) ?? "0.00",
    }))
    .sort((a, b) => {
      const diff = Number(b.total) - Number(a.total);
      if (diff !== 0) return diff;
      return a.categoryName.localeCompare(b.categoryName);
    })
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

// Uses Date.UTC's field normalization (month -1 rolls back into December of
// the prior year) so the year boundary is handled without manual branching.
export function previousMonthReferenceDate(referenceDate: Date): Date {
  return new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth() - 1, 1));
}

export function computeComparison(current: MonthlySummaryEntry[], previous: MonthlySummaryEntry[]): MonthlyComparison {
  const currentByCategory = new Map(current.map((entry) => [entry.categoryId, entry]));
  const previousByCategory = new Map(previous.map((entry) => [entry.categoryId, entry]));
  const categoryIds = new Set([...currentByCategory.keys(), ...previousByCategory.keys()]);

  const categories: Omit<CategoryDelta, "rank">[] = [...categoryIds].map((categoryId) => {
    const currentEntry = currentByCategory.get(categoryId);
    const previousEntry = previousByCategory.get(categoryId);
    const currentTotal = currentEntry?.total ?? "0.00";
    const previousTotal = previousEntry?.total ?? "0.00";
    const currentNum = Number(currentTotal);
    const previousNum = Number(previousTotal);

    const status: CategoryDelta["status"] =
      previousNum === 0 && currentNum > 0 ? "new" : previousNum > 0 && currentNum === 0 ? "dropped" : "changed";

    return {
      categoryId,
      categoryName: currentEntry?.categoryName ?? previousEntry?.categoryName ?? "",
      current: currentTotal,
      previous: previousTotal,
      changeAmount: (currentNum - previousNum).toFixed(2),
      changePercent: previousNum === 0 ? null : ((currentNum - previousNum) / previousNum) * 100,
      status,
    };
  });

  categories.sort((a, b) => {
    const diff = Number(b.current) - Number(a.current);
    if (diff !== 0) return diff;
    return a.categoryName.localeCompare(b.categoryName);
  });

  const rankedCategories: CategoryDelta[] = categories.map((entry, index) => ({ ...entry, rank: index + 1 }));

  const currentTotalSum = current.reduce((acc, entry) => acc + Number(entry.total), 0);
  const previousTotalSum = previous.reduce((acc, entry) => acc + Number(entry.total), 0);

  return {
    currentTotal: currentTotalSum.toFixed(2),
    previousTotal: previousTotalSum.toFixed(2),
    totalChangeAmount: (currentTotalSum - previousTotalSum).toFixed(2),
    totalChangePercent: previousTotalSum === 0 ? null : ((currentTotalSum - previousTotalSum) / previousTotalSum) * 100,
    categories: rankedCategories,
    comparisonAvailable: previousTotalSum > 0,
  };
}
