// risk: log-and-summarize-expenses plan.md Phase 4 #3 — an edit must replace
// (not add to) an expense's contribution: editing an amount has to update
// both the expense list and the category's summary total, never leave the
// summary showing a stale value or the old-plus-new sum.
// seed: tests/e2e/seed.spec.ts
import { test, expect } from "@playwright/test";
import { signUpAndSignIn, expenseDialog, summaryRowFor, expenseRowFor } from "./helpers";

test("editing an expense's amount updates both the list and the summary total", async ({ page }) => {
  const email = `e2e-exp-edit-${Date.now()}@example.com`;
  const password = "TestPassword123!";

  await signUpAndSignIn(page, email, password);
  await page.getByRole("link", { name: "Add Expense" }).click();
  await expect(page).toHaveURL(/\/expenses$/);
  await expect(page.getByRole("dialog", { name: "Add expense" })).toBeVisible();

  await expenseDialog(page, "add").getByLabel("Category").selectOption({ label: "Entertainment" });
  await expenseDialog(page, "add").getByLabel("Amount").fill("20.00");
  await expenseDialog(page, "add").getByRole("button", { name: "Add expense" }).click();
  await expect(expenseRowFor(page, "Entertainment")).toContainText("$20.00");
  await expect(summaryRowFor(page, "Entertainment")).toContainText("$20.00");

  await expenseRowFor(page, "Entertainment").getByRole("button", { name: "Edit" }).click();
  await expenseDialog(page, "edit").getByLabel("Amount").fill("50.00");
  await expenseDialog(page, "edit").getByRole("button", { name: "Save changes" }).click();

  await expect(expenseRowFor(page, "Entertainment")).toContainText("$50.00");
  await expect(expenseRowFor(page, "Entertainment")).not.toContainText("$20.00");
  await expect(summaryRowFor(page, "Entertainment")).toContainText("$50.00");
  await expect(summaryRowFor(page, "Entertainment")).not.toContainText("$70.00");
});
