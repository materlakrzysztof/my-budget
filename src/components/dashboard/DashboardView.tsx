import { formatAmount } from "@/lib/format";
import { MonthlySummary } from "@/components/expenses/MonthlySummary";
import { SpendingDonut } from "@/components/dashboard/SpendingDonut";
import type { Currency, MonthlySummaryEntry } from "@/types";

interface DashboardViewProps {
  entries: MonthlySummaryEntry[];
  currency: Currency;
}

export function DashboardView({ entries, currency }: DashboardViewProps) {
  const spent = entries.filter((entry) => Number(entry.total) > 0);

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

  const total = entries.reduce((acc, entry) => acc + Number(entry.total), 0).toFixed(2);

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-8">
        <SpendingDonut entries={spent} />
        <div className="text-center sm:text-left">
          <p className="text-sm text-blue-100/60">This month</p>
          <p className="text-3xl font-bold text-white">{formatAmount(total, currency)}</p>
          <p className="mt-2 text-sm text-blue-100/60">Per-category spending for the current month.</p>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-white">By category</h2>
        <MonthlySummary entries={spent} currency={currency} />
      </div>
    </div>
  );
}
