// risk: category-expense-drilldown plan.md Phase 3 #3 — prd-v2.md US-01 /
// FR-003 drill-down + the reconciliation guardrail: clicking a category in
// the monthly summary must navigate to that category's filtered expense list,
// show only that category's expenses, and the filtered list's sum must
// reconcile exactly with the category's total in the summary.
// seed: tests/e2e/seed.spec.ts
import { test, expect } from "@playwright/test";
import { signUpAndSignIn, expenseDialog, summaryRowFor, expenseRowFor } from "./helpers";

function sumDollarAmounts(texts: string[]): number {
  return texts.reduce((acc, text) => {
    const match = /\$(\d+\.\d{2})/.exec(text);
    return acc + (match ? Number(match[1]) : 0);
  }, 0);
}

test("clicking a summary category drills into its filtered expenses and reconciles to its total", async ({ page }) => {
  const email = `e2e-drilldown-${Date.now()}@example.com`;
  const password = "TestPassword123!";

  await signUpAndSignIn(page, email, password);
  await page.goto("/expenses?action=add");
  await expect(page.getByRole("dialog", { name: "Add expense" })).toBeVisible();

  // Two Groceries expenses ($40 + $25 = $65) and one Transport ($15) — so the
  // Groceries filter must show exactly two rows that sum to its $65 total.
  await expenseDialog(page, "add").getByLabel("Category").selectOption({ label: "Groceries" });
  await expenseDialog(page, "add").getByLabel("Amount").fill("40.00");
  await expenseDialog(page, "add").getByRole("button", { name: "Add expense" }).click();
  await expect(expenseRowFor(page, "Groceries")).toHaveCount(1);

  await page.getByRole("button", { name: "Add expense", exact: true }).click();
  await expenseDialog(page, "add").getByLabel("Category").selectOption({ label: "Groceries" });
  await expenseDialog(page, "add").getByLabel("Amount").fill("25.00");
  await expenseDialog(page, "add").getByRole("button", { name: "Add expense" }).click();
  await expect(expenseRowFor(page, "Groceries")).toHaveCount(2);

  await page.getByRole("button", { name: "Add expense", exact: true }).click();
  await expenseDialog(page, "add").getByLabel("Category").selectOption({ label: "Transport" });
  await expenseDialog(page, "add").getByLabel("Amount").fill("15.00");
  await expenseDialog(page, "add").getByRole("button", { name: "Add expense" }).click();
  await expect(expenseRowFor(page, "Transport")).toHaveCount(1);

  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard$/);

  // The summary's Groceries total is the reconciliation reference.
  await expect(summaryRowFor(page, "Groceries")).toContainText("$65.00");
  const summaryText = (await summaryRowFor(page, "Groceries").textContent()) ?? "";
  const summaryTotal = Number(/\$(\d+\.\d{2})/.exec(summaryText)?.[1] ?? "0");

  // Drill down by clicking the Groceries summary row.
  await summaryRowFor(page, "Groceries").getByRole("link").click();
  await expect(page).toHaveURL(/\/expenses\?category=/);

  // Filtered view: picker preselected to the category, and only its expenses show.
  await expect(page.getByLabel("Filter by category")).toHaveValue(/.+/);
  await expect(expenseRowFor(page, "Groceries")).toHaveCount(2);
  await expect(expenseRowFor(page, "Transport")).toHaveCount(0);

  // Reconciliation guardrail: filtered rows' sum === the summary's category total.
  const filteredSum = sumDollarAmounts(await expenseRowFor(page, "Groceries").allTextContents());
  expect(filteredSum).toBeCloseTo(summaryTotal, 2);
  expect(filteredSum).toBeCloseTo(65, 2);

  // Clear filter returns to the full, unfiltered list.
  await page.getByLabel("Filter by category").selectOption({ label: "All categories" });
  await expect(page).toHaveURL(/\/expenses$/);
  await expect(page.getByLabel("Filter by category")).toHaveValue("");
  await expect(expenseRowFor(page, "Transport")).toHaveCount(1);
});
