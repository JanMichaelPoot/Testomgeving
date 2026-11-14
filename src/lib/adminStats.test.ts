import { describe, expect, it } from "vitest";
import { activityIdsOf, costOverview, describeBookCost, feedbackSummary, intakeSummary, median, overview, readScore, scoreSummary, topCounts, type FeedbackRow, type PaymentRow, type PlanRow } from "@/lib/adminStats";
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

  it("summarises the places score and the e-mail answers, and tolerates rows from before migration 0024", () => {
    const s = feedbackSummary([
      row({ flow_score: 5, doors_score: 5, places_score: 2, mail_status: "inbox" }),
      row({ flow_score: 5, doors_score: 5, places_score: 3, mail_status: "spam" }),
      row({ flow_score: 5, doors_score: 5 }),
    ]);
    expect(s.places.n).toBe(2);
    expect(s.places.mean).toBeCloseTo(2.5);
    expect(s.mail).toEqual({ inbox: 1, spam: 1, missing: 0, answered: 2 });
    expect(s.weakest).toMatch(/plekken/);
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
      { raw_json: { interestDomains: ["nature", "food"], budget: "25", intakeVariant: "associations", searchContext: "child", situation: "iets prive" } },
      { raw_json: { interestDomains: ["nature"], budget: "25" } },
      { raw_json: null },
    ]);
    expect(s.total).toBe(3);
    expect(s.directions[0]).toEqual(["nature", 2]);
    expect(s.budget[0]).toEqual(["25", 2]);
    expect(s.forOther).toBe(1);
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

describe("costOverview (Stap 195)", () => {
  const cost = (usd: number, extra: Record<string, unknown> = {}) => ({ usd, capUsd: 0.4, skipped: [] as string[], breakdown: { standard: usd / 2, writing: usd / 2 }, ...extra });
  const withCost = (id: string, c: ReturnType<typeof cost>, over: Partial<PlanRow> = {}) => plan({ id, progress_meta: { cost: c }, ...over });

  it("adds up the books that kept a cost: total, average, median, the highest and the average per kind", () => {
    const o = costOverview([withCost("a", cost(0.3)), withCost("b", cost(0.5)), withCost("c", cost(0.1))], NOW);
    expect(o.books).toBe(3);
    expect(o.totalUsd).toBeCloseTo(0.9, 6);
    expect(o.averageUsd).toBeCloseTo(0.3, 6);
    expect(o.medianUsd).toBe(0.3);
    expect(o.maxUsd).toBe(0.5);
    expect(o.perKind).toEqual([["standard", 0.15], ["writing", 0.15]].map(([k, v]) => [k, expect.closeTo(v as number, 6)]));
  });

  it("leaves out books from before the measurement, books that are not ready, and books older than the period", () => {
    const o = costOverview(
      [plan({ id: "old-format" }), withCost("failed", cost(9), { status: "failed" }), withCost("ancient", cost(9), { created_at: "2026-08-01T10:00:00Z" }), withCost("a", cost(0.2))],
      NOW,
    );
    expect(o.books).toBe(1);
    expect(o.totalUsd).toBeCloseTo(0.2, 6);
  });

  it("counts the books held to the cap, the books of the classic generation, the Google lookups and the share answered from the cache", () => {
    const o = costOverview(
      [
        withCost("a", cost(0.4, { skipped: ["broad"], placesLookups: 5, research: { cached: 2, searched: 6, failed: 0 } })),
        withCost("b", cost(0.1, { pipeline: "classic_after_failure", placesLookups: 3, research: { cached: 2, searched: 0, failed: 0 } })),
      ],
      NOW,
    );
    expect(o).toMatchObject({ cappedBooks: 1, classicBooks: 1, placesLookups: 8 });
    expect(o.cacheShare).toBeCloseTo(0.4, 6); // 4 of 10 answers from the cache
  });

  it("says nothing instead of inventing a number when no book kept a cost", () => {
    const o = costOverview([plan({ id: "a" })], NOW);
    expect(o).toMatchObject({ books: 0, totalUsd: 0, averageUsd: null, medianUsd: null, maxUsd: null, cacheShare: null, perKind: [] });
  });
});

describe("describeBookCost", () => {
  it("says what a book cost, per kind, and what stayed out of it", () => {
    const line = describeBookCost({ usd: 0.3612, capUsd: 0.4, skipped: ["broad"], breakdown: { standard: 0.07, writing: 0.1 }, placesLookups: 4, research: { cached: 2, searched: 5, failed: 0 }, quiet: { known: 3, inBook: 1 } });
    expect(line).toBe("$0.361 aan modelaanroepen (standard 0.070, writing 0.100); overgeslagen voor de kostengrens: broad; 4 Google-opzoekingen; onderzoek: 2 uit de cache, 5 gezocht; aanbodindex: 3 stille activiteiten bekend, 1 toch in het boek");
  });

  it("is honest that the classic generation's own cost is not measured", () => {
    expect(describeBookCost({ usd: 0.2, capUsd: 0.4, skipped: [], breakdown: {}, pipeline: "classic_after_failure" })).toContain("de kosten daarvan zijn niet gemeten");
  });
});
