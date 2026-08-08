// risk: categories-in-settings plan.md Phase 2 #3 — FR-023 guardrail: the old
// standalone /categories route must permanently redirect to /settings so
// existing bookmarks and deep links keep working (astro.config.mjs redirects).
// seed: tests/e2e/seed.spec.ts
import { test, expect } from "@playwright/test";
import { signUpAndSignIn } from "./helpers";

test("the old /categories route redirects to Settings, where categories are now managed", async ({ page }) => {
  const email = `e2e-cat-redirect-${Date.now()}@example.com`;
  const password = "TestPassword123!";

  await signUpAndSignIn(page, email, password);

  // Navigating to the retired route lands on Settings (Playwright follows the
  // 301), and the category manager is present there.
  await page.goto("/categories");
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole("heading", { name: "Twoje kategorie" })).toBeVisible();
});
