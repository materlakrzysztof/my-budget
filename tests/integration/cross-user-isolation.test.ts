import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signUpTestUser } from "./supabase-client";
import { listCategories } from "@/lib/services/categories";
import { createExpense, getMonthlySummary } from "@/lib/services/expenses";

/**
 * Attacker (user B) actions in this file deliberately issue raw
 * `supabase.from(...)` calls with no `.eq("user_id", ...)` filter — the
 * service layer's own defense-in-depth filter would otherwise absorb a
 * broken RLS policy and make these tests pass vacuously. See the plan's
 * "Critical Implementation Details" for why.
 *
 * The expenses `it` blocks below rely on Vitest's default sequential,
 * non-shuffled execution within a file: the update test's zero-rows
 * assertion and the delete test's "still exists" assertion both depend
 * on `aExpenseId` still pointing at an untouched row, which only holds
 * if these run in the order they're written.
 */

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

interface TestUser {
  supabase: SupabaseClient;
  userId: string;
}

describe("cross-user isolation & summary exclusion", () => {
  let userA: TestUser;
  let userB: TestUser;
  let aCategoryId: string;
  let aExpenseId: string;
  const aExpenseAmount = "42.00";

  beforeAll(async () => {
    [userA, userB] = await Promise.all([
      signUpTestUser("integration-isolation-a"),
      signUpTestUser("integration-isolation-b"),
    ]);

    const aCategories = await listCategories(userA.supabase, userA.userId);
    aCategoryId = aCategories[0].id;

    const aExpense = await createExpense(userA.supabase, userA.userId, {
      categoryId: aCategoryId,
      amount: aExpenseAmount,
      date: todayIsoDate(),
    });
    aExpenseId = aExpense.id;
  });

  describe("categories", () => {
    it("does not let B select A's category by id", async () => {
      const { data, error } = await userB.supabase.from("categories").select("id").eq("id", aCategoryId);

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it("rejects B inserting a category with user_id forged to A", async () => {
      const { error } = await userB.supabase
        .from("categories")
        .insert({ user_id: userA.userId, name: "Forged Category", description: "Forged" });

      expect(error).not.toBeNull();
    });
  });

  describe("expenses", () => {
    it("does not let B select A's expense by id", async () => {
      const { data, error } = await userB.supabase.from("expenses").select("id").eq("id", aExpenseId);

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it("rejects B inserting an expense with user_id forged to A", async () => {
      const { error } = await userB.supabase.from("expenses").insert({
        user_id: userA.userId,
        category_id: aCategoryId,
        amount: "999.99",
        date: todayIsoDate(),
      });

      expect(error).not.toBeNull();
    });

    it("B's raw update against A's expense affects zero rows and leaves A's amount unchanged", async () => {
      const { data: updated, error } = await userB.supabase
        .from("expenses")
        .update({ amount: "1.00" })
        .eq("id", aExpenseId)
        .select("id");

      expect(error).toBeNull();
      expect(updated).toEqual([]);

      const { data: refetched, error: refetchError } = await userA.supabase
        .from("expenses")
        .select("amount")
        .eq("id", aExpenseId)
        .single();

      expect(refetchError).toBeNull();
      expect(Number(refetched?.amount)).toBe(Number(aExpenseAmount));
    });

    it("B's raw delete against A's expense affects zero rows and A's expense still exists", async () => {
      const { data: deleted, error } = await userB.supabase.from("expenses").delete().eq("id", aExpenseId).select("id");

      expect(error).toBeNull();
      expect(deleted).toEqual([]);

      const { data: refetched, error: refetchError } = await userA.supabase
        .from("expenses")
        .select("id")
        .eq("id", aExpenseId)
        .single();

      expect(refetchError).toBeNull();
      expect(refetched?.id).toBe(aExpenseId);
    });
  });

  describe("summary exclusion", () => {
    it("A's monthly totals are unaffected by B's own expenses, and B cannot see A's totals directly", async () => {
      const summaryBefore = await getMonthlySummary(userA.supabase, userA.userId);

      const bCategories = await listCategories(userB.supabase, userB.userId);
      await createExpense(userB.supabase, userB.userId, {
        categoryId: bCategories[0].id,
        amount: "15.00",
        date: todayIsoDate(),
      });
      await createExpense(userB.supabase, userB.userId, {
        categoryId: bCategories[1].id,
        amount: "20.00",
        date: todayIsoDate(),
      });

      const summaryAfter = await getMonthlySummary(userA.supabase, userA.userId);
      expect(summaryAfter).toEqual(summaryBefore);

      const { data, error } = await userB.supabase
        .from("monthly_category_summary")
        .select("total")
        .eq("user_id", userA.userId);

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });
  });
});
