import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signUpTestUser } from "./supabase-client";
import { listCategories } from "@/lib/services/categories";
import { createExpense, CategoryOwnershipError, listExpenses } from "@/lib/services/expenses";

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
        name: null,
        amount: "10.00",
        date: todayIsoDate(),
      }),
    ).rejects.toBeInstanceOf(CategoryOwnershipError);
  });
});

describe("listExpenses category filtering", () => {
  let owner: TestUser;
  let other: TestUser;
  let ownerCatA: string;
  let ownerCatB: string;
  let otherCategoryId: string;

  beforeAll(async () => {
    [owner, other] = await Promise.all([
      signUpTestUser("integration-list-filter-owner"),
      signUpTestUser("integration-list-filter-other"),
    ]);

    const ownerCategories = await listCategories(owner.supabase, owner.userId);
    ownerCatA = ownerCategories[0].id;
    ownerCatB = ownerCategories[1].id;

    const otherCategories = await listCategories(other.supabase, other.userId);
    otherCategoryId = otherCategories[0].id;

    await createExpense(owner.supabase, owner.userId, {
      categoryId: ownerCatA,
      name: null,
      amount: "10.00",
      date: todayIsoDate(),
    });
    await createExpense(owner.supabase, owner.userId, {
      categoryId: ownerCatA,
      name: null,
      amount: "20.00",
      date: todayIsoDate(),
    });
    await createExpense(owner.supabase, owner.userId, {
      categoryId: ownerCatB,
      name: null,
      amount: "5.00",
      date: todayIsoDate(),
    });
  });

  it("returns only the filtered category's expenses for the owning user", async () => {
    const result = await listExpenses(owner.supabase, owner.userId, { categoryId: ownerCatA });

    expect(result).toHaveLength(2);
    expect(result.every((expense) => expense.categoryId === ownerCatA)).toBe(true);
  });

  it("returns every expense when no filter is given", async () => {
    const result = await listExpenses(owner.supabase, owner.userId);

    expect(result).toHaveLength(3);
  });

  it("returns an empty array (not an error) when filtering by another user's category", async () => {
    const result = await listExpenses(owner.supabase, owner.userId, { categoryId: otherCategoryId });

    expect(result).toEqual([]);
  });
});
