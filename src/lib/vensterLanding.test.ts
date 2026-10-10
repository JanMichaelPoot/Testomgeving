import { describe, expect, it } from "vitest";
import { associationWizardPercent, showVensterLanding } from "./vensterLanding";

describe("showVensterLanding", () => {
  it("is on by default, also when the variable is empty or not a number", () => {
    expect(showVensterLanding(undefined, undefined)).toBe(true);
    expect(showVensterLanding("", undefined)).toBe(true);
    expect(showVensterLanding("abc", undefined)).toBe(true);
    expect(showVensterLanding("100", undefined)).toBe(true);
  });
  it("is off when switched off or below 100%, unless ?venster=1", () => {
    expect(showVensterLanding("0", undefined)).toBe(false);
    expect(showVensterLanding("50", undefined)).toBe(false);
    expect(showVensterLanding("0", "1")).toBe(true);
    expect(showVensterLanding("50", ["1"])).toBe(true);
    expect(showVensterLanding("0", "0")).toBe(false);
  });
});

describe("associationWizardPercent", () => {
  it("defaults to everybody and honours an explicit value", () => {
    expect(associationWizardPercent(undefined)).toBe(100);
    expect(associationWizardPercent(" ")).toBe(100);
    expect(associationWizardPercent("0")).toBe(0);
    expect(associationWizardPercent("25")).toBe(25);
  });
});
