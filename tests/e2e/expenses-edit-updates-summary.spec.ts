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
  await page.goto("/expenses?action=add");
  await expect(page.getByRole("dialog", { name: "Dodaj wydatek" })).toBeVisible();

  await expenseDialog(page, "add").getByLabel("Kategoria").selectOption({ label: "Rozrywka" });
  await expenseDialog(page, "add").getByLabel("Kwota").fill("20.00");
  await expenseDialog(page, "add").getByRole("button", { name: "Dodaj wydatek" }).click();
  await expect(expenseRowFor(page, "Rozrywka")).toContainText("20,00 USD");
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(summaryRowFor(page, "Rozrywka")).toContainText("20,00 USD");

  await page.goto("/expenses");
  await expect(page).toHaveURL(/\/expenses$/);

  await expenseRowFor(page, "Rozrywka").getByRole("button", { name: "Edytuj" }).click();
  await expenseDialog(page, "edit").getByLabel("Nazwa").fill("Movie night");
  await expenseDialog(page, "edit").getByLabel("Kwota").fill("50.00");
  await expenseDialog(page, "edit").getByRole("button", { name: "Zapisz zmiany" }).click();

  await expect(expenseRowFor(page, "Rozrywka")).toContainText("50,00 USD");
  await expect(expenseRowFor(page, "Rozrywka")).toContainText("Movie night");
  await expect(expenseRowFor(page, "Rozrywka")).not.toContainText("20,00 USD");
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(summaryRowFor(page, "Rozrywka")).toContainText("50,00 USD");
  await expect(summaryRowFor(page, "Rozrywka")).not.toContainText("70,00 USD");
});
