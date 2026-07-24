import { Button } from "@/components/ui/button";
import { formatAmount } from "@/lib/format";
import type { Currency, Expense } from "@/types";

interface ExpenseListProps {
  expenses: Expense[];
  currency: Currency;
  onEdit: (expense: Expense) => void;
  onDeleteRequest: (expense: Expense) => void;
}

export function ExpenseList({ expenses, currency, onEdit, onDeleteRequest }: ExpenseListProps) {
  if (expenses.length === 0) {
    return <p className="text-sm text-blue-100/50">No expenses yet.</p>;
  }

  return (
    <ul className="space-y-2">
      {expenses.map((expense) => (
        <li
          key={expense.id}
          className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3"
        >
          <div>
            <p className="font-medium text-white">{formatAmount(expense.amount, currency)}</p>
            <p className="text-sm text-blue-100/60">
              {expense.date} &middot; {expense.categoryName}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-white/20 bg-white/10 text-white hover:bg-white/20"
              onClick={() => {
                onEdit(expense);
              }}
            >
              Edit
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => {
                onDeleteRequest(expense);
              }}
            >
              Delete
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
