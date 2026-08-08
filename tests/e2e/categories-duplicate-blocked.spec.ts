// risk: expense-categories plan.md Phase 4 #3 — the hard-block duplicate
// rule: a case/whitespace variant of an existing category name is rejected
// with the inline role="alert" error, and no duplicate row is created
// (src/lib/services/categories.ts: normalizeCategoryName + DuplicateCategoryError).
// seed: tests/e2e/seed.spec.ts
import { test, expect } from "@playwright/test";
import { signUpAndSignIn, openAddCategoryDialog, categoryDialog } from "./helpers";

test("a case/whitespace variant of an existing category name is blocked with an inline alert", async ({ page }) => {
  const email = `e2e-cat-dup-${Date.now()}@example.com`;
  const password = "TestPassword123!";
  const baseName = `E2E Dup ${Date.now()}`;
  const duplicateVariant = `  ${baseName.toUpperCase()}  `;

  await signUpAndSignIn(page, email, password);
  await page.getByRole("link", { name: "Ustawienia" }).click();
  await expect(page).toHaveURL(/\/settings$/);

  // Add the original category.
  await openAddCategoryDialog(page);
  const addDialog = categoryDialog(page, "add");
  await addDialog.getByLabel("Nazwa").fill(baseName);
  await addDialog.getByLabel("Opis").fill("Original category");
  await addDialog.getByRole("button", { name: "Dodaj kategorię" }).click();
  await expect(page.getByText(baseName, { exact: true })).toBeVisible();

  // Attempt a case/whitespace variant of the same name.
  await openAddCategoryDialog(page);
  const dupDialog = categoryDialog(page, "add");
  await dupDialog.getByLabel("Nazwa").fill(duplicateVariant);
  await dupDialog.getByLabel("Opis").fill("Attempted duplicate");
  await dupDialog.getByRole("button", { name: "Dodaj kategorię" }).click();

  // The duplicate error surfaces inside the still-open dialog.
  const alert = dupDialog.getByRole("alert");
  await expect(alert).toBeVisible();
  await expect(alert).toContainText(baseName);

  // Still only one row for this category — no duplicate was created.
  await dupDialog.getByRole("button", { name: "Close" }).click();
  await expect(page.getByText(baseName, { exact: true })).toHaveCount(1);
});
