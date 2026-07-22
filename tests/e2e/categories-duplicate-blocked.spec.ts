// risk: expense-categories plan.md Phase 4 #3 — the hard-block duplicate
// rule: a case/whitespace variant of an existing category name is rejected
// with the inline role="alert" error, and no duplicate row is created
// (src/lib/services/categories.ts: normalizeCategoryName + DuplicateCategoryError).
// seed: tests/e2e/seed.spec.ts
import { test, expect } from "@playwright/test";
import { signUpAndSignIn, waitForCategoriesFormHydration } from "./helpers";

test("a case/whitespace variant of an existing category name is blocked with an inline alert", async ({ page }) => {
  const email = `e2e-cat-dup-${Date.now()}@example.com`;
  const password = "TestPassword123!";
  const baseName = `E2E Dup ${Date.now()}`;
  const duplicateVariant = `  ${baseName.toUpperCase()}  `;

  await signUpAndSignIn(page, email, password);
  await page.getByRole("link", { name: "Categories" }).click();
  await expect(page).toHaveURL(/\/categories$/);
  await waitForCategoriesFormHydration(page);

  // Add the original category.
  await page.getByLabel("Name").fill(baseName);
  await page.getByLabel("Description").fill("Original category");
  await page.getByRole("button", { name: "Add category" }).click();
  await expect(page.getByText(baseName, { exact: true })).toBeVisible();

  // Attempt a case/whitespace variant of the same name.
  await page.getByLabel("Name").fill(duplicateVariant);
  await page.getByLabel("Description").fill("Attempted duplicate");
  await page.getByRole("button", { name: "Add category" }).click();

  const alert = page.getByRole("alert");
  await expect(alert).toBeVisible();
  await expect(alert).toContainText(baseName);

  // Still only one row for this category — no duplicate was created.
  await expect(page.getByText(baseName, { exact: true })).toHaveCount(1);
});
