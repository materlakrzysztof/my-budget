// risk: add-expense-dialog plan.md Phase 3 #5 (S-16 / FR-025): the Topbar
// "Add Expense" trigger must open the add-expense dialog in place from any
// page — no navigation — and a successful create must refresh the current
// page's own view (here, the dashboard summary) without a reload.
// seed: tests/e2e/seed.spec.ts
import { test, expect } from "@playwright/test";
import { signUpAndSignIn, expenseDialog, summaryRowFor } from "./helpers";

test("global Add Expense dialog opens in place from the dashboard and updates the summary", async ({ page }) => {
  const email = `e2e-global-add-${Date.now()}@example.com`;
  const password = "TestPassword123!";

  await signUpAndSignIn(page, email, password);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole("navigation").getByRole("button", { name: "Add Expense" }).click();
  await expect(page.getByRole("dialog", { name: "Add expense" })).toBeVisible();
  await expect(page).toHaveURL(/\/dashboard$/);

  await expenseDialog(page, "add").getByLabel("Category").selectOption({ label: "Groceries" });
  await expenseDialog(page, "add").getByLabel("Amount").fill("35.00");
  await expenseDialog(page, "add").getByRole("button", { name: "Add expense" }).click();

  await expect(page.getByRole("dialog", { name: "Add expense" })).not.toBeVisible();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(summaryRowFor(page, "Groceries")).toContainText("$35.00");
});
