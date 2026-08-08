#!/usr/bin/env node
// Render the PR comment body: hidden dedup marker, verdict, scores table,
// summary, and per-criterion notes.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const COMMENT_MARKER = "<!-- ai-code-review -->";

const CRITERION_LABELS = {
  correctness: "Correctness",
  idiomaticity: "Idiomaticity",
  complexity: "Complexity",
  testRiskCoverage: "Test/risk coverage",
  documentation: "Documentation",
  security: "Security & safety",
};

export function render(review, { verdict, floor, truncated }) {
  const rows = Object.entries(review.scores)
    .map(([criterion, score]) => `| ${CRITERION_LABELS[criterion] ?? criterion} | ${score} |`)
    .join("\n");

  const notes = (review.notes ?? [])
    .map((note) => `- **${CRITERION_LABELS[note.criterion] ?? note.criterion}**: ${note.comment}`)
    .join("\n");

  const verdictLine = verdict === "PASS" ? `PASS (floor: ${floor})` : `FAIL (floor: ${floor})`;

  const lines = [
    COMMENT_MARKER,
    `## AI Code Review — ${verdictLine}`,
    "",
    review.summary,
    "",
    "| Criterion | Score (1-10) |",
    "| --- | --- |",
    rows,
    "",
    "### Notes",
    notes || "_No notes provided._",
  ];

  if (truncated) {
    lines.push(
      "",
      "> The diff was truncated to fit the review's size budget; some changes may not have been assessed.",
    );
  }

  return lines.join("\n");
}

function main() {
  const review = JSON.parse(readFileSync(process.env.REVIEW_FILE, "utf8"));
  const body = render(review, {
    verdict: process.env.VERDICT,
    floor: process.env.CRITERION_FLOOR,
    truncated: process.env.DIFF_TRUNCATED === "true",
  });
  writeFileSync(process.env.COMMENT_FILE, body);
}

// Run only when invoked directly, so `render`/`COMMENT_MARKER` stay importable for tests.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
