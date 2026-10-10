import { describe, expect, it } from "vitest";
import { cleanTestFeedback, DOUBT_MAX, testFeedbackEnabled } from "./testFeedback";

describe("test feedback", () => {
  it("is only on with exactly 1", () => {
    expect(testFeedbackEnabled("1")).toBe(true);
    expect(testFeedbackEnabled(undefined)).toBe(false);
    expect(testFeedbackEnabled("true")).toBe(false);
  });
  it("drops invalid values and empty submissions", () => {
    expect(cleanTestFeedback({ flowScore: 9, wouldPay: "sure" as never, doubt: "  " })).toBeNull();
    expect(cleanTestFeedback({ flowScore: 4 })).toEqual({ flowScore: 4, wouldPay: null, doubt: "" });
    expect(cleanTestFeedback({ wouldPay: "maybe", doubt: " de prijs " })).toEqual({ flowScore: null, wouldPay: "maybe", doubt: "de prijs" });
  });
  it("caps the free text", () => {
    expect(cleanTestFeedback({ doubt: "x".repeat(DOUBT_MAX + 50) })!.doubt).toHaveLength(DOUBT_MAX);
  });
});
