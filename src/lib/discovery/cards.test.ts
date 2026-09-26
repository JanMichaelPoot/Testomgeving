import { describe, expect, it } from "vitest";
import { buildCardBatches, hidesSupervisedActivities, type CardActivity } from "@/lib/discovery/cards";

const DOMAINS = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"];

// 10 domains x 12 activities, 3 sub-domains each, every 5th one supervised.
const ACTIVITIES: CardActivity[] = DOMAINS.flatMap((d) =>
  Array.from({ length: 12 }, (_, i) => ({
    id: `${d}${i}`,
    domain: d,
    sub: `${d}-sub${i % 3}`,
    label: `${d} ${i}`,
    entry: null,
    tier: (i % 5 === 4 ? 2 : 0) as 0 | 2,
  })),
);

const opts = { activities: ACTIVITIES, domainIds: DOMAINS, seed: "seed-1", hideSupervised: false };
const ids = (batches: ReturnType<typeof buildCardBatches>) => batches.flat().map((s) => s.id);
const byId = new Map(ACTIVITIES.map((a) => [a.id, a]));

describe("buildCardBatches", () => {
  it("is deterministic for a seed, and a different seed gives a different order", () => {
    const a = buildCardBatches({ ...opts, chosenDomains: ["a", "b"] });
    const b = buildCardBatches({ ...opts, chosenDomains: ["a", "b"] });
    const c = buildCardBatches({ ...opts, chosenDomains: ["a", "b"], seed: "seed-2" });
    expect(a).toEqual(b);
    expect(ids(c)).not.toEqual(ids(a));
  });

  it("never shows the same card twice", () => {
    const all = ids(buildCardBatches({ ...opts, chosenDomains: ["a", "b", "c"] }));
    expect(new Set(all).size).toBe(all.length);
  });

  it("fills a batch mostly from the chosen worlds plus a few 'maybe also' cards from others", () => {
    const [first] = buildCardBatches({ ...opts, chosenDomains: ["a", "b"] });
    expect(first).toHaveLength(10);
    const main = first.filter((s) => !s.ext);
    const ext = first.filter((s) => s.ext);
    expect(main).toHaveLength(8);
    expect(ext).toHaveLength(2);
    for (const s of main) expect(["a", "b"]).toContain(byId.get(s.id)!.domain);
    for (const s of ext) expect(["a", "b"]).not.toContain(byId.get(s.id)!.domain);
  });

  it("alternates between the chosen worlds and varies the sub-domain", () => {
    const [first] = buildCardBatches({ ...opts, chosenDomains: ["a", "b"] });
    const main = first.filter((s) => !s.ext).map((s) => byId.get(s.id)!);
    // Round-robin: the domains alternate.
    expect(new Set(main.slice(0, 2).map((a) => a.domain)).size).toBe(2);
    // The first three cards of one world come from three different sub-domains.
    const ofA = main.filter((a) => a.domain === "a").slice(0, 3);
    expect(new Set(ofA.map((a) => a.sub)).size).toBe(ofA.length);
  });

  it("shows a broad sample, one card per world, when nothing is chosen", () => {
    const [first] = buildCardBatches({ ...opts, chosenDomains: [] });
    expect(first).toHaveLength(10);
    expect(new Set(first.map((s) => byId.get(s.id)!.domain)).size).toBe(10);
    expect(first.every((s) => !s.ext)).toBe(true);
  });

  it("hides supervised activities when asked", () => {
    const shown = ids(buildCardBatches({ ...opts, chosenDomains: ["a"], hideSupervised: true }));
    expect(shown.every((id) => byId.get(id)!.tier !== 2)).toBe(true);
    const all = ids(buildCardBatches({ ...opts, chosenDomains: ["a"], hideSupervised: false, maxBatches: 20 }));
    expect(all.some((id) => byId.get(id)!.tier === 2)).toBe(true);
  });

  it("caps the number of batches", () => {
    expect(buildCardBatches({ ...opts, chosenDomains: ["a", "b"], maxBatches: 2 })).toHaveLength(2);
    expect(buildCardBatches({ ...opts, chosenDomains: ["a", "b"] }).length).toBeLessThanOrEqual(4);
  });

  it("tops a batch up from other worlds when a chosen world runs out", () => {
    const small: CardActivity[] = [
      ...ACTIVITIES.filter((a) => a.domain === "a").slice(0, 3),
      ...ACTIVITIES.filter((a) => a.domain !== "a"),
    ];
    const [first] = buildCardBatches({ ...opts, activities: small, chosenDomains: ["a"] });
    expect(first).toHaveLength(10);
    expect(first.filter((s) => !s.ext)).toHaveLength(3);
    expect(first.filter((s) => s.ext)).toHaveLength(7);
  });

  it("returns nothing for an empty library", () => {
    expect(buildCardBatches({ ...opts, activities: [], chosenDomains: ["a"] })).toEqual([]);
  });
});

describe("hidesSupervisedActivities", () => {
  it("only hides them for people who want it predictable", () => {
    expect(hidesSupervisedActivities("grounded")).toBe(true);
    expect(hidesSupervisedActivities("practical")).toBe(true);
    expect(hidesSupervisedActivities("either")).toBe(false);
    expect(hidesSupervisedActivities("unexpected")).toBe(false);
    expect(hidesSupervisedActivities("wild")).toBe(false);
  });
});
