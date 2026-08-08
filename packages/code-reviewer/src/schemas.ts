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
