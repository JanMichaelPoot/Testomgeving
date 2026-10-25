import { describe, expect, it } from "vitest";
import { displayPlace } from "@/lib/place";

describe("displayPlace", () => {
  it("drops the repeated municipality name", () => {
    expect(displayPlace("Laren, Laren, Noord-Holland")).toBe("Laren, Noord-Holland");
    expect(displayPlace("Utrecht, Utrecht")).toBe("Utrecht");
    expect(displayPlace("Gemeente Utrecht")).toBe("Utrecht");
    expect(displayPlace("Gemeente Groningen, Groningen")).toBe("Groningen");
  });

  it("ignores case, accents and stray spaces when comparing", () => {
    expect(displayPlace("Den  Haag, den haag, Zuid-Holland")).toBe("Den Haag, Zuid-Holland");
    expect(displayPlace("Genève,Geneve")).toBe("Genève");
  });

  it("leaves a place without repeats exactly as it is", () => {
    expect(displayPlace("Utrecht, Noord-Holland")).toBe("Utrecht, Noord-Holland");
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

import { shortPlace } from "@/lib/place";

describe("shortPlace", () => {
  it("keeps the first part and drops 'Gemeente' and friends", () => {
    expect(shortPlace("Laren, Laren, Noord-Holland")).toBe("Laren");
    expect(shortPlace("Gemeente Utrecht")).toBe("Utrecht");
    expect(shortPlace("Provincie Zeeland")).toBe("Zeeland");
    expect(shortPlace("")).toBe("");
    expect(shortPlace(undefined)).toBe("");
  });
});
