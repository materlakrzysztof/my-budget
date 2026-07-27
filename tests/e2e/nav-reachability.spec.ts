// risk: persistent-nav-menu plan.md Phase 3 — FR-001/US-01 (prd-v2.md): a
// persistent nav must reach every core area (Dashboard, Add Expense,
// Settings) from any protected page, at both desktop and mobile widths, and
// sign-out must work from a non-Dashboard page. As of FR-023, category
// management lives inside Settings (no standalone /categories nav item), so
// "reach categories" is proven by the category manager being present on the
// Settings page.
// seed: tests/e2e/seed.spec.ts
import { test, expect } from "@playwright/test";
import { signUpAndSignIn } from "./helpers";

test("authenticated user can reach every core area via nav from any protected page (desktop)", async ({ page }) => {
  const email = `e2e-nav-desktop-${Date.now()}@example.com`;
  const password = "TestPassword123!";

  await signUpAndSignIn(page, email, password);
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/settings$/);
  // Category management is reachable here — folded into Settings (FR-023).
  await expect(page.getByRole("heading", { name: "Your categories" })).toBeVisible();

  await page.getByRole("link", { name: "Dashboard" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your categories" })).toBeVisible();

  await page.getByRole("link", { name: "Add Expense" }).click();
  await expect(page.getByRole("dialog", { name: "Add expense" })).toBeVisible();
  await expect(page).toHaveURL(/\/expenses$/);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Add expense" })).not.toBeVisible();

  // Sign out from a non-Dashboard page.
  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("link", { name: "Sign in", exact: true })).toBeVisible();
});

test("authenticated user can reach every core area via nav from any protected page (mobile)", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });

  const email = `e2e-nav-mobile-${Date.now()}@example.com`;
  const password = "TestPassword123!";

  await signUpAndSignIn(page, email, password);
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/settings$/);
  // Category management is reachable here — folded into Settings (FR-023).
  await expect(page.getByRole("heading", { name: "Your categories" })).toBeVisible();

  await page.getByRole("link", { name: "Dashboard" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your categories" })).toBeVisible();

  await page.getByRole("link", { name: "Add Expense" }).click();
  await expect(page.getByRole("dialog", { name: "Add expense" })).toBeVisible();
  await expect(page).toHaveURL(/\/expenses$/);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Add expense" })).not.toBeVisible();

  // Sign out from a non-Dashboard page.
  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("link", { name: "Sign in", exact: true })).toBeVisible();
});
