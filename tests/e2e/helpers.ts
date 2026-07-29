import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * React islands (`client:load`) are SSR-rendered first and hydrate shortly
 * after. Filling or clicking before hydration completes is a silent no-op
 * (or gets wiped once React catches up and re-renders from its own,
 * still-empty, controlled state) — a well-known SSR/islands race. A UI
 * effect that only exists once hydrated makes a real wait-for-state gate:
 * each attempt is followed by a short state check, and only success (or the
 * final timeout) ends the loop — never a fixed-time wait.
 */

export async function waitForAuthFormHydration(page: Page) {
  const toggle = page.getByRole("button", { name: "Show password" }).first();
  const hydratedMarker = page.getByRole("button", { name: "Hide password" });

  // ~10s total budget: wide enough to absorb CI/local resource contention
  // (observed to flake at a 5s budget when other CPU-heavy tasks ran
  // concurrently), while still failing fast if hydration is genuinely broken.
  for (let attempt = 0; attempt < 40; attempt++) {
    await toggle.click();
    try {
      await expect(hydratedMarker).toBeVisible({ timeout: 250 });
      return;
    } catch {
      // Not hydrated yet — the click was a no-op. Retry.
    }
  }

  // Final attempt: let it report the real, informative timeout error.
  await expect(hydratedMarker).toBeVisible();
}

/**
 * The categories page's "Add category" button is a plain onClick handler
 * inside the CategoriesManager island (client:load) — before hydration a click
 * is a silent no-op, the same SSR/islands race waitForAuthFormHydration guards
 * against. Retrying the click until the Add-category dialog actually opens both
 * proves hydration and leaves the dialog open, ready for the caller to fill in
 * the fields. Mirrors openAddExpenseDialog.
 */
export async function openAddCategoryDialog(page: Page) {
  await page.waitForLoadState("networkidle");
  const addButton = page.getByRole("button", { name: "Add category" });

  await expect(async () => {
    await addButton.click();
    await expect(page.getByRole("dialog", { name: "Add category" })).toBeVisible({ timeout: 250 });
  }).toPass({ timeout: 5000 });
}

/**
 * Scopes to the add/edit category dialog by its title. This disambiguates the
 * dialog's own submit button (labeled "Add category" in add mode) from the
 * page-level button of the same name that opens the dialog in the first place.
 */
export function categoryDialog(page: Page, mode: "add" | "edit") {
  return page.getByRole("dialog", { name: mode === "add" ? "Add category" : "Edit category" });
}

/**
 * Signs up a brand-new user (dev-mode auto-confirm) and signs them in,
 * landing on "/". Each caller must still pass its own unique email so
 * specs stay independent under parallel/random-order runs.
 */
export async function signUpAndSignIn(page: Page, email: string, password: string) {
  await page.goto("/auth/signup");
  await waitForAuthFormHydration(page);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/auth\/confirm-email$/);
  await page.getByRole("link", { name: "Go to sign in" }).click();
  await expect(page).toHaveURL(/\/auth\/signin$/);
  await waitForAuthFormHydration(page);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/(|dashboard)$/);
}

/**
 * The expenses page's "Add expense" button is a plain onClick handler inside
 * the ExpensesManager island (client:load) — before hydration a click is a
 * silent no-op, the same SSR/islands race waitForAuthFormHydration guards
 * against. Retrying the click until the Add-expense dialog actually opens
 * both proves hydration and leaves the dialog open, ready for the caller to
 * fill in the first expense.
 */
export async function openAddExpenseDialog(page: Page) {
  await page.waitForLoadState("networkidle");
  const addButton = page.getByRole("button", { name: "Add expense" });

  await expect(async () => {
    await addButton.click();
    await expect(page.getByRole("dialog", { name: "Add expense" })).toBeVisible({ timeout: 250 });
  }).toPass({ timeout: 5000 });
}

/**
 * Scopes to the add/edit expense dialog by its title. This disambiguates the
 * dialog's own submit button (labeled "Add expense" in add mode) from the
 * page-level button of the same name that opens the dialog in the first place.
 */
export function expenseDialog(page: Page, mode: "add" | "edit") {
  return page.getByRole("dialog", { name: mode === "add" ? "Add expense" : "Edit expense" });
}

/**
 * A MonthlySummary row and an ExpenseList row can show the same category
 * name and dollar amount, so a plain text match can't tell them apart. Only
 * the expense-list row renders the "·" date separator — the stable way to
 * distinguish "this category's total" from "this one expense entry".
 */
export function summaryRowFor(page: Page, categoryName: string) {
  return page.getByRole("listitem").filter({ hasText: categoryName }).filter({ hasNotText: "·" });
}

export function expenseRowFor(page: Page, categoryName: string) {
  return page.getByRole("listitem").filter({ hasText: categoryName }).filter({ hasText: "·" });
}
