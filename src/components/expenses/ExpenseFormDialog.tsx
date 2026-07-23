import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { Category, CreateExpenseRequest, Expense } from "@/types";

const fieldClassName =
  "border-white/20 bg-white/10 text-white placeholder:text-white/40 focus-visible:border-purple-400 focus-visible:ring-purple-400";

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

interface ExpenseFormDialogProps {
  open: boolean;
  mode: "add" | "edit";
  categories: Category[];
  editingExpense: Expense | null;
  onSubmit: (input: CreateExpenseRequest) => Promise<void>;
  onClose: () => void;
  serverError: string | null;
}

export function ExpenseFormDialog({
  open,
  mode,
  categories,
  editingExpense,
  onSubmit,
  onClose,
  serverError,
}: ExpenseFormDialogProps) {
  const [categoryId, setCategoryId] = useState(() =>
    mode === "edit" && editingExpense ? editingExpense.categoryId : (categories[0]?.id ?? ""),
  );
  const [amount, setAmount] = useState(() => (mode === "edit" && editingExpense ? editingExpense.amount : ""));
  const [date, setDate] = useState(() => (mode === "edit" && editingExpense ? editingExpense.date : todayIsoDate()));
  const [errors, setErrors] = useState<{ categoryId?: string; amount?: string; date?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  function validate() {
    const next: typeof errors = {};

    if (!categoryId) {
      next.categoryId = "Category is required";
    }

    if (!/^\d+(\.\d{1,2})?$/.test(amount.trim()) || Number(amount) <= 0) {
      next.amount = "Enter a positive amount with up to 2 decimal places";
    }

    if (!date || date > todayIsoDate()) {
      next.date = "Date cannot be in the future";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!validate()) return;

    setSubmitting(true);
    try {
      await onSubmit({ categoryId, amount: amount.trim(), date });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="border-white/10 bg-slate-900 text-white">
        <DialogHeader>
          <DialogTitle className="text-white">{mode === "add" ? "Add expense" : "Edit expense"}</DialogTitle>
          <DialogDescription className="sr-only">
            {mode === "add" ? "Add a new expense" : "Edit an existing expense"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="expense-category" className="mb-1 block text-sm text-blue-100/80">
              Category
            </label>
            <select
              id="expense-category"
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                if (errors.categoryId) setErrors((prev) => ({ ...prev, categoryId: undefined }));
              }}
              className={cn("h-9 w-full rounded-md border px-3 py-1 text-base shadow-xs outline-none", fieldClassName)}
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id} className="text-black">
                  {category.name}
                </option>
              ))}
            </select>
            {errors.categoryId && <p className="mt-1 text-xs text-red-300">{errors.categoryId}</p>}
          </div>

          <div>
            <label htmlFor="expense-amount" className="mb-1 block text-sm text-blue-100/80">
              Amount
            </label>
            <Input
              id="expense-amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                if (errors.amount) setErrors((prev) => ({ ...prev, amount: undefined }));
              }}
              placeholder="0.00"
              className={fieldClassName}
            />
            {errors.amount && <p className="mt-1 text-xs text-red-300">{errors.amount}</p>}
          </div>

          <div>
            <label htmlFor="expense-date" className="mb-1 block text-sm text-blue-100/80">
              Date
            </label>
            <Input
              id="expense-date"
              type="date"
              max={todayIsoDate()}
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                if (errors.date) setErrors((prev) => ({ ...prev, date: undefined }));
              }}
              className={fieldClassName}
            />
            {errors.date && <p className="mt-1 text-xs text-red-300">{errors.date}</p>}
          </div>

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
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-purple-600 px-4 py-2 font-medium text-white transition-colors hover:bg-purple-500"
            >
              {submitting ? "Saving..." : mode === "add" ? "Add expense" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
