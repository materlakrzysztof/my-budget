// risk: expenses-category-filter plan.md Phase 2 #1 — S-15 / FR-024: the
// in-page category picker must filter the expenses list in place (no reload),
// sync ?category= in the URL, clear back to the full list, and preselect
// correctly when the filtered URL is loaded directly (drill-down/bookmark
// parity).
// seed: tests/e2e/seed.spec.ts
import { test, expect } from "@playwright/test";
import { signUpAndSignIn, expenseDialog, expenseRowFor } from "./helpers";

test("the category picker filters the expenses list in place, clears, and preselects on deep-link", async ({
  page,
}) => {
  const email = `e2e-catfilter-${Date.now()}@example.com`;
  const password = "TestPassword123!";

  await signUpAndSignIn(page, email, password);
  await page.goto("/expenses?action=add");
  await expect(page.getByRole("dialog", { name: "Add expense" })).toBeVisible();

  // Two Groceries expenses and one Transport — filtering must isolate Groceries.
  await expenseDialog(page, "add").getByLabel("Category").selectOption({ label: "Groceries" });
  await expenseDialog(page, "add").getByLabel("Amount").fill("40.00");
  await expenseDialog(page, "add").getByRole("button", { name: "Add expense" }).click();
  await expect(expenseRowFor(page, "Groceries")).toHaveCount(1);

  await page.getByRole("button", { name: "Add expense", exact: true }).click();
  await expenseDialog(page, "add").getByLabel("Category").selectOption({ label: "Groceries" });
  await expenseDialog(page, "add").getByLabel("Amount").fill("25.00");
  await expenseDialog(page, "add").getByRole("button", { name: "Add expense" }).click();
  await expect(expenseRowFor(page, "Groceries")).toHaveCount(2);

  await page.getByRole("button", { name: "Add expense", exact: true }).click();
  await expenseDialog(page, "add").getByLabel("Category").selectOption({ label: "Transport" });
  await expenseDialog(page, "add").getByLabel("Amount").fill("15.00");
  await expenseDialog(page, "add").getByRole("button", { name: "Add expense" }).click();
  await expect(expenseRowFor(page, "Transport")).toHaveCount(1);

  // Filter to Groceries: list narrows in place, no reload, URL syncs.
  await page.getByLabel("Filter by category").selectOption({ label: "Groceries" });
  await expect(page).toHaveURL(/\/expenses\?category=/);
  await expect(expenseRowFor(page, "Groceries")).toHaveCount(2);
  await expect(expenseRowFor(page, "Transport")).toHaveCount(0);

  const filteredUrl = new URL(page.url());
  const groceriesId = filteredUrl.searchParams.get("category");
  expect(groceriesId).toBeTruthy();

  // Clear back to "All categories": full list restored, URL resets.
  await page.getByLabel("Filter by category").selectOption({ label: "All categories" });
  await expect(page).toHaveURL(/\/expenses$/);
  await expect(expenseRowFor(page, "Groceries")).toHaveCount(2);
  await expect(expenseRowFor(page, "Transport")).toHaveCount(1);

  // Deep-link directly to the filtered URL: SSR renders the filtered list and
  // preselects the picker to the same category (drill-down/bookmark parity).
  await page.goto(`/expenses?category=${groceriesId}`);
  await expect(page).toHaveURL(/\/expenses\?category=/);
  await expect(page.getByLabel("Filter by category")).toHaveValue(groceriesId ?? "");
  await expect(expenseRowFor(page, "Groceries")).toHaveCount(2);
  await expect(expenseRowFor(page, "Transport")).toHaveCount(0);
});
