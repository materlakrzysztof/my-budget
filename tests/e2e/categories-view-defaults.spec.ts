// risk: expense-categories plan.md Phase 4 #1 — FR-003: a freshly signed-up
// user's first visit to Settings (which hosts category management as of
// FR-023) shows the 8 default categories, seeded lazily on first read
// (src/lib/services/categories.ts: listCategories).
// seed: tests/e2e/seed.spec.ts
import { test, expect } from "@playwright/test";
import { signUpAndSignIn } from "./helpers";

const DEFAULT_CATEGORY_NAMES = [
  "Groceries",
  "Transport",
  "Housing",
  "Utilities",
  "Entertainment",
  "Health",
  "Clothing",
  "Other",
];

test("a freshly signed-up user's first visit to Settings shows the 8 default categories", async ({ page }) => {
  const email = `e2e-cat-defaults-${Date.now()}@example.com`;
  const password = "TestPassword123!";

  await signUpAndSignIn(page, email, password);

  // First visit to Settings: the 8 defaults are seeded transparently when the
  // Categories section loads.
  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole("heading", { name: "Your categories" })).toBeVisible();

  for (const name of DEFAULT_CATEGORY_NAMES) {
    await expect(page.getByText(name, { exact: true })).toBeVisible();
  }
});
