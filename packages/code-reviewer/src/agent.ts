/**
 * @10x/code-reviewer — review agent.
 *
 * The reusable code-review agent built on the AI SDK's `ToolLoopAgent`, plus a
 * one-shot `reviewCode` convenience wrapper. Both are exported so callers — and
 * future promptfoo evals — can drive either the raw agent (inspect steps,
 * stream) or a single schema-validated call.
 *
 * The agent is tool-less today: with a structured `output` schema and no tools,
 * a single generation produces the validated review. The structure leaves room
 * to add a `tools` map later without reshaping callers.
 */

import { ToolLoopAgent, Output } from "ai";

import { createReviewModel } from "./model.ts";
import type { CodeReviewerConfig } from "./model.ts";
import { reviewResultSchema, scoredReviewSchema } from "./schemas.ts";
import type { ReviewResult, ScoredReview } from "./schemas.ts";
import { REVIEW_INSTRUCTIONS, buildReviewPrompt, PR_REVIEW_INSTRUCTIONS, buildPullRequestReviewPrompt } from "./prompts.ts";
import type { ReviewCodeInput, PullRequestReviewInput } from "./prompts.ts";

/** Config for the review agent: model options plus an optional instruction override. */
export interface ReviewAgentConfig extends CodeReviewerConfig {
  /** Override the default system instructions (e.g. for prompt A/B evals). */
  instructions?: string;
}

/**
 * Build a configured, reusable code-review agent. A fresh agent is created per
 * call so eval/test configs can be injected without shared mutable state.
 */
export function createReviewAgent(config: ReviewAgentConfig = {}) {
  return new ToolLoopAgent({
    model: createReviewModel(config),
    instructions: config.instructions ?? REVIEW_INSTRUCTIONS,
    output: Output.object({ schema: reviewResultSchema }),
  });
}

/**
 * Review a snippet of code and return a schema-validated structured result,
 * produced through a {@link createReviewAgent} agent.
 *
 * @example
 * const result = await reviewCode({ code, filename: "sum.ts", language: "typescript" });
 * console.log(result.summary, result.findings);
 */
export async function reviewCode(input: ReviewCodeInput, config: ReviewAgentConfig = {}): Promise<ReviewResult> {
  const agent = createReviewAgent(config);
  const { output } = await agent.generate({ prompt: buildReviewPrompt(input) });
  return output;
}

/**
 * Build a configured agent that scores a pull request against the six 1–10
 * criteria, produced through a fresh {@link ToolLoopAgent} with the scored
 * output schema.
 */
export function createPullRequestReviewAgent(config: ReviewAgentConfig = {}) {
  return new ToolLoopAgent({
    model: createReviewModel(config),
    instructions: config.instructions ?? PR_REVIEW_INSTRUCTIONS,
    output: Output.object({ schema: scoredReviewSchema }),
  });
}

/**
 * Score a pull request (title, body, diff) and return a schema-validated
 * {@link ScoredReview}, produced through a {@link createPullRequestReviewAgent}
 * agent.
 *
 * @example
 * const result = await reviewPullRequest({ prTitle, prBody, diff });
 * console.log(result.summary, result.scores);
 */
export async function reviewPullRequest(
  input: PullRequestReviewInput,
  config: ReviewAgentConfig = {},
): Promise<ScoredReview> {
  const agent = createPullRequestReviewAgent(config);
  const { output } = await agent.generate({ prompt: buildPullRequestReviewPrompt(input) });
  return output;
}
