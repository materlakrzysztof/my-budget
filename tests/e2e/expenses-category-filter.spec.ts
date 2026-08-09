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
  await expect(page.getByRole("dialog", { name: "Dodaj wydatek" })).toBeVisible();

  // Two Zakupy spożywcze expenses and one Transport — filtering must isolate Zakupy spożywcze.
  await expenseDialog(page, "add").getByLabel("Kategoria").selectOption({ label: "Zakupy spożywcze" });
  await expenseDialog(page, "add").getByLabel("Kwota").fill("40.00");
  await expenseDialog(page, "add").getByRole("button", { name: "Dodaj wydatek" }).click();
  await expect(expenseRowFor(page, "Zakupy spożywcze")).toHaveCount(1);

  await page.getByRole("main").getByRole("button", { name: "Dodaj wydatek", exact: true }).click();
  await expenseDialog(page, "add").getByLabel("Kategoria").selectOption({ label: "Zakupy spożywcze" });
  await expenseDialog(page, "add").getByLabel("Kwota").fill("25.00");
  await expenseDialog(page, "add").getByRole("button", { name: "Dodaj wydatek" }).click();
  await expect(expenseRowFor(page, "Zakupy spożywcze")).toHaveCount(2);

  await page.getByRole("main").getByRole("button", { name: "Dodaj wydatek", exact: true }).click();
  await expenseDialog(page, "add").getByLabel("Kategoria").selectOption({ label: "Transport" });
  await expenseDialog(page, "add").getByLabel("Kwota").fill("15.00");
  await expenseDialog(page, "add").getByRole("button", { name: "Dodaj wydatek" }).click();
  await expect(expenseRowFor(page, "Transport")).toHaveCount(1);

  // Filter to Zakupy spożywcze: list narrows in place, no reload, URL syncs.
  await page.getByLabel("Filtruj według kategorii").selectOption({ label: "Zakupy spożywcze" });
  await expect(page).toHaveURL(/\/expenses\?category=/);
  await expect(expenseRowFor(page, "Zakupy spożywcze")).toHaveCount(2);
  await expect(expenseRowFor(page, "Transport")).toHaveCount(0);

  const filteredUrl = new URL(page.url());
  const groceriesId = filteredUrl.searchParams.get("category");
  expect(groceriesId).toBeTruthy();

  // Clear back to "All categories": full list restored, URL resets.
  await page.getByLabel("Filtruj według kategorii").selectOption({ label: "Wszystkie kategorie" });
  await expect(page).toHaveURL(/\/expenses$/);
  await expect(expenseRowFor(page, "Zakupy spożywcze")).toHaveCount(2);
  await expect(expenseRowFor(page, "Transport")).toHaveCount(1);

  // Deep-link directly to the filtered URL: SSR renders the filtered list and
  // preselects the picker to the same category (drill-down/bookmark parity).
  await page.goto(`/expenses?category=${groceriesId}`);
  await expect(page).toHaveURL(/\/expenses\?category=/);
  await expect(page.getByLabel("Filtruj według kategorii")).toHaveValue(groceriesId ?? "");
  await expect(expenseRowFor(page, "Zakupy spożywcze")).toHaveCount(2);
  await expect(expenseRowFor(page, "Transport")).toHaveCount(0);
});
