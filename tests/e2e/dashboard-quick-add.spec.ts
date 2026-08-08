// risk: dashboard-quick-add plan.md Phase 2 #4 (S-10 / FR-019): the dashboard
// must let the user add an expense in one click, in place, from both the
// empty-state CTA and the always-visible header button, updating the
// total/breakdown without navigation.
//
// Note: the plan also called for a disabled-with-hint state when the
// account has zero categories. That state is unreachable in the current
// product — listCategories() (src/lib/services/categories.ts) lazily
// re-seeds the 8 default categories on every read that finds none, so no
// authenticated page load (dashboard included) can ever observe
// categories.length === 0. No test exists for that path; see the plan's
// Progress notes for this slice.
// seed: tests/e2e/seed.spec.ts
import { test, expect } from "@playwright/test";
import { signUpAndSignIn, expenseDialog, summaryRowFor } from "./helpers";

test("dashboard quick-add opens the dialog in place from both the empty state and the header button", async ({
  page,
}) => {
  const email = `e2e-dash-quickadd-${Date.now()}@example.com`;
  const password = "TestPassword123!";

  await signUpAndSignIn(page, email, password);

  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard$/);

  // Empty state: no expenses yet this month — the CTA opens the dialog in place.
  await expect(page.getByText("Brak wydatków w tym miesiącu.")).toBeVisible();
  const emptyStateButton = page.getByRole("main").getByRole("button", { name: "Dodaj wydatek", exact: true });
  await expect(async () => {
    await emptyStateButton.click();
    await expect(expenseDialog(page, "add")).toBeVisible({ timeout: 250 });
  }).toPass({ timeout: 5000 });

  await expenseDialog(page, "add").getByLabel("Kategoria").selectOption({ label: "Groceries" });
  await expenseDialog(page, "add").getByLabel("Kwota").fill("25.00");
  await expenseDialog(page, "add").getByRole("button", { name: "Dodaj wydatek" }).click();

  // Dialog closes and the dashboard updates in place — still on /dashboard, no reload.
  await expect(expenseDialog(page, "add")).not.toBeVisible();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(summaryRowFor(page, "Groceries")).toContainText("25,00 USD");

  // Header button (now visible since the month has spend) opens the same dialog.
  const headerButton = page.getByRole("main").getByRole("button", { name: "Dodaj wydatek", exact: true });
  await headerButton.click();
  await expect(expenseDialog(page, "add")).toBeVisible();
  await expenseDialog(page, "add").getByLabel("Kategoria").selectOption({ label: "Transport" });
  await expenseDialog(page, "add").getByLabel("Kwota").fill("15.00");
  await expenseDialog(page, "add").getByRole("button", { name: "Dodaj wydatek" }).click();

  await expect(expenseDialog(page, "add")).not.toBeVisible();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(summaryRowFor(page, "Transport")).toContainText("15,00 USD");
  // The first expense's category total is still there — the refresh replaced
  // the whole summary, not just the newly added category's row.
  await expect(summaryRowFor(page, "Groceries")).toContainText("25,00 USD");
});
