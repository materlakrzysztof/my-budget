// risk: account-signin-signout plan.md Phase 2 #3 — signin with a wrong password
// shows a clear, generic error without revealing whether the email is registered
// (basic no-user-enumeration hygiene) and does not redirect the user in.
// seed: tests/e2e/seed.spec.ts
import { test, expect } from "@playwright/test";
import { waitForAuthFormHydration } from "./helpers";

test("signing in with a wrong password is rejected and does not redirect in", async ({ page }) => {
  const email = `e2e-wrongpw-${Date.now()}@example.com`;
  const password = "TestPassword123!";

  // Create a real account first (dev-mode auto-confirm).
  await page.goto("/auth/signup");
  await waitForAuthFormHydration(page);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Hasło", { exact: true }).fill(password);
  await page.getByLabel("Powtórz hasło").fill(password);
  await page.getByRole("button", { name: "Utwórz konto" }).click();
  await expect(page).toHaveURL(/\/auth\/confirm-email$/);

  // Attempt signin with the wrong password.
  await page.goto("/auth/signin");
  await waitForAuthFormHydration(page);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Hasło", { exact: true }).fill("DefinitelyWrongPassword1!");
  await page.getByRole("button", { name: "Zaloguj się" }).click();

  // Rejected: stays on signin with a generic error, never redirected to "/".
  await expect(page).toHaveURL(/\/auth\/signin\?error=/);
  await expect(page.getByText("Nieprawidłowy adres e-mail lub hasło.")).toBeVisible();
});
