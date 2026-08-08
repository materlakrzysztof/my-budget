import { describe, expect, it } from "vitest";

import { scoredReviewSchema } from "./schemas.ts";

const validScores = {
  correctness: 8,
  idiomaticity: 7,
  complexity: 9,
  testRiskCoverage: 6,
  documentation: 5,
  security: 10,
};

const validReview = {
  summary: "Solid change with minor gaps in test coverage.",
  scores: validScores,
  notes: [{ criterion: "testRiskCoverage", comment: "New service branch lacks a unit test." }],
};

describe("scoredReviewSchema", () => {
  it("accepts a valid scored review", () => {
    const result = scoredReviewSchema.safeParse(validReview);
    expect(result.success).toBe(true);
  });

  it("rejects a score below the 1-10 range", () => {
    const result = scoredReviewSchema.safeParse({
      ...validReview,
      scores: { ...validScores, correctness: 0 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a score above the 1-10 range", () => {
    const result = scoredReviewSchema.safeParse({
      ...validReview,
      scores: { ...validScores, security: 11 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-integer score", () => {
    const result = scoredReviewSchema.safeParse({
      ...validReview,
      scores: { ...validScores, complexity: 7.5 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a note with an unknown criterion", () => {
    const result = scoredReviewSchema.safeParse({
      ...validReview,
      notes: [{ criterion: "performance", comment: "not one of the six criteria" }],
    });
    expect(result.success).toBe(false);
  });
});
