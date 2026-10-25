import { describe, expect, it } from "vitest";
import { activityIdsOf, feedbackSummary, intakeSummary, median, overview, readScore, scoreSummary, topCounts, type FeedbackRow, type PaymentRow, type PlanRow } from "@/lib/adminStats";
import { csvCell } from "@/lib/csv";

const NOW = new Date("2026-10-25T12:00:00Z");
const plan = (over: Partial<PlanRow>): PlanRow => ({
  id: "p",
  created_at: "2026-10-25T10:00:00Z",
  generated_at: "2026-10-25T10:01:30Z",
  status: "ready",
  language: "nl",
  email_sent_at: null,
  payment_id: null,
  pdf_version: 6,
  progress_meta: null,
  ideas_json: [],
  wildcard_json: {},
  feedback_json: {},
  committed_idea_key: null,
  ...over,
});
const pay = (over: Partial<PaymentRow>): PaymentRow => ({ id: "x", status: "succeeded", amount: 350, currency: "eur", created_at: "2026-10-25T10:00:00Z", ...over });

describe("overview", () => {
  it("counts books, languages, the typical duration and the revenue of succeeded payments only", () => {
    const o = overview(
      [plan({ id: "a" }), plan({ id: "b", language: "en", payment_id: "x", email_sent_at: "2026-10-25T10:02:00Z" }), plan({ id: "c", status: "failed" })],
      [pay({ id: "x" }), pay({ id: "y", status: "pending" })],
      NOW,
    );
    expect(o.ready).toBe(2);
    expect(o.failed).toBe(1);
    expect(o.paidReady).toBe(1);
    expect(o.testReady).toBe(1);
    expect(o.languages).toEqual({ nl: 1, en: 1 });
    expect(o.medianSeconds).toBe(90);
    expect(o.payments.revenueCents).toBe(350);
    expect(o.payments.pending).toBe(1);
    expect(o.email).toMatchObject({ sent: 1, expected: 1 });
    expect(o.perDay).toHaveLength(14);
    expect(o.perDay.at(-1)).toEqual({ day: "2026-10-25", count: 2 });
  });

  it("raises the alarm for a stuck generation, a failed one and a paid book that never got its e-mail", () => {
    const o = overview(
      [
        plan({ id: "stuck", status: "pending", created_at: "2026-10-25T11:00:00Z", generated_at: null }),
        plan({ id: "fresh", status: "pending", created_at: "2026-10-25T11:58:00Z", generated_at: null }),
        plan({ id: "nomail", payment_id: "x", progress_meta: { email_error: "Missing API key" } }),
      ],
      [],
      NOW,
    );
    expect(o.stuck).toBe(1);
    expect(o.attention.filter((a) => a.level === "red")).toHaveLength(2);
    expect(o.email.errors[0].message).toBe("Missing API key");
  });

  it("counts a book as engaged when an idea has a heart or one was chosen", () => {
    const o = overview([plan({ feedback_json: { "idea:1": "up" } }), plan({ committed_idea_key: "idea:2" }), plan({ feedback_json: { "idea:1": "down" } })], [], NOW);
    expect(o.engagement).toEqual({ liked: 1, committed: 1, ready: 3 });
  });
});

describe("feedback", () => {
  const row = (over: Partial<FeedbackRow>): FeedbackRow => ({ id: "f", flow_score: null, profile_score: null, doors_score: null, door_pick: null, door_kind: null, would_pay: null, doubt: null, locale: "nl", created_at: "2026-10-25T10:00:00Z", ...over });

  it("averages and distributes a 1-5 score and ignores empty answers", () => {
    const s = scoreSummary([5, 4, 4, null, 1]);
    expect(s.n).toBe(4);
    expect(s.mean).toBeCloseTo(3.5);
    expect(s.distribution).toEqual([1, 0, 0, 2, 1]);
  });

  it("summarises payment intent with a maybe counting half, and finds the weakest question", () => {
    const s = feedbackSummary([
      row({ flow_score: 5, profile_score: 4, doors_score: 2, would_pay: "yes", door_kind: "natural", doubt: "Prijs?" }),
      row({ flow_score: 4, profile_score: 4, doors_score: 3, would_pay: "maybe", door_kind: "natural" }),
      row({ flow_score: 5, profile_score: 3, doors_score: 2, would_pay: "no", door_kind: "wildcard", doubt: "  " }),
    ]);
    expect(s.wouldPay).toEqual({ yes: 1, maybe: 1, no: 1, answered: 3 });
    expect(s.payScore).toBeCloseTo(0.5);
    expect(s.weakest).toMatch(/waarom je deze deuren/);
    expect(s.doorKinds[0]).toEqual(["natural", 2]);
    expect(s.doubts.map((d) => d.text)).toEqual(["Prijs?"]);
  });

  it("says plainly when there are too few answers to conclude anything", () => {
    expect(readScore(null, 0)).toBe("nog geen antwoorden");
    expect(readScore(4.8, 3)).toMatch(/te weinig/);
    expect(readScore(4.5, 10)).toBe("sterk");
    expect(readScore(2.5, 10)).toMatch(/zwak/);
  });
});

describe("content", () => {
  it("reads activity ids from a stored book, wildcard included", () => {
    expect(activityIdsOf({ ideas_json: [{ activity_id: "a" }, { title: "old book, no id" }], wildcard_json: { activity_id: "w" } })).toEqual(["a", "w"]);
  });

  it("counts what people filled in, without reading free text", () => {
    const s = intakeSummary([
      { raw_json: { interestDomains: ["nature", "food"], budget: "25", intakeVariant: "associations", recipientName: "Anna", situation: "iets prive" } },
      { raw_json: { interestDomains: ["nature"], budget: "25" } },
      { raw_json: null },
    ]);
    expect(s.total).toBe(3);
    expect(s.directions[0]).toEqual(["nature", 2]);
    expect(s.budget[0]).toEqual(["25", 2]);
    expect(s.gift).toBe(1);
    expect(JSON.stringify(s)).not.toContain("prive");
  });

  it("ranks, takes a median and neutralises spreadsheet formulas in a CSV", () => {
    expect(topCounts(["a", "b", "a", null])).toEqual([["a", 2], ["b", 1]]);
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(csvCell('say "hi", ok')).toBe('"say ""hi"", ok"');
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell(null)).toBe("");
  });
});
