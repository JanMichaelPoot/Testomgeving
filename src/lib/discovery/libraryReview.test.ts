import { describe, expect, it } from "vitest";
import { ALL_ACTIVITIES } from "@/lib/discovery/library";

// B5 (docs/plan-activiteitenselectie.md): what the review round of the library found, kept as checks so a later addition does not bring it back.

const live = ALL_ACTIVITIES.filter((a) => a.status !== "retired");
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

describe("the reviewed library", () => {
  it("has no two live activities with the same Dutch or English name (a duplicate is retired, not kept next to its twin)", () => {
    for (const lang of ["nl", "en"] as const) {
      const seen = new Map<string, string>();
      for (const a of live) {
        const key = norm(a.label[lang]);
        expect(seen.get(key), `${a.id} has the ${lang} name of ${seen.get(key)}`).toBeUndefined();
        seen.set(key, a.id);
      }
    }
  });

  it("has a known cost, effort, level, duration and setting for every reviewed activity", () => {
    for (const a of live.filter((x) => x.status === "reviewed")) {
      for (const k of ["intensity", "level", "cost", "duration", "setting"] as const) expect(a[k], `${a.id}.${k}`).not.toBeNull();
    }
  });

  it("states no price, website, brand or gift voucher in an entry tip (the engine invents no facts about providers; the cost class carries the price)", () => {
    const bad = /€|\d\s?(euro|eur)\b|www\.|https?:|\.nl\b|\.com\b|cadeaubon|decathlon|bol\.com|marktplaats|facebook|instagram|youtube|tiktok|eventbrite|strava|duolingo/i;
    for (const a of live) expect(bad.test(`${a.entry?.nl ?? ""} ${a.entry?.en ?? ""}`), `${a.id}: ${a.entry?.nl}`).toBe(false);
  });

  it("keeps the sports with contact, a racket or a thrown object out of safety tier 0", () => {
    for (const id of ["squash", "handbal-vereniging", "blaaspijp", "klootschieten"]) {
      expect(live.find((a) => a.id === id)?.safety.tier, id).toBeGreaterThanOrEqual(1);
    }
  });

  it("marks every reviewed activity with who looked and when (a human still decides 'live')", () => {
    for (const a of live.filter((x) => x.status === "reviewed" || x.status === "live")) {
      expect(a.reviewed_by?.by, a.id).toBeTruthy();
      expect(a.reviewed_by?.at, a.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});
