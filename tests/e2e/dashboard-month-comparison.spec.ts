// risk: dashboard-month-comparison plan.md Phase 2 #4 (S-09 / FR-018 / US-05):
// the dashboard must hide the month-over-month comparison until the previous
// calendar month has any spend, then show a total delta plus per-category
// deltas covering an increase (changed), a category with no prior spend
// (new), and a category with prior spend but none this month (dropped).
// seed: tests/e2e/seed.spec.ts
import { test, expect } from "@playwright/test";
import { signUpAndSignIn, expenseDialog, summaryRowFor } from "./helpers";

function isoDateInPreviousMonth(day = 10): string {
  const now = new Date();
  const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, day));
  return prev.toISOString().slice(0, 10);
}

test("dashboard shows the month-over-month comparison only once the previous month has spend", async ({ page }) => {
  const email = `e2e-dash-cmp-${Date.now()}@example.com`;
  const password = "TestPassword123!";
  const lastMonth = isoDateInPreviousMonth();

  await signUpAndSignIn(page, email, password);

  // No expenses at all yet — no comparison to show.
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("względem poprzedniego miesiąca")).toHaveCount(0);

  // Current-month-only expense (Zakupy spożywcze) — previous month still has no
  // spend, so the comparison stays hidden.
  await page.goto("/expenses?action=add");
  await expenseDialog(page, "add").getByLabel("Kategoria").selectOption({ label: "Zakupy spożywcze" });
  await expenseDialog(page, "add").getByLabel("Kwota").fill("50.00");
  await expenseDialog(page, "add").getByRole("button", { name: "Dodaj wydatek" }).click();

  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(summaryRowFor(page, "Zakupy spożywcze")).toContainText("50,00 USD");
  await expect(page.getByText("względem poprzedniego miesiąca")).toHaveCount(0);

  // Previous-month spend in Zakupy spożywcze (increases this month: 30 -> 50) and
  // in Mieszkanie only (dropped to 0 this month). Transport has no previous
  // spend at all (new this month).
  await page.goto("/expenses");
  await expect(page).toHaveURL(/\/expenses$/);

  await page.getByRole("main").getByRole("button", { name: "Dodaj wydatek", exact: true }).click();
  await expenseDialog(page, "add").getByLabel("Kategoria").selectOption({ label: "Zakupy spożywcze" });
  await expenseDialog(page, "add").getByLabel("Kwota").fill("30.00");
  await expenseDialog(page, "add").getByLabel("Data").fill(lastMonth);
  await expenseDialog(page, "add").getByRole("button", { name: "Dodaj wydatek" }).click();
  await expect(page.getByText(lastMonth)).toBeVisible();

  await page.getByRole("main").getByRole("button", { name: "Dodaj wydatek", exact: true }).click();
  await expenseDialog(page, "add").getByLabel("Kategoria").selectOption({ label: "Mieszkanie" });
  await expenseDialog(page, "add").getByLabel("Kwota").fill("80.00");
  await expenseDialog(page, "add").getByLabel("Data").fill(lastMonth);
  await expenseDialog(page, "add").getByRole("button", { name: "Dodaj wydatek" }).click();

  await page.getByRole("main").getByRole("button", { name: "Dodaj wydatek", exact: true }).click();
  await expenseDialog(page, "add").getByLabel("Kategoria").selectOption({ label: "Transport" });
  await expenseDialog(page, "add").getByLabel("Kwota").fill("20.00");
  await expenseDialog(page, "add").getByRole("button", { name: "Dodaj wydatek" }).click();

  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard$/);

  // Total: current 70 (Zakupy spożywcze 50 + Transport 20) vs previous 110
  // (Zakupy spożywcze 30 + Mieszkanie 80) — a decrease, rendered green with a down
  // arrow and an explicit sign, never color alone.
  await expect(page.getByText("↓ 36% (-40,00 USD) względem poprzedniego miesiąca")).toBeVisible();

  // Changed: Zakupy spożywcze increased 30 -> 50 (+67%), rendered red with an up arrow.
  await expect(summaryRowFor(page, "Zakupy spożywcze")).toContainText("50,00 USD");
  await expect(summaryRowFor(page, "Zakupy spożywcze")).toContainText("↑ 67% (+20,00 USD)");

  // New: Transport had no previous-month spend — tagged "nowa", no percentage.
  await expect(summaryRowFor(page, "Transport")).toContainText("20,00 USD");
  await expect(summaryRowFor(page, "Transport")).toContainText("nowa");
  await expect(summaryRowFor(page, "Transport")).not.toContainText("%");

  // Dropped: Mieszkanie had spend last month but none this month — still gets a
  // row, showing the decrease to 0.
  await expect(summaryRowFor(page, "Mieszkanie")).toContainText("0,00 USD");
  await expect(summaryRowFor(page, "Mieszkanie")).toContainText("↓ 100% (-80,00 USD)");
});
