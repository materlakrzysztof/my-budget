// seed: the exemplar every generated spec in this project follows.
// Patterns demonstrated: role-based locators, single self-contained test,
// wait-for-state (not time), and a name tied to a real risk.
import { test, expect } from "@playwright/test";

test("unauthenticated visit to /dashboard redirects to sign-in", async ({ page }) => {
  await page.goto("/dashboard");

  await expect(page).toHaveURL(/\/auth\/signin$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});
