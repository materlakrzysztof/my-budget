import { describe, expect, it } from "vitest";

import { buildPullRequestReviewPrompt } from "./prompts.ts";

describe("buildPullRequestReviewPrompt", () => {
  it("includes the title, body, and diff", () => {
    const prompt = buildPullRequestReviewPrompt({
      prTitle: "Add expense filtering",
      prBody: "Adds a category filter to the expenses list.",
      diff: "diff --git a/src/lib/services/expenses.ts b/src/lib/services/expenses.ts",
    });

    expect(prompt).toContain("Add expense filtering");
    expect(prompt).toContain("Adds a category filter to the expenses list.");
    expect(prompt).toContain("diff --git a/src/lib/services/expenses.ts b/src/lib/services/expenses.ts");
  });

  it("omits the body section cleanly when absent", () => {
    const prompt = buildPullRequestReviewPrompt({
      prTitle: "Fix typo",
      diff: "diff --git a/README.md b/README.md",
    });

    expect(prompt).toContain("Fix typo");
    expect(prompt).not.toContain("Description:");
    expect(prompt).toContain("diff --git a/README.md b/README.md");
  });
});
