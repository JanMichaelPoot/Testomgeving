import { describe, expect, it } from "vitest";
import { CHECKIN_COMMENT_MAX, checkinDue, cleanCheckin, parseCheckinAnswer, summarizeCheckins, type CheckinRow } from "@/lib/checkin";
import { getCheckinCopy } from "@/lib/i18n/checkin";

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-11-24T09:30:00Z");
const ago = (days: number) => new Date(NOW.getTime() - days * DAY);

describe("checkinDue (Step 243)", () => {
  it("waits until the book is 8 days old and gives up after 22", () => {
    const due = (days: number) => checkinDue({ createdAt: ago(days), checkinSentAt: null, reminderSentAt: ago(days - 2) }, NOW);
    expect(due(7.9)).toBe(false);
    expect(due(8.1)).toBe(true);
    expect(due(21.9)).toBe(true);
    expect(due(22.1)).toBe(false);
  });

  it("never sends twice", () => {
    expect(checkinDue({ createdAt: ago(10), checkinSentAt: ago(1), reminderSentAt: ago(5) }, NOW)).toBe(false);
  });

  it("keeps clear of the first-action reminder: at least 3 days after it was sent", () => {
    expect(checkinDue({ createdAt: ago(10), checkinSentAt: null, reminderSentAt: ago(2) }, NOW)).toBe(false);
    expect(checkinDue({ createdAt: ago(10), checkinSentAt: null, reminderSentAt: ago(3.1) }, NOW)).toBe(true);
  });

  it("waits for a reminder that has not gone out yet, until the book is past the reminder's own window of 9 days", () => {
    expect(checkinDue({ createdAt: ago(8.5), checkinSentAt: null, reminderSentAt: null }, NOW)).toBe(false);
    expect(checkinDue({ createdAt: ago(9.5), checkinSentAt: null, reminderSentAt: null }, NOW)).toBe(true);
  });
});

describe("cleanCheckin", () => {
  it("accepts only the three answers", () => {
    for (const answer of ["done", "planned", "not"]) expect(cleanCheckin({ answer })?.answer).toBe(answer);
    for (const answer of ["yes", "", "DONE", undefined, null, 1, ["done"]]) expect(cleanCheckin({ answer })).toBeNull();
    expect(cleanCheckin(null)).toBeNull();
    expect(parseCheckinAnswer("planned")).toBe("planned");
  });

  it("leaves the sentence and the consent alone on a plain answer", () => {
    const clean = cleanCheckin({ answer: "done" });
    expect(clean).toEqual({ answer: "done" });
  });

  it("trims and cuts the sentence, and clears it when sent empty", () => {
    expect(cleanCheckin({ answer: "done", comment: "  mijn eerste les  " })?.comment).toBe("mijn eerste les");
    expect(cleanCheckin({ answer: "done", comment: "x".repeat(CHECKIN_COMMENT_MAX + 10) })?.comment).toHaveLength(CHECKIN_COMMENT_MAX);
    expect(cleanCheckin({ answer: "done", comment: "   " })?.comment).toBeNull();
  });

  it("allows consent only for 'done' with a sentence in the same call", () => {
    expect(cleanCheckin({ answer: "done", comment: "Heerlijk", quoteConsent: true })?.quoteConsent).toBe(true);
    expect(cleanCheckin({ answer: "done", comment: "Heerlijk", quoteConsent: false })?.quoteConsent).toBe(false);
    expect(cleanCheckin({ answer: "done", quoteConsent: true })?.quoteConsent).toBe(false);
    expect(cleanCheckin({ answer: "done", comment: " ", quoteConsent: true })?.quoteConsent).toBe(false);
    expect(cleanCheckin({ answer: "done", comment: "Heerlijk", quoteConsent: "yes" })?.quoteConsent).toBe(false);
  });

  it("withdraws consent when the answer is changed to anything but 'done', even unasked", () => {
    expect(cleanCheckin({ answer: "not", comment: "geen tijd", quoteConsent: true })?.quoteConsent).toBe(false);
    expect(cleanCheckin({ answer: "planned" })?.quoteConsent).toBe(false);
  });
});

const row = (over: Partial<CheckinRow>): CheckinRow => ({ answer: "done", comment: null, quote_consent: false, locale: "nl", created_at: "2026-11-24T10:00:00Z", ...over });

describe("summarizeCheckins", () => {
  it("is empty without rows", () => {
    expect(summarizeCheckins([], 0)).toEqual({ sent: 0, counts: { done: 0, planned: 0, not: 0 }, answered: 0, responseRate: null, doneShare: null, comments: [] });
  });

  it("counts the answers and gives the response rate and the share of 'done'", () => {
    const s = summarizeCheckins([row({}), row({}), row({ answer: "planned" }), row({ answer: "not" })], 10);
    expect(s.counts).toEqual({ done: 2, planned: 1, not: 1 });
    expect(s.answered).toBe(4);
    expect(s.responseRate).toBe(0.4);
    expect(s.doneShare).toBe(0.5);
  });

  it("ignores rows with an answer it does not know", () => {
    expect(summarizeCheckins([row({ answer: "maybe" })], 3).answered).toBe(0);
  });

  it("lists sentences newest first; only a 'done' with consent may be used on the site", () => {
    const s = summarizeCheckins(
      [
        row({ comment: "Oud", quote_consent: true, created_at: "2026-11-01T10:00:00Z" }),
        row({ answer: "not", comment: "Geen tijd", quote_consent: true, created_at: "2026-11-20T10:00:00Z" }),
        row({ comment: "  ", created_at: "2026-11-22T10:00:00Z" }),
      ],
      3,
    );
    expect(s.comments.map((c) => c.text)).toEqual(["Geen tijd", "Oud"]);
    expect(s.comments.map((c) => c.usable)).toEqual([false, true]);
  });
});

describe("the check-in copy", () => {
  it("has every line in both languages with the same placeholders, and never says WINDOW", () => {
    const nl = getCheckinCopy("nl");
    const en = getCheckinCopy("en");
    const holes = (s: string) => (s.match(/\{[a-z]+\}/g) ?? []).sort().join();
    for (const group of ["mail", "page", "optout"] as const) {
      expect(Object.keys(nl[group]).sort()).toEqual(Object.keys(en[group]).sort());
      for (const k of Object.keys(nl[group]) as never[]) {
        const a = (nl[group] as Record<string, string>)[k];
        const b = (en[group] as Record<string, string>)[k];
        expect(a.length, `nl.${group}.${k}`).toBeGreaterThan(0);
        expect(holes(a), `${group}.${k}`).toBe(holes(b));
        expect(`${a} ${b}`).not.toMatch(/\bWINDOW\b(?!into)/);
      }
    }
  });

  it("promises nothing in return for an answer", () => {
    for (const locale of ["nl", "en"] as const) {
      const text = JSON.stringify(getCheckinCopy(locale)).toLowerCase();
      expect(text).not.toMatch(/korting|discount|gratis|free|code/);
    }
  });
});
