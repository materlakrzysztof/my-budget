import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signUpTestUser } from "./supabase-client";
import { listCategories } from "@/lib/services/categories";
import { createExpense, CategoryOwnershipError } from "@/lib/services/expenses";

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

interface TestUser {
  supabase: SupabaseClient;
  userId: string;
}

describe("category attachment validation", () => {
  let userA: TestUser;
  let userB: TestUser;
  let bCategoryId: string;

  beforeAll(async () => {
    [userA, userB] = await Promise.all([
      signUpTestUser("integration-category-validation-a"),
      signUpTestUser("integration-category-validation-b"),
    ]);

    const bCategories = await listCategories(userB.supabase, userB.userId);
    bCategoryId = bCategories[0].id;
  });

  it("rejects creating an expense under a category owned by a different user", async () => {
    await expect(
      createExpense(userA.supabase, userA.userId, {
        categoryId: bCategoryId,
        amount: "10.00",
        date: todayIsoDate(),
      }),
    ).rejects.toBeInstanceOf(CategoryOwnershipError);
  });
});
