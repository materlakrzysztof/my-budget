import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ExpenseList } from "@/components/expenses/ExpenseList";
import { ExpenseFormDialog } from "@/components/expenses/ExpenseFormDialog";
import { MonthlySummary } from "@/components/expenses/MonthlySummary";
import type {
  Category,
  CreateExpenseRequest,
  Expense,
  ListExpensesResponse,
  MonthlySummaryEntry,
  MonthlySummaryResponse,
} from "@/types";

interface ExpensesManagerProps {
  categories: Category[];
  initialExpenses: Expense[];
  initialSummary: MonthlySummaryEntry[];
}

type DialogMode = "closed" | "add" | "edit";

export default function ExpensesManager({ categories, initialExpenses, initialSummary }: ExpensesManagerProps) {
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses);
  const [summary, setSummary] = useState<MonthlySummaryEntry[]>(initialSummary);
  const [dialogMode, setDialogMode] = useState<DialogMode>("closed");
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  async function refresh() {
    const [expensesRes, summaryRes] = await Promise.all([fetch("/api/expenses"), fetch("/api/expenses/summary")]);

    if (expensesRes.ok) {
      const { expenses: nextExpenses } = (await expensesRes.json()) as ListExpensesResponse;
      setExpenses(nextExpenses);
    }

    if (summaryRes.ok) {
      const { summary: nextSummary } = (await summaryRes.json()) as MonthlySummaryResponse;
      setSummary(nextSummary);
    }
  }

  function openAddDialog() {
    setEditingExpense(null);
    setServerError(null);
    setDialogMode("add");
  }

  function openEditDialog(expense: Expense) {
    setEditingExpense(expense);
    setServerError(null);
    setDialogMode("edit");
  }

  function closeFormDialog() {
    setDialogMode("closed");
    setEditingExpense(null);
    setServerError(null);
  }

  function openDeleteDialog(expense: Expense) {
    setServerError(null);
    setDeleteTarget(expense);
  }

  function closeDeleteDialog() {
    setDeleteTarget(null);
    setServerError(null);
  }

  async function handleFormSubmit(input: CreateExpenseRequest) {
    const target = dialogMode === "edit" ? editingExpense : null;
    const url = target ? `/api/expenses/${target.id}` : "/api/expenses";
    const method = target ? "PATCH" : "POST";

    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    if (response.status === 422 || response.status === 409 || response.status === 404) {
      const body = (await response.json()) as { error: string };
      setServerError(body.error);
      return;
    }

    if (!response.ok) {
      setServerError(
        target ? "Failed to update expense. Please try again." : "Failed to create expense. Please try again.",
      );
      return;
    }

    closeFormDialog();
    await refresh();
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;

    const response = await fetch(`/api/expenses/${deleteTarget.id}`, { method: "DELETE" });
    if (!response.ok && response.status !== 404) {
      setServerError("Failed to delete expense. Please try again.");
      return;
    }

    closeDeleteDialog();
    await refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-3 text-lg font-semibold text-white">This month&apos;s summary</h2>
        <MonthlySummary entries={summary} />
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Expenses</h2>
          <Button
            type="button"
            onClick={openAddDialog}
            className="rounded-lg bg-purple-600 px-4 py-2 font-medium text-white transition-colors hover:bg-purple-500"
          >
            Add expense
          </Button>
        </div>
        <ExpenseList expenses={expenses} onEdit={openEditDialog} onDeleteRequest={openDeleteDialog} />
      </div>

      <ExpenseFormDialog
        key={`${dialogMode}-${editingExpense?.id ?? "new"}`}
        open={dialogMode !== "closed"}
        mode={dialogMode === "edit" ? "edit" : "add"}
        categories={categories}
        editingExpense={editingExpense}
        onSubmit={handleFormSubmit}
        onClose={closeFormDialog}
        serverError={serverError}
      />

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(next) => {
          if (!next) closeDeleteDialog();
        }}
      >
        <DialogContent className="border-white/10 bg-slate-900 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Delete expense</DialogTitle>
            <DialogDescription className="text-blue-100/70">
              Are you sure you want to delete this expense? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {serverError && (
            <p
              role="alert"
              className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-900/30 px-3 py-2 text-sm text-red-300"
            >
              {serverError}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="border-white/20 bg-white/10 text-white hover:bg-white/20"
              onClick={closeDeleteDialog}
            >
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={handleConfirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
