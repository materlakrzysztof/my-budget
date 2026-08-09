import { describe, expect, it, vi } from "vitest";
import type { LanguageModel } from "ai";

const generateTextMock = vi.fn<(...args: unknown[]) => Promise<unknown>>();

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return {
    ...actual,
    generateText: (...args: unknown[]) => generateTextMock(...args),
  };
});

const { AiParseError, parseExpensesFromText } = await import("./expense-ai-parser");

const fakeModel = {} as LanguageModel;

describe("parseExpensesFromText", () => {
  const categories = [
    { id: "cat-1", name: "Groceries" },
    { id: "cat-2", name: "Transport" },
  ];

  it("maps a successful model response to ParsedExpenseDraft[] with normalized amounts", async () => {
    generateTextMock.mockResolvedValueOnce({
      output: [
        { description: "Lidl", amount: 200, categoryId: "cat-1" },
        { description: "Orlen", amount: 150.5, categoryId: null },
      ],
    });

    const result = await parseExpensesFromText(fakeModel, "lidl 200zł, orlen 150.5zł", categories);

    expect(result).toEqual([
      { description: "Lidl", amount: "200.00", categoryId: "cat-1", categoryName: "Groceries" },
      { description: "Orlen", amount: "150.50", categoryId: null, categoryName: null },
    ]);
  });

  it("passes the given model through to generateText", async () => {
    generateTextMock.mockResolvedValueOnce({ output: [] });
    await parseExpensesFromText(fakeModel, "text", categories);
    expect(generateTextMock).toHaveBeenCalledWith(expect.objectContaining({ model: fakeModel }));
  });

  it("rejects a categoryId that isn't one of the user's categories (dynamic enum)", async () => {
    generateTextMock.mockResolvedValueOnce({
      output: [{ description: "Mystery", amount: 10, categoryId: "cat-unknown" }],
    });

    await expect(parseExpensesFromText(fakeModel, "text", categories)).rejects.toBeInstanceOf(AiParseError);
  });

  it("allows a null categoryId even when categories exist", async () => {
    generateTextMock.mockResolvedValueOnce({
      output: [{ description: "Unknown item", amount: 10, categoryId: null }],
    });

    const result = await parseExpensesFromText(fakeModel, "text", categories);
    expect(result[0].categoryId).toBeNull();
    expect(result[0].categoryName).toBeNull();
  });

  it("rejects a non-null categoryId when the user has no categories yet", async () => {
    generateTextMock.mockResolvedValueOnce({
      output: [{ description: "Item", amount: 10, categoryId: "cat-1" }],
    });

    await expect(parseExpensesFromText(fakeModel, "text", [])).rejects.toBeInstanceOf(AiParseError);
  });

  it("rejects a batch larger than the 20-item cap", async () => {
    const output = Array.from({ length: 21 }, (_, i) => ({
      description: `item ${i}`,
      amount: 1,
      categoryId: null,
    }));
    generateTextMock.mockResolvedValueOnce({ output });

    await expect(parseExpensesFromText(fakeModel, "text", categories)).rejects.toBeInstanceOf(AiParseError);
  });

  it("wraps a model/provider failure as AiParseError", async () => {
    generateTextMock.mockRejectedValueOnce(new Error("model failed to produce valid output"));

    await expect(parseExpensesFromText(fakeModel, "text", categories)).rejects.toBeInstanceOf(AiParseError);
  });
});

describe("AiParseError", () => {
  it("has a stable name and user-facing message", () => {
    const error = new AiParseError();
    expect(error.name).toBe("AiParseError");
    expect(error.message).toBe("Nie udało się przeanalizować tekstu. Spróbuj ponownie lub użyj formularza.");
  });

  it("carries the original error as its cause when provided", () => {
    const original = new Error("boom");
    const error = new AiParseError(original);
    expect(error.cause).toBe(original);
  });
});
