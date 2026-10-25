import { describe, expect, it } from "vitest";
import { detectLocale, freeWord } from "@/lib/locale";

describe("detectLocale", () => {
  it("starts in Dutch in the Netherlands and Belgium, whatever the browser says", () => {
    expect(detectLocale({ country: "NL", acceptLanguage: "en-US,en;q=0.9" })).toBe("nl");
    expect(detectLocale({ country: "be", acceptLanguage: "fr-BE" })).toBe("nl");
  });

  it("starts in English in other countries", () => {
    expect(detectLocale({ country: "US", acceptLanguage: "en-US" })).toBe("en");
    expect(detectLocale({ country: "DE", acceptLanguage: "de-DE,de;q=0.9" })).toBe("en");
    expect(detectLocale({ country: "ES" })).toBe("en");
  });

  it("keeps Dutch for a Dutch-speaking visitor abroad (the browser prefers Dutch)", () => {
    expect(detectLocale({ country: "ES", acceptLanguage: "nl-NL,nl;q=0.9,en;q=0.8" })).toBe("nl");
    expect(detectLocale({ country: "ES", acceptLanguage: "en-US,nl;q=0.8" })).toBe("en");
  });

  it("falls back to the browser's language without a country, and to Dutch without anything", () => {
    expect(detectLocale({ acceptLanguage: "nl-NL,nl;q=0.9" })).toBe("nl");
    expect(detectLocale({ acceptLanguage: "en-GB,en;q=0.9" })).toBe("en");
    expect(detectLocale({ country: "XX", acceptLanguage: "en" })).toBe("en");
    expect(detectLocale({})).toBe("nl");
  });
});

describe("freeWord", () => {
  it("is the word for no cost in the book's language", () => {
    expect(freeWord("nl")).toBe("Gratis");
    expect(freeWord("en")).toBe("Free");
  });
});
