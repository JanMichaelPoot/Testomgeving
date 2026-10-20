import { describe, expect, it } from "vitest";
import { displayPlace } from "@/lib/place";

describe("displayPlace", () => {
  it("drops the repeated municipality name", () => {
    expect(displayPlace("Laren, Laren, Noord-Holland")).toBe("Laren, Noord-Holland");
    expect(displayPlace("Utrecht, Utrecht")).toBe("Utrecht");
  });

  it("ignores case, accents and stray spaces when comparing", () => {
    expect(displayPlace("Den  Haag, den haag, Zuid-Holland")).toBe("Den Haag, Zuid-Holland");
    expect(displayPlace("Genève,Geneve")).toBe("Genève");
  });

  it("leaves a place without repeats exactly as it is", () => {
    expect(displayPlace("Gemeente Utrecht")).toBe("Gemeente Utrecht");
    expect(displayPlace("Laren, Noord-Holland")).toBe("Laren, Noord-Holland");
    expect(displayPlace("Laren")).toBe("Laren");
  });

  it("copes with nothing", () => {
    expect(displayPlace("")).toBe("");
    expect(displayPlace(null)).toBe("");
    expect(displayPlace(undefined)).toBe("");
    expect(displayPlace(" , ,")).toBe("");
  });
});
