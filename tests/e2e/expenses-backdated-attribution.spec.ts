// risk: log-and-summarize-expenses plan.md Phase 4 #2 — test-plan.md risk #3
// (a backdated expense is attributed to the wrong month): an expense dated
// two months ago must not contribute to the current month's summary total —
// only the today-dated expense in the same category should, per US-02.
// seed: tests/e2e/seed.spec.ts
import { test, expect } from "@playwright/test";
import { signUpAndSignIn, expenseDialog, summaryRowFor } from "./helpers";

function isoDateMonthsAgo(months: number): string {
  const now = new Date();
  const past = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months, 10));
  return past.toISOString().slice(0, 10);
}

test("a backdated expense does not affect the current month's summary total", async ({ page }) => {
  const email = `e2e-exp-backdate-${Date.now()}@example.com`;
  const password = "TestPassword123!";
  const backdatedDate = isoDateMonthsAgo(2);

  await signUpAndSignIn(page, email, password);
  await page.goto("/expenses?action=add");
  await expect(page.getByRole("dialog", { name: "Dodaj wydatek" })).toBeVisible();

  // Today-dated expense in Mieszkanie.
  await expenseDialog(page, "add").getByLabel("Kategoria").selectOption({ label: "Mieszkanie" });
  await expenseDialog(page, "add").getByLabel("Kwota").fill("25.00");
  await expenseDialog(page, "add").getByRole("button", { name: "Dodaj wydatek" }).click();
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(summaryRowFor(page, "Mieszkanie")).toContainText("25,00 USD");

  // Backdated expense (two months ago), same category, larger amount.
  await page.goto("/expenses");
  await expect(page).toHaveURL(/\/expenses$/);
  await page.getByRole("main").getByRole("button", { name: "Dodaj wydatek", exact: true }).click();
  await expenseDialog(page, "add").getByLabel("Kategoria").selectOption({ label: "Mieszkanie" });
  await expenseDialog(page, "add").getByLabel("Kwota").fill("99.00");
  await expenseDialog(page, "add").getByLabel("Data").fill(backdatedDate);
  await expenseDialog(page, "add").getByRole("button", { name: "Dodaj wydatek" }).click();

  // The backdated entry lands in the list, but the current month's summary
  // total for Mieszkanie stays exactly the today-dated amount — never the sum.
  await expect(page.getByText(backdatedDate)).toBeVisible();
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(summaryRowFor(page, "Mieszkanie")).toContainText("25,00 USD");
  await expect(summaryRowFor(page, "Mieszkanie")).not.toContainText("124,00 USD");
});
