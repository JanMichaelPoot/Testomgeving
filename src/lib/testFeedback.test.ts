import { describe, expect, it } from "vitest";
import { cleanTestFeedback, DOUBT_MAX, feedbackDoorsFor, feedbackLink, testFeedbackEnabled } from "./testFeedback";

describe("test feedback", () => {
  it("is on for 1 and the usual ways of writing a switch, off for everything else", () => {
    for (const on of ["1", " 1 ", '"1"', "'1'", "true", "TRUE", "yes", "on"]) expect(testFeedbackEnabled(on)).toBe(true);
    for (const off of [undefined, "", "0", "false", "off", "no", "2", "enabled"]) expect(testFeedbackEnabled(off)).toBe(false);
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
  it("keeps the places score and the e-mail answer, and drops values outside the scale", () => {
    expect(cleanTestFeedback({ placesScore: 2, mailStatus: "spam" })).toMatchObject({ placesScore: 2, mailStatus: "spam", flowScore: null });
    expect(cleanTestFeedback({ mailStatus: "missing" })).toMatchObject({ mailStatus: "missing", placesScore: null });
    expect(cleanTestFeedback({ placesScore: 6, mailStatus: "later" as never })).toBeNull();
  });
  it("caps the free text", () => {
    expect(cleanTestFeedback({ doubt: "x".repeat(DOUBT_MAX + 50) })!.doubt).toHaveLength(DOUBT_MAX);
  });
});

describe("the questionnaire in the e-mail (Jan, 14 Nov 2026)", () => {
  const id = "6f1c2d3e-0000-4000-8000-000000000001";

  it("links to the page of the book while the questionnaire is on, and to nothing when it is off", () => {
    expect(feedbackLink("https://windowinto.nl", id, "1")).toBe(`https://windowinto.nl/feedback/${id}?utm_source=window_mail&utm_medium=email`);
    expect(feedbackLink("https://windowinto.nl", id, "0")).toBeNull();
    expect(feedbackLink("https://windowinto.nl", id, undefined)).toBeNull();
  });

  it("numbers the doors the way the book shows them, the wildcard last, and keeps only a known kind", () => {
    const doors = feedbackDoorsFor([{ door: "natural", title: "A" }, { door: "stretch", title: "B" }, { door: "bogus", title: "C" }], { title: "W" });
    expect(doors).toEqual([
      { number: 1, kind: "natural", title: "A" },
      { number: 2, kind: "stretch", title: "B" },
      { number: 3, kind: "natural", title: "C" },
      { number: 4, kind: "wildcard", title: "W" },
    ]);
    expect(feedbackDoorsFor([{ door: "natural", title: "A" }], null)).toHaveLength(1);
  });
});
