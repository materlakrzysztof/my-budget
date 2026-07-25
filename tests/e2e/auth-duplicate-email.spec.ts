// risk: account-signin-signout plan.md Phase 2 #2 — Supabase's "already registered"
// error must surface to the user via ServerError, not fail silently.
// seed: tests/e2e/seed.spec.ts
import { test, expect } from "@playwright/test";
import { waitForAuthFormHydration } from "./helpers";

test("signing up twice with the same email shows a duplicate-account error", async ({ page }) => {
  const email = `e2e-dup-${Date.now()}@example.com`;
  const password = "TestPassword123!";

  async function signUp() {
    await page.goto("/auth/signup");
    await waitForAuthFormHydration(page);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByLabel("Confirm password").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();
  }

  // First signup succeeds (dev-mode auto-confirm).
  await signUp();
  await expect(page).toHaveURL(/\/auth\/confirm-email$/);

  // Second signup with the exact same email must be rejected, visibly.
  await signUp();
  await expect(page).toHaveURL(/\/auth\/signup\?error=/);
  // ServerError renders as a plain <p>, no ARIA alert role — assert via getByText.
  await expect(page.getByText("User already registered")).toBeVisible();
});
