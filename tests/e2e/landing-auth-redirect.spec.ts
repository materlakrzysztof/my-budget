// risk: landing-page plan.md — authenticated users should be redirected from
// "/" to "/dashboard", while logged-out visitors should see the public
// landing content.
import { test, expect } from "@playwright/test";
import { signUpAndSignIn } from "./helpers";

test("logged-out visitor sees MyBudget landing at root", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { name: "MyBudget" })).toBeVisible();
  await expect(page.locator('a[href="/auth/signup"][class*="bg-purple-600"]')).toBeVisible();
  await expect(page.locator('a[href="/auth/signin"][class*="border-white/20"]')).toBeVisible();
});

test("authenticated user hitting root is redirected to dashboard", async ({ page }) => {
  const email = `e2e-landing-${Date.now()}@example.com`;
  const password = "TestPassword123!";

  await signUpAndSignIn(page, email, password);
  await page.goto("/");

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Pulpit" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Wyloguj się" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "MyBudget" })).not.toBeVisible();
});
