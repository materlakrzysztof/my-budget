#!/usr/bin/env node
// Deterministic PASS/FAIL gate: every criterion must be >= the floor.
// No model involvement — the AI step only produced data, this decides.
import { readFileSync, appendFileSync } from "node:fs";

const reviewFile = process.env.REVIEW_FILE;
const floor = Number(process.env.CRITERION_FLOOR);
const outputFile = process.env.GITHUB_OUTPUT;

const review = JSON.parse(readFileSync(reviewFile, "utf8"));
const failing = Object.entries(review.scores)
  .filter(([, score]) => score < floor)
  .map(([criterion]) => criterion);
const verdict = failing.length === 0 ? "PASS" : "FAIL";

appendFileSync(outputFile, `verdict=${verdict}\n`);
appendFileSync(outputFile, `failing-criteria=${failing.join(",")}\n`);

console.log(`Verdict: ${verdict}${failing.length ? ` (below floor ${floor}: ${failing.join(", ")})` : ""}`);
