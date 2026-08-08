/**
 * @10x/code-reviewer — review prompts.
 *
 * The reviewer's system instructions and prompt builder, kept as first-class,
 * swappable values so callers (and future prompt A/B evals) can override the
 * instruction text without editing agent code. No dependency on `ai` or the
 * model.
 */

/** Input describing the code to review. */
export interface ReviewCodeInput {
  /** The source code to review. */
  code: string;
  /** Optional filename, used for context and finding attribution. */
  filename?: string;
  /** Optional language hint (e.g. "typescript"). */
  language?: string;
  /** Optional extra instructions to focus the review. */
  instructions?: string;
}

/** Default system instructions steering the reviewer's focus and output. */
export const REVIEW_INSTRUCTIONS =
  "You are a meticulous senior software engineer performing a focused code review. " +
  "Prioritise correctness bugs, security issues, and unsafe assumptions, then clear " +
  "simplifications. Be concise and specific, and cite line numbers where possible. " +
  "If the code looks correct, return an empty findings array with a brief summary.";

/** Build the user prompt for a single review from the input description. */
export function buildReviewPrompt(input: ReviewCodeInput): string {
  const header = [
    input.filename ? `File: ${input.filename}` : undefined,
    input.language ? `Language: ${input.language}` : undefined,
    input.instructions ? `Reviewer instructions: ${input.instructions}` : undefined,
  ]
    .filter(Boolean)
    .join("\n");

  const fence = input.language ?? "";
  return `${header ? header + "\n\n" : ""}Review the following code:\n\n\`\`\`${fence}\n${input.code}\n\`\`\``;
}
