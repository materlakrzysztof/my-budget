// risk: account-signin-signout plan.md Phase 2 #1 — the full FR-001/FR-002 journey
// (signup -> dev-mode auto-confirm -> signin -> reach /dashboard -> signout ->
// Topbar reverts AND /dashboard is actually inaccessible again).
// seed: tests/e2e/seed.spec.ts
import { test, expect } from "@playwright/test";
import { waitForAuthFormHydration } from "./helpers";

test("account creation, sign-in, and sign-out survive as one real flow", async ({ page }) => {
  const email = `e2e-happy-${Date.now()}@example.com`;
  const password = "TestPassword123!";

  // Sign up with a brand-new, unique email.
  await page.goto("/auth/signup");
  await waitForAuthFormHydration(page);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();

  // Dev-mode auto-confirm: no email step, lands directly on the success copy.
  await expect(page).toHaveURL(/\/auth\/confirm-email$/);
  await expect(page.getByRole("heading", { name: "Registration successful" })).toBeVisible();

  // Sign in with the same credentials.
  await page.getByRole("link", { name: "Go to sign in" }).click();
  await expect(page).toHaveURL(/\/auth\/signin$/);
  await waitForAuthFormHydration(page);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();

  // Signed in: Topbar shows the user's email and a way into the protected area.
  await expect(page).toHaveURL(/\/(|dashboard)$/);
  await expect(page.getByText(email)).toBeVisible();

  // Reach the protected /dashboard.
  await page.getByRole("link", { name: "Dashboard" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();

  // Sign out.
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByText("Not signed in")).toBeVisible();

  // The real proof of "signed out": /dashboard is inaccessible again.
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/auth\/signin$/);
});
