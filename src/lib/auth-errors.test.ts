import { describe, expect, it } from "vitest";
import { translateAuthError } from "@/lib/auth-errors";

describe("translateAuthError", () => {
  it("maps a known Supabase message to its specific Polish string", () => {
    expect(translateAuthError("Invalid login credentials")).toBe("Nieprawidłowy adres e-mail lub hasło.");
    expect(translateAuthError("User already registered")).toBe("Użytkownik o tym adresie e-mail już istnieje.");
    expect(translateAuthError("Email not confirmed")).toBe("Adres e-mail nie został potwierdzony.");
  });

  it("falls back to the generic Polish message for an unmatched message", () => {
    expect(translateAuthError("Some unexpected Supabase wording change")).toBe("Wystąpił błąd. Spróbuj ponownie.");
  });

  it("never returns a raw English string", () => {
    const englishPattern = /^[A-Za-z0-9 .,!?'"()-]+$/;
    expect(translateAuthError("Invalid login credentials")).not.toMatch(englishPattern);
    expect(translateAuthError("totally unknown message")).not.toMatch(englishPattern);
  });
});
