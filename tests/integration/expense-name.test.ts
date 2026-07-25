import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signUpTestUser } from "./supabase-client";
import { listCategories } from "@/lib/services/categories";
import { createExpense, updateExpense } from "@/lib/services/expenses";

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

interface TestUser {
  supabase: SupabaseClient;
  userId: string;
}

describe("expense name round-trip", () => {
  let user: TestUser;
  let categoryId: string;

  beforeAll(async () => {
    user = await signUpTestUser("integration-expense-name");
    const categories = await listCategories(user.supabase, user.userId);
    categoryId = categories[0].id;
  });

  it("persists a provided name through create", async () => {
    const expense = await createExpense(user.supabase, user.userId, {
      categoryId,
      name: "Birthday dinner",
      amount: "12.00",
      date: todayIsoDate(),
    });

    expect(expense.name).toBe("Birthday dinner");
  });

  it("stores a null name as null", async () => {
    const expense = await createExpense(user.supabase, user.userId, {
      categoryId,
      name: null,
      amount: "5.00",
      date: todayIsoDate(),
    });

    expect(expense.name).toBeNull();
  });

  it("updates an existing expense's name", async () => {
    const created = await createExpense(user.supabase, user.userId, {
      categoryId,
      name: null,
      amount: "8.00",
      date: todayIsoDate(),
    });

    const updated = await updateExpense(user.supabase, user.userId, created.id, {
      categoryId,
      name: "Groceries run",
      amount: "8.00",
      date: todayIsoDate(),
    });

    expect(updated.id).toBe(created.id);
    expect(updated.name).toBe("Groceries run");
  });
});
