import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ExpenseFormDialog } from "@/components/expenses/ExpenseFormDialog";
import { useCreateExpense } from "@/components/hooks/useCreateExpense";
import { dispatchExpenseCreated, onOpenAddExpense } from "@/lib/expense-events";
import { t } from "@/i18n";
import type { Category, CreateExpenseRequest, ListCategoriesResponse } from "@/types";

export default function GlobalAddExpense() {
  const [open, setOpen] = useState(false);
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const { createExpense } = useCreateExpense();
  const hasFetchedCategories = useRef(false);

  const openDialog = useCallback(async () => {
    setServerError(null);
    setOpen(true);
    if (!hasFetchedCategories.current) {
      try {
        const response = await fetch("/api/categories");
        if (response.ok) {
          const { categories: fetched } = (await response.json()) as ListCategoriesResponse;
          hasFetchedCategories.current = true;
          setCategories(fetched);
        }
      } catch {
        // Transient failure — leave hasFetchedCategories false so the next open retries.
      }
    }
  }, []);

  useEffect(() => {
    return onOpenAddExpense(() => {
      void openDialog();
    });
  }, [openDialog]);

  function closeDialog() {
    setOpen(false);
    setServerError(null);
  }

  async function handleSubmit(input: CreateExpenseRequest) {
    const result = await createExpense(input);
    if (!result.ok) {
      setServerError(result.error);
      return;
    }

    closeDialog();
    dispatchExpenseCreated(result.expense);
  }

  const hasNoCategories = categories !== null && categories.length === 0;

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="text-purple-300 transition-colors hover:text-purple-100 hover:underline"
      >
        {t("expense.addButton")}
      </button>

      {hasNoCategories ? (
        <Dialog
          open={open}
          onOpenChange={(next) => {
            if (!next) closeDialog();
          }}
        >
          <DialogContent className="border-white/10 bg-slate-900 text-white">
            <DialogHeader>
              <DialogTitle className="text-white">{t("expense.addButton")}</DialogTitle>
              <DialogDescription className="text-blue-100/70">{t("expense.needsCategoryFirst")}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button asChild className="w-full rounded-lg bg-purple-600 px-4 py-2 font-medium text-white">
                <a href="/settings">{t("expense.goToSettingsCta")}</a>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : (
        <ExpenseFormDialog
          key={categories === null ? "loading" : "loaded"}
          open={open}
          mode="add"
          categories={categories ?? []}
          editingExpense={null}
          onSubmit={handleSubmit}
          onClose={closeDialog}
          serverError={serverError}
        />
      )}
    </>
  );
}
