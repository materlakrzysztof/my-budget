import type { Expense } from "@/types";

export const EXPENSE_CREATED = "expense-created";
export const OPEN_ADD_EXPENSE = "open-add-expense";

export function dispatchExpenseCreated(detail?: Expense): void {
  window.dispatchEvent(new CustomEvent<Expense | undefined>(EXPENSE_CREATED, { detail }));
}

export function onExpenseCreated(handler: (detail?: Expense) => void): () => void {
  const listener = (e: Event) => {
    handler((e as CustomEvent<Expense | undefined>).detail);
  };
  window.addEventListener(EXPENSE_CREATED, listener);
  return () => {
    window.removeEventListener(EXPENSE_CREATED, listener);
  };
}

export function dispatchOpenAddExpense(): void {
  window.dispatchEvent(new CustomEvent(OPEN_ADD_EXPENSE));
}

export function onOpenAddExpense(handler: () => void): () => void {
  window.addEventListener(OPEN_ADD_EXPENSE, handler);
  return () => {
    window.removeEventListener(OPEN_ADD_EXPENSE, handler);
  };
}
