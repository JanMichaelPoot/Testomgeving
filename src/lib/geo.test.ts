import { describe, expect, it } from "vitest";
import { geoHintFrom } from "@/lib/geo";
import { COUNTRY_CODES, countryName, countryOptions, normalizeCountry } from "@/lib/countries";

describe("geo hint", () => {
  it("reads the country and the (percent-encoded) city", () => {
    expect(geoHintFrom("NL", "Den%20Haag")).toEqual({ country: "NL", city: "Den Haag" });
    expect(geoHintFrom("fr", "Lyon")).toEqual({ country: "FR", city: "Lyon" });
  });
  it("gives no hint without a real country, and drops a broken city", () => {
    expect(geoHintFrom(null, "Utrecht")).toBeNull();
    expect(geoHintFrom("XX", "Utrecht")).toBeNull();
    expect(geoHintFrom("NL", "%E0%A4%A")?.country).toBe("NL");
    expect(geoHintFrom("NL", undefined)).toEqual({ country: "NL", city: "" });
  });
});

describe("countries", () => {
  it("lists every country once, with a name in both languages", () => {
    expect(new Set(COUNTRY_CODES).size).toBe(COUNTRY_CODES.length);
    expect(COUNTRY_CODES.length).toBeGreaterThanOrEqual(245);
    expect(countryName("NL", "nl")).toBe("Nederland");
    expect(countryName("DE", "en")).toBe("Germany");
    const names = countryOptions("nl").map((c) => c.name);
    expect(names.every((n) => n.length > 2)).toBe(true);
  });
  it("accepts only real codes", () => {
    expect(normalizeCountry("nl")).toBe("NL");
    expect(normalizeCountry("ZZ")).toBeNull();
    expect(normalizeCountry(5)).toBeNull();
  });
});
