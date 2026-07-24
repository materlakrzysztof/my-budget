// risk: log-and-summarize-expenses plan.md Phase 4 #1 — test-plan.md risk #4
// (an expense is saved under the wrong category) together with risk #2 (the
// summary total/ranking reconciles with the underlying entries): two
// expenses added under two distinct categories must each attribute to their
// own category's total (not the other's, not merged), and the larger total
// must rank above the smaller one — FR-006/FR-008/US-01.
// Also covers user-currency-setting plan.md Phase 4 #3: changing currency in
// Settings relabels existing amounts on /expenses without changing the
// underlying numbers — the reconciliation guardrail from prd-v2.md FR-005.
// seed: tests/e2e/seed.spec.ts
import { test, expect } from "@playwright/test";
import { signUpAndSignIn, expenseDialog, summaryRowFor, expenseRowFor } from "./helpers";

test("two expenses under two categories reconcile to their own category's total and rank largest-first", async ({
  page,
}) => {
  const email = `e2e-exp-add-${Date.now()}@example.com`;
  const password = "TestPassword123!";

  await signUpAndSignIn(page, email, password);
  await page.getByRole("link", { name: "Add Expense" }).click();
  await expect(page).toHaveURL(/\/expenses$/);
  await expect(page.getByRole("dialog", { name: "Add expense" })).toBeVisible();

  // First expense: Groceries, the larger amount.
  await expenseDialog(page, "add").getByLabel("Category").selectOption({ label: "Groceries" });
  await expenseDialog(page, "add").getByLabel("Amount").fill("40.00");
  await expenseDialog(page, "add").getByRole("button", { name: "Add expense" }).click();
  await expect(expenseRowFor(page, "Groceries")).toContainText("$40.00");

  // Second expense: Transport, the smaller amount.
  await page.getByRole("button", { name: "Add expense" }).click();
  await expenseDialog(page, "add").getByLabel("Category").selectOption({ label: "Transport" });
  await expenseDialog(page, "add").getByLabel("Amount").fill("15.00");
  await expenseDialog(page, "add").getByRole("button", { name: "Add expense" }).click();
  await expect(expenseRowFor(page, "Transport")).toContainText("$15.00");

  // Each category's own total in the summary — not mixed, not summed together.
  await expect(summaryRowFor(page, "Groceries")).toContainText("$40.00");
  await expect(summaryRowFor(page, "Transport")).toContainText("$15.00");

  // Largest-to-smallest ranking: Groceries ($40) ranks above Transport ($15).
  const summaryTexts = await page.getByRole("listitem").filter({ hasNotText: "·" }).allTextContents();
  const groceriesIndex = summaryTexts.findIndex((t) => t.includes("Groceries"));
  const transportIndex = summaryTexts.findIndex((t) => t.includes("Transport"));
  expect(groceriesIndex).toBeGreaterThanOrEqual(0);
  expect(transportIndex).toBeGreaterThan(groceriesIndex);

  // Changing currency only relabels — the underlying numbers must stay the same.
  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await page.waitForLoadState("networkidle");

  const currencySelect = page.getByLabel("Currency");
  await expect(async () => {
    await currencySelect.selectOption({ label: "Polish Złoty (PLN)" });
    await expect(currencySelect).toHaveValue("PLN");
  }).toPass({ timeout: 5000 });

  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status")).toHaveText("Currency updated.");

  await page.goto("/expenses");
  await expect(expenseRowFor(page, "Groceries")).toContainText("PLN 40.00");
  await expect(expenseRowFor(page, "Transport")).toContainText("PLN 15.00");
  await expect(summaryRowFor(page, "Groceries")).toContainText("PLN 40.00");
  await expect(summaryRowFor(page, "Transport")).toContainText("PLN 15.00");
});
