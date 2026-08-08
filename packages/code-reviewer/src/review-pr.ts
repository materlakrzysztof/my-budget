/**
 * @10x/code-reviewer — CI-facing PR scoring entrypoint.
 *
 * A thin, runnable script the composite action calls: reads PR title, body,
 * and diff (diff via file path, not argv, so large diffs are safe) from the
 * environment, calls `reviewPullRequest`, and prints the resulting
 * `ScoredReview` as JSON on stdout. Exits non-zero only on a transport or
 * schema-validation error — a low score is not a failure here, the
 * deterministic gate (composite action) owns pass/fail.
 *
 * Env vars:
 *   PR_TITLE      (required) — the pull request title.
 *   PR_DIFF_FILE  (required) — path to a file containing the unified diff.
 *   PR_BODY       (optional) — the pull request description.
 */

import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import process from "node:process";

import { reviewPullRequest } from "./agent.ts";

async function main(): Promise<void> {
  const prTitle = process.env.PR_TITLE;
  const prDiffFile = process.env.PR_DIFF_FILE;

  if (!prTitle || !prDiffFile) {
    // eslint-disable-next-line no-console
    console.error("PR_TITLE and PR_DIFF_FILE environment variables are required.");
    process.exitCode = 1;
    return;
  }

  const diff = readFileSync(prDiffFile, "utf8");
  // An empty PR_BODY (not just unset) should also read as "no description".
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
  const prBody = process.env.PR_BODY || undefined;

  const result = await reviewPullRequest({ prTitle, prBody, diff });

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(result));
}

// Run only when invoked directly, not when imported as a module.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error: unknown) => {
    // eslint-disable-next-line no-console
    console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
    process.exitCode = 1;
  });
}
