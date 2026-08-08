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
  await page.goto("/expenses?action=add");
  await expect(page.getByRole("dialog", { name: "Dodaj wydatek" })).toBeVisible();

  // First expense: Groceries, the larger amount, with an optional name.
  await expenseDialog(page, "add").getByLabel("Kategoria").selectOption({ label: "Groceries" });
  await expenseDialog(page, "add").getByLabel("Nazwa").fill("Birthday dinner");
  await expenseDialog(page, "add").getByLabel("Kwota").fill("40.00");
  await expenseDialog(page, "add").getByRole("button", { name: "Dodaj wydatek" }).click();
  await expect(expenseRowFor(page, "Groceries")).toContainText("40,00 USD");
  await expect(expenseRowFor(page, "Groceries")).toContainText("Birthday dinner");

  // Second expense: Transport, the smaller amount.
  await page.getByRole("main").getByRole("button", { name: "Dodaj wydatek", exact: true }).click();
  await expenseDialog(page, "add").getByLabel("Kategoria").selectOption({ label: "Transport" });
  await expenseDialog(page, "add").getByLabel("Kwota").fill("15.00");
  await expenseDialog(page, "add").getByRole("button", { name: "Dodaj wydatek" }).click();
  await expect(expenseRowFor(page, "Transport")).toContainText("15,00 USD");

  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard$/);

  // Each category's own total in the summary — not mixed, not summed together.
  await expect(summaryRowFor(page, "Groceries")).toContainText("40,00 USD");
  await expect(summaryRowFor(page, "Transport")).toContainText("15,00 USD");

  // Largest-to-smallest ranking: Groceries (40) ranks above Transport (15).
  const summaryTexts = await page.getByRole("listitem").filter({ hasNotText: "·" }).allTextContents();
  const groceriesIndex = summaryTexts.findIndex((t) => t.includes("Groceries"));
  const transportIndex = summaryTexts.findIndex((t) => t.includes("Transport"));
  expect(groceriesIndex).toBeGreaterThanOrEqual(0);
  expect(transportIndex).toBeGreaterThan(groceriesIndex);

  // Changing currency only relabels — the underlying numbers must stay the same.
  await page.getByRole("link", { name: "Ustawienia" }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await page.waitForLoadState("networkidle");

  const currencySelect = page.getByLabel("Waluta");
  await expect(async () => {
    await currencySelect.selectOption({ label: "Polski złoty (PLN)" });
    await expect(currencySelect).toHaveValue("PLN");
  }).toPass({ timeout: 5000 });

  await page.getByRole("button", { name: "Zapisz" }).click();
  await expect(page.getByRole("status")).toHaveText("Waluta zaktualizowana.");

  await page.goto("/expenses");
  await expect(expenseRowFor(page, "Groceries")).toContainText("40,00 zł");
  await expect(expenseRowFor(page, "Transport")).toContainText("15,00 zł");
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(summaryRowFor(page, "Groceries")).toContainText("40,00 zł");
  await expect(summaryRowFor(page, "Transport")).toContainText("15,00 zł");
});
