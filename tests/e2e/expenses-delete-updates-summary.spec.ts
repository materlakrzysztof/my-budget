// risk: log-and-summarize-expenses plan.md Phase 4 #4 — deleting an expense
// via the in-app confirmation dialog (never a native browser confirm) must
// remove it from the list and drop the category's summary total by exactly
// that amount, not the whole category total.
// seed: tests/e2e/seed.spec.ts
import { test, expect } from "@playwright/test";
import { signUpAndSignIn, expenseDialog, summaryRowFor, expenseRowFor } from "./helpers";

test("deleting an expense via the confirmation dialog updates the list and the summary total", async ({ page }) => {
  const email = `e2e-exp-delete-${Date.now()}@example.com`;
  const password = "TestPassword123!";

  await signUpAndSignIn(page, email, password);
  await page.getByRole("link", { name: "Add Expense" }).click();
  await expect(page).toHaveURL(/\/expenses$/);
  await expect(page.getByRole("dialog", { name: "Add expense" })).toBeVisible();

  // Two expenses in the same category so the total is only meaningful if
  // exactly one entry's amount is subtracted, not the whole category wiped.
  await expenseDialog(page, "add").getByLabel("Category").selectOption({ label: "Utilities" });
  await expenseDialog(page, "add").getByLabel("Amount").fill("30.00");
  await expenseDialog(page, "add").getByRole("button", { name: "Add expense" }).click();
  await expect(expenseRowFor(page, "Utilities").filter({ hasText: "$30.00" })).toBeVisible();

  await page.getByRole("button", { name: "Add expense" }).click();
  await expenseDialog(page, "add").getByLabel("Category").selectOption({ label: "Utilities" });
  await expenseDialog(page, "add").getByLabel("Amount").fill("45.00");
  await expenseDialog(page, "add").getByRole("button", { name: "Add expense" }).click();
  await expect(expenseRowFor(page, "Utilities").filter({ hasText: "$45.00" })).toBeVisible();
  await expect(summaryRowFor(page, "Utilities")).toContainText("$75.00");

  const targetRow = expenseRowFor(page, "Utilities").filter({ hasText: "$45.00" });
  await targetRow.getByRole("button", { name: "Delete" }).click();

  const confirmDialog = page.getByRole("dialog", { name: "Delete expense" });
  await expect(confirmDialog).toBeVisible();
  await confirmDialog.getByRole("button", { name: "Delete" }).click();

  await expect(expenseRowFor(page, "Utilities").filter({ hasText: "$45.00" })).toHaveCount(0);
  await expect(expenseRowFor(page, "Utilities").filter({ hasText: "$30.00" })).toBeVisible();
  await expect(summaryRowFor(page, "Utilities")).toContainText("$30.00");
  await expect(summaryRowFor(page, "Utilities")).not.toContainText("$75.00");
});
