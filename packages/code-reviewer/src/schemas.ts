/**
 * @10x/code-reviewer — structured review schemas.
 *
 * Zod schemas describing a structured code-review result, plus the types
 * inferred from them. Kept free of any model/agent dependency so they can be
 * imported by the agent and, later, by evals in isolation.
 */

import { z } from "zod";

/** Severity levels for an individual review finding, most to least severe. */
export const severitySchema = z.enum(["critical", "high", "medium", "low", "info"]);

/** A single issue surfaced by the reviewer. */
export const reviewFindingSchema = z.object({
  severity: severitySchema,
  title: z.string().describe("Short, specific summary of the issue"),
  detail: z.string().describe("What is wrong and why it matters"),
  file: z.string().optional().describe("File the finding refers to, if known"),
  line: z.number().optional().describe("1-based, positive integer line number the finding refers to, if known"),
  suggestion: z.string().optional().describe("Concrete fix or improvement"),
});

/** The full structured result of a review. */
export const reviewResultSchema = z.object({
  summary: z.string().describe("One-paragraph overall assessment"),
  findings: z.array(reviewFindingSchema).describe("Findings, most severe first"),
});

export type Severity = z.infer<typeof severitySchema>;
export type ReviewFinding = z.infer<typeof reviewFindingSchema>;
export type ReviewResult = z.infer<typeof reviewResultSchema>;

/**
 * The six scored criteria for a pull-request review. Kept as its own enum so
 * `notes[].criterion` stays in sync with the `scores` object's keys.
 */
export const reviewCriterionSchema = z.enum([
  "correctness",
  "idiomaticity",
  "complexity",
  "testRiskCoverage",
  "documentation",
  "security",
]);

/**
 * A single 1–10 criterion score, integer only.
 *
 * Bounds are enforced via `.refine()` rather than `.min()`/`.max()`: those
 * chain methods emit `minimum`/`maximum` JSON Schema keywords, which
 * Anthropic's structured-output mode (used here via OpenRouter) rejects for
 * `type: "integer"` properties. `.refine()` still validates fully at
 * runtime — it just isn't representable in the JSON Schema sent to the model.
 */
const criterionScoreSchema = z.number().refine((value) => Number.isInteger(value) && value >= 1 && value <= 10, {
  message: "must be an integer between 1 and 10",
});

/** The full structured result of a scored pull-request review. */
export const scoredReviewSchema = z.object({
  summary: z.string().describe("One-paragraph overall assessment of the pull request"),
  scores: z.object({
    correctness: criterionScoreSchema.describe(
      "Implementation correctness: does the code do what it claims, handling edge cases, error paths, and boundary conditions without introducing regressions?",
    ),
    idiomaticity: criterionScoreSchema.describe(
      "Idiomaticity: does the code follow the language, framework, and project conventions rather than fighting them?",
    ),
    complexity: criterionScoreSchema.describe(
      "Complexity: is the solution as simple as the problem allows, without needless abstraction or convolution?",
    ),
    testRiskCoverage: criterionScoreSchema.describe(
      "Test/risk coverage: are the change's risky paths exercised by tests proportionate to their blast radius?",
    ),
    documentation: criterionScoreSchema.describe(
      "Documentation: are non-obvious decisions, public interfaces, and usage explained where a reader would need them?",
    ),
    security: criterionScoreSchema.describe(
      "Security and safety: does the change avoid introducing vulnerabilities and handle untrusted input, secrets, and permissions responsibly?",
    ),
  }),
  notes: z
    .array(
      z.object({
        criterion: reviewCriterionSchema,
        comment: z.string().describe("Short rationale for this criterion's score"),
      }),
    )
    .describe("Per-criterion rationale, most important first"),
});

export type ReviewCriterion = z.infer<typeof reviewCriterionSchema>;
export type ScoredReview = z.infer<typeof scoredReviewSchema>;
