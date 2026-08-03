import { describe, expect, it } from "vitest";
import { plural, t } from "./index";

describe("t", () => {
  it("resolves a known key to its Polish string", () => {
    expect(t("meta.defaultTitle")).toBe("MyBudget");
  });

  it("interpolates a placeholder", () => {
    expect(t("common.requiredField", { field: "Nazwa" })).toBe("Nazwa jest wymagane");
  });
});

describe("plural", () => {
  const variants = {
    one: "{count} wydatek",
    few: "{count} wydatki",
    many: "{count} wydatków",
    other: "{count} wydatku",
  };

  it("selects the 'one' form for 1", () => {
    expect(plural(1, variants)).toBe("1 wydatek");
  });

  it("selects the 'few' form for 3", () => {
    expect(plural(3, variants)).toBe("3 wydatki");
  });

  it("selects the 'many' form for 5", () => {
    expect(plural(5, variants)).toBe("5 wydatków");
  });
});
