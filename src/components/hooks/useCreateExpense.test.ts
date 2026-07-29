import { afterEach, describe, expect, it, vi } from "vitest";
import { useCreateExpense } from "./useCreateExpense";

function mockFetchResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

const validInput = { categoryId: "cat-1", name: null, amount: "10.00", date: "2020-01-01" };

describe("useCreateExpense", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok with the created expense on success", async () => {
    const expense = {
      id: "e1",
      categoryId: "cat-1",
      categoryName: "Groceries",
      name: null,
      amount: "10.00",
      date: "2020-01-01",
      createdAt: "2020-01-01T00:00:00Z",
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockFetchResponse(201, { expense })));

    const { createExpense } = useCreateExpense();
    const result = await createExpense(validInput);

    expect(result).toEqual({ ok: true, expense });
  });

  it("surfaces the server error on a 422 response", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          mockFetchResponse(422, { error: "Amount must be a positive number within the supported range." }),
        ),
    );

    const { createExpense } = useCreateExpense();
    const result = await createExpense(validInput);

    expect(result).toEqual({ ok: false, error: "Amount must be a positive number within the supported range." });
  });

  it("surfaces the server error on a 409 response", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(mockFetchResponse(409, { error: "The selected category does not belong to this user." })),
    );

    const { createExpense } = useCreateExpense();
    const result = await createExpense(validInput);

    expect(result).toEqual({ ok: false, error: "The selected category does not belong to this user." });
  });

  it("surfaces the server error on a 404 response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockFetchResponse(404, { error: "Not found." })));

    const { createExpense } = useCreateExpense();
    const result = await createExpense(validInput);

    expect(result).toEqual({ ok: false, error: "Not found." });
  });

  it("returns a generic fallback message on an unmapped non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockFetchResponse(500, {})));

    const { createExpense } = useCreateExpense();
    const result = await createExpense(validInput);

    expect(result).toEqual({ ok: false, error: "Failed to create expense. Please try again." });
  });
});
