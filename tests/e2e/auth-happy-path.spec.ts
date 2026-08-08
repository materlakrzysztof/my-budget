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
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Hasło", { exact: true }).fill(password);
  await page.getByLabel("Powtórz hasło").fill(password);
  await page.getByRole("button", { name: "Utwórz konto" }).click();

  // Dev-mode auto-confirm: no email step, lands directly on the success copy.
  await expect(page).toHaveURL(/\/auth\/confirm-email$/);
  await expect(page.getByRole("heading", { name: "Rejestracja zakończona sukcesem" })).toBeVisible();

  // Sign in with the same credentials.
  await page.getByRole("link", { name: "Przejdź do logowania" }).click();
  await expect(page).toHaveURL(/\/auth\/signin$/);
  await waitForAuthFormHydration(page);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Hasło", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Zaloguj się" }).click();

  // Signed in: Topbar shows the user's email and a way into the protected area.
  await expect(page).toHaveURL(/\/(|dashboard)$/);
  await expect(page.getByText(email)).toBeVisible();

  // Reach the protected /dashboard.
  await page.getByRole("link", { name: "Pulpit" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Pulpit" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Wyloguj się" })).toBeVisible();

  // Sign out.
  await page.getByRole("button", { name: "Wyloguj się" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByText("Niezalogowany")).toBeVisible();

  // The real proof of "signed out": /dashboard is inaccessible again.
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/auth\/signin$/);
});
