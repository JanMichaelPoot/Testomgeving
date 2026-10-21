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
    expect(cleanTestFeedback({ profileScore: 0, doorsScore: 6, doorPick: 8, doorKind: "bogus" as never })).toBeNull();
    expect(cleanTestFeedback({ flowScore: 4 })).toMatchObject({ flowScore: 4, wouldPay: null, doubt: "" });
    expect(cleanTestFeedback({ wouldPay: "maybe", doubt: " de prijs " })).toMatchObject({ flowScore: null, wouldPay: "maybe", doubt: "de prijs" });
  });

  it("keeps the R2.4 answers: two scores and a door", () => {
    expect(cleanTestFeedback({ profileScore: 4, doorsScore: 2 })).toMatchObject({ profileScore: 4, doorsScore: 2, doorPick: null, doorKind: null });
    expect(cleanTestFeedback({ doorPick: 3, doorKind: "unexpected" })).toMatchObject({ doorPick: 3, doorKind: "unexpected" });
  });

  it("counts 'none of these' (0) as an answer, and keeps no door kind with it", () => {
    expect(cleanTestFeedback({ doorPick: 0, doorKind: "natural" })).toMatchObject({ doorPick: 0, doorKind: null });
    expect(cleanTestFeedback({ doorPick: 7, doorKind: "wildcard" })).toMatchObject({ doorPick: 7, doorKind: "wildcard" });
  });

  it("never carries a title: the pick is a number and the kind is one of five fixed words", () => {
    const out = cleanTestFeedback({ doorPick: 2, doorKind: "Pottenbakken zoals je stiekem wilde" as never, doubt: "x" })!;
    expect(out.doorKind).toBeNull();
    expect(typeof out.doorPick).toBe("number");
  });
  it("caps the free text", () => {
    expect(cleanTestFeedback({ doubt: "x".repeat(DOUBT_MAX + 50) })!.doubt).toHaveLength(DOUBT_MAX);
  });
});
