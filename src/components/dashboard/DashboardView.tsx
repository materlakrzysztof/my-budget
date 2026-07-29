import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useCreateExpense } from "@/components/hooks/useCreateExpense";
import { ExpenseFormDialog } from "@/components/expenses/ExpenseFormDialog";
import { DeltaBadge } from "@/components/dashboard/DeltaBadge";
import { MonthlySummary } from "@/components/dashboard/MonthlySummary";
import { SpendingDonut } from "@/components/dashboard/SpendingDonut";
import { computeComparison } from "@/lib/comparison";
import { formatAmount } from "@/lib/format";
import type {
  Category,
  CreateExpenseRequest,
  Currency,
  MonthlyComparison,
  MonthlySummaryEntry,
  MonthlySummaryResponse,
} from "@/types";

interface DashboardViewProps {
  comparison: MonthlyComparison;
  currency: Currency;
  categories: Category[];
}

export default function DashboardView({ comparison: initialComparison, currency, categories }: DashboardViewProps) {
  const [comparison, setComparison] = useState(initialComparison);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const { createExpense } = useCreateExpense();

  function openAddDialog() {
    setServerError(null);
    setDialogOpen(true);
  }

  function closeAddDialog() {
    setDialogOpen(false);
    setServerError(null);
  }

  async function handleAddExpense(input: CreateExpenseRequest) {
    const result = await createExpense(input);
    if (!result.ok) {
      setServerError(result.error);
      return;
    }

    // Re-fetch the authoritative current-month summary and recompute the
    // comparison against the previous month already held in state — never
    // patch `entries` locally, so the total/donut/breakdown and delta badges
    // can't drift from what a server render would show (see plan's
    // "Post-add refresh source of truth" guardrail).
    const response = await fetch("/api/expenses/summary");
    if (response.ok) {
      const { summary } = (await response.json()) as MonthlySummaryResponse;
      const previousEntries: MonthlySummaryEntry[] = comparison.categories.map((entry) => ({
        categoryId: entry.categoryId,
        categoryName: entry.categoryName,
        total: entry.previous,
        rank: 0,
      }));
      setComparison(computeComparison(summary, previousEntries));
    }

    closeAddDialog();
  }

  const addExpenseButton = (
    <Button
      type="button"
      onClick={openAddDialog}
      className="rounded-lg bg-purple-600 px-4 py-2 font-medium text-white transition-colors hover:bg-purple-500"
    >
      Add expense
    </Button>
  );

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
        <div className="flex justify-center">{addExpenseButton}</div>
        <ExpenseFormDialog
          open={dialogOpen}
          mode="add"
          categories={categories}
          editingExpense={null}
          onSubmit={handleAddExpense}
          onClose={closeAddDialog}
          serverError={serverError}
        />
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
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-white">By category</h2>
          {addExpenseButton}
        </div>
        <MonthlySummary entries={breakdownEntries} currency={currency} />
      </div>

      <ExpenseFormDialog
        open={dialogOpen}
        mode="add"
        categories={categories}
        editingExpense={null}
        onSubmit={handleAddExpense}
        onClose={closeAddDialog}
        serverError={serverError}
      />
    </div>
  );
}
