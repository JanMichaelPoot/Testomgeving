import { describe, expect, it } from "vitest";
import { showVensterLanding } from "./vensterLanding";

describe("showVensterLanding", () => {
  it("is off by default and below 100%", () => {
    expect(showVensterLanding(undefined, undefined)).toBe(false);
    expect(showVensterLanding("", undefined)).toBe(false);
    expect(showVensterLanding("50", undefined)).toBe(false);
    expect(showVensterLanding("abc", undefined)).toBe(false);
  });
  it("is on at 100% or with ?venster=1", () => {
    expect(showVensterLanding("100", undefined)).toBe(true);
    expect(showVensterLanding("0", "1")).toBe(true);
    expect(showVensterLanding(undefined, ["1"])).toBe(true);
    expect(showVensterLanding(undefined, "0")).toBe(false);
  });
});
