import type { CreateExpenseRequest, Expense, ExpenseResponse } from "@/types";

export type CreateExpenseResult = { ok: true; expense: Expense } | { ok: false; error: string };

export function useCreateExpense() {
  async function createExpense(input: CreateExpenseRequest): Promise<CreateExpenseResult> {
    const response = await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    if (response.status === 422 || response.status === 409 || response.status === 404) {
      const body = (await response.json()) as { error: string };
      return { ok: false, error: body.error };
    }

    if (!response.ok) {
      return { ok: false, error: "Failed to create expense. Please try again." };
    }

    const { expense } = (await response.json()) as ExpenseResponse;
    return { ok: true, expense };
  }

  return { createExpense };
}
