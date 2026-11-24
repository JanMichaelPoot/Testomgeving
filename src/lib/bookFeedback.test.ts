import { describe, expect, it } from "vitest";
import { COMMENT_MAX, cleanBookFeedback, isEnthusiastic, summarizeBookFeedback, type BookFeedbackRow } from "@/lib/bookFeedback";
import { getBookFeedbackCopy } from "@/lib/i18n/bookFeedback";

describe("cleanBookFeedback (Step 241)", () => {
  it("accepts only whole scores of 1 to 5", () => {
    for (const rating of [0, 6, 2.5, -1, NaN, "4" as unknown as number, undefined as unknown as number]) expect(cleanBookFeedback({ rating })).toBeNull();
    expect(cleanBookFeedback(null)).toBeNull();
    for (const rating of [1, 2, 3, 4, 5]) expect(cleanBookFeedback({ rating })?.rating).toBe(rating);
  });

  it("leaves the sentence and the consent alone on a plain tap on a score of 4 or 5", () => {
    const clean = cleanBookFeedback({ rating: 5 });
    expect(clean).toEqual({ rating: 5 });
    expect(clean).not.toHaveProperty("comment");
    expect(clean).not.toHaveProperty("quoteConsent");
  });

  it("trims the sentence and cuts it at the maximum", () => {
    expect(cleanBookFeedback({ rating: 4, comment: "  mooi  " })?.comment).toBe("mooi");
    expect(cleanBookFeedback({ rating: 4, comment: "x".repeat(COMMENT_MAX + 50) })?.comment).toHaveLength(COMMENT_MAX);
  });

  it("clears the sentence when it is sent empty", () => {
    expect(cleanBookFeedback({ rating: 4, comment: "   " })?.comment).toBeNull();
  });

  it("gives consent only with a 4 or 5 and a sentence to show", () => {
    expect(cleanBookFeedback({ rating: 5, comment: "Heerlijk", quoteConsent: true })?.quoteConsent).toBe(true);
    expect(cleanBookFeedback({ rating: 4, comment: "Heerlijk", quoteConsent: false })?.quoteConsent).toBe(false);
    // no sentence in the same call: nothing to consent to
    expect(cleanBookFeedback({ rating: 5, quoteConsent: true })?.quoteConsent).toBe(false);
    // a cleared sentence withdraws it
    expect(cleanBookFeedback({ rating: 5, comment: " ", quoteConsent: true })?.quoteConsent).toBe(false);
  });

  it("withdraws consent for any rating below 4, even when the caller says nothing about it", () => {
    expect(cleanBookFeedback({ rating: 3, comment: "Hm", quoteConsent: true })?.quoteConsent).toBe(false);
    expect(cleanBookFeedback({ rating: 2 })?.quoteConsent).toBe(false);
  });

  it("knows who is enthusiastic", () => {
    expect([1, 2, 3, 4, 5].map(isEnthusiastic)).toEqual([false, false, false, true, true]);
    expect(isEnthusiastic(null)).toBe(false);
  });
});

const row = (over: Partial<BookFeedbackRow>): BookFeedbackRow => ({ rating: 5, comment: null, quote_consent: false, locale: "nl", created_at: "2026-11-24T10:00:00Z", ...over });

describe("summarizeBookFeedback", () => {
  it("is empty without rows", () => {
    expect(summarizeBookFeedback([])).toEqual({ n: 0, mean: null, distribution: [0, 0, 0, 0, 0], enthusiastic: null, comments: [] });
  });

  it("counts, averages and gives the share of 4s and 5s", () => {
    const s = summarizeBookFeedback([row({ rating: 5 }), row({ rating: 5 }), row({ rating: 4 }), row({ rating: 2 })]);
    expect(s.n).toBe(4);
    expect(s.mean).toBe(4);
    expect(s.distribution).toEqual([0, 1, 0, 1, 2]);
    expect(s.enthusiastic).toBe(0.75);
  });

  it("ignores rows with an impossible score", () => {
    expect(summarizeBookFeedback([row({ rating: 9 }), row({ rating: 3 })]).n).toBe(1);
  });

  it("lists the sentences newest first, and only calls a sentence usable when the score is 4 or 5 and consent was given", () => {
    const s = summarizeBookFeedback([
      row({ rating: 5, comment: "Oud", quote_consent: true, created_at: "2026-11-01T10:00:00Z" }),
      row({ rating: 2, comment: "Nieuw", quote_consent: true, created_at: "2026-11-20T10:00:00Z" }),
      row({ rating: 4, comment: "  ", created_at: "2026-11-22T10:00:00Z" }),
    ]);
    expect(s.comments.map((c) => c.text)).toEqual(["Nieuw", "Oud"]);
    expect(s.comments.map((c) => c.consent)).toEqual([false, true]);
  });
});

describe("the rating block's copy", () => {
  it("has every line in both languages, with the same placeholders", () => {
    const nl = getBookFeedbackCopy("nl");
    const en = getBookFeedbackCopy("en");
    expect(Object.keys(nl).sort()).toEqual(Object.keys(en).sort());
    for (const key of Object.keys(nl) as (keyof typeof nl)[]) {
      expect(nl[key].length, `nl.${key}`).toBeGreaterThan(0);
      expect(en[key].length, `en.${key}`).toBeGreaterThan(0);
      const holes = (s: string) => (s.match(/\{[a-z]+\}/g) ?? []).sort().join();
      expect(holes(nl[key]), key).toBe(holes(en[key]));
    }
  });

  it("writes WindowInto, never WINDOW", () => {
    for (const locale of ["nl", "en"] as const) {
      for (const text of Object.values(getBookFeedbackCopy(locale))) expect(text).not.toMatch(/\bWINDOW\b(?!into)/);
    }
  });
});
