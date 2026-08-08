// risk: expense-categories plan.md Phase 4 #2 — FR-005 happy path: a new,
// unique category is added via the CategoriesManager island and appears in
// the list immediately, without a page reload. As of FR-023 the manager lives
// in the Categories section of Settings, reached via the Settings nav link.
// seed: tests/e2e/seed.spec.ts
import { test, expect } from "@playwright/test";
import { signUpAndSignIn, openAddCategoryDialog, categoryDialog } from "./helpers";

test("adding a new unique category appears in the list without a page reload", async ({ page }) => {
  const email = `e2e-cat-add-${Date.now()}@example.com`;
  const password = "TestPassword123!";
  const categoryName = `E2E Category ${Date.now()}`;

  await signUpAndSignIn(page, email, password);
  await page.getByRole("link", { name: "Ustawienia" }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await openAddCategoryDialog(page);

  const dialog = categoryDialog(page, "add");
  await dialog.getByLabel("Nazwa").fill(categoryName);
  await dialog.getByLabel("Opis").fill("Created by an e2e test");
  await dialog.getByRole("button", { name: "Dodaj kategorię" }).click();

  // Appears in place: category list updates from the same /settings page.
  await expect(page.getByText(categoryName, { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/settings(\?.*)?$/);

  // Dialog closes on success, ready for the next action.
  await expect(dialog).toBeHidden();
});
