import { formatAmount } from "@/lib/format";
import { DeltaBadge } from "@/components/dashboard/DeltaBadge";
import { MonthlySummary } from "@/components/dashboard/MonthlySummary";
import { SpendingDonut } from "@/components/dashboard/SpendingDonut";
import type { Currency, MonthlyComparison } from "@/types";

interface DashboardViewProps {
  comparison: MonthlyComparison;
  currency: Currency;
}

export default function DashboardView({ comparison, currency }: DashboardViewProps) {
  const currentEntries = comparison.categories.map((entry) => ({
    categoryId: entry.categoryId,
    categoryName: entry.categoryName,
    total: entry.current,
    rank: entry.rank,
  }));
  const spent = currentEntries.filter((entry) => Number(entry.total) > 0);

  if (spent.length === 0) {
    return (
      <div className="space-y-3 text-center">
        <p className="text-blue-100/70">No expenses this month yet.</p>
        <a
          href="/expenses?action=add"
          className="inline-block rounded-lg bg-purple-600 px-4 py-2 font-medium text-white transition-colors hover:bg-purple-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
        >
          Add an expense
        </a>
      </div>
    );
  }

  // The breakdown, when a comparison is available, lists any category with
  // spend in either month (so a dropped-to-zero category still gets a row) —
  // a deliberate union, not the current-month-only `spent` filter above.
  const breakdownEntries = comparison.comparisonAvailable
    ? comparison.categories
        .filter((entry) => Number(entry.current) > 0 || Number(entry.previous) > 0)
        .map((entry) => ({
          categoryId: entry.categoryId,
          categoryName: entry.categoryName,
          total: entry.current,
          rank: entry.rank,
          delta: { changeAmount: entry.changeAmount, changePercent: entry.changePercent, status: entry.status },
        }))
    : spent;

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-8">
        <SpendingDonut entries={spent} />
        <div className="text-center sm:text-left">
          <p className="text-sm text-blue-100/60">This month</p>
          <p className="text-3xl font-bold text-white">{formatAmount(comparison.currentTotal, currency)}</p>
          {comparison.comparisonAvailable && (
            <p className="mt-1">
              <DeltaBadge
                changeAmount={comparison.totalChangeAmount}
                changePercent={comparison.totalChangePercent}
                status="changed"
                currency={currency}
                label="vs last month"
              />
            </p>
          )}
          <p className="mt-2 text-sm text-blue-100/60">Per-category spending for the current month.</p>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-white">By category</h2>
        <MonthlySummary entries={breakdownEntries} currency={currency} />
      </div>
    </div>
  );
}
