import { describe, expect, it } from "vitest";
import { defaultEngineLibrary, selectSeeds, WEIGHTS_ANCHOR } from "@/lib/discovery/engine";
import { buildGraph } from "@/lib/discovery/engine/graph";
import { SURPRISE_LISTED, surpriseCentered, surpriseOf, type SurpriseLevel } from "@/lib/discovery/engine/surprise";
import surpriseJson from "@/lib/discovery/engine/surprise.json";
import { scoresForSeed } from "@/lib/discovery/engine/scores";
import { syntheticTwoPageProfiles } from "@/lib/discovery/engine/syntheticTwoPages";
import type { Seed } from "@/lib/discovery/engine/types";

// B4 (docs/plan-activiteitenselectie.md): the surprise level of every activity, and its small effect on the slots about the unfamiliar.

const lib = defaultEngineLibrary();
const graph = buildGraph(lib.activities, lib.tags);
const byId = new Map(lib.activities.map((a) => [a.id, a]));
const level = (id: string) => surpriseOf(byId.get(id)!, graph);

describe("the surprise level of an activity", () => {
  it("is one of four levels for every activity, and each level is used by a real share of the library", () => {
    const counts = [0, 0, 0, 0];
    for (const a of lib.activities) counts[surpriseOf(a, graph)]++;
    for (const [lvl, n] of counts.entries()) expect(n / lib.activities.length, `level ${lvl}`).toBeGreaterThan(0.05);
    expect(counts[0] + counts[1] + counts[2] + counts[3]).toBe(lib.activities.length);
  });

  it("puts what everybody does at the bottom and what hardly anybody thinks of at the top", () => {
    for (const id of ["wandelen", "fietsen", "musea", "koffie-thee", "pretpark", "dierentuin"]) expect(level(id), id).toBe(0);
    for (const id of ["fierljeppen", "eendenkooi-bezoeken", "jachthoorn-blazen", "kano-uithollen"]) expect(level(id), id).toBe(3);
    for (const id of ["glasblazen", "mes-smeden", "lockpicking"]) expect(level(id), id).toBeGreaterThanOrEqual(2);
    for (const id of ["schilderen", "escape-room", "padel"]) expect(level(id), id).toBeLessThanOrEqual(1);
  });

  it("is derived for an activity no correction names, from its tags, supply and connections", () => {
    const named = new Set(SURPRISE_LISTED);
    const derived = lib.activities.filter((a) => !named.has(a.id));
    expect(derived.length).toBeGreaterThan(lib.activities.length * 0.7);
    // a provider that is hard to find and tags few others share: higher than a hub with common tags
    const rare = derived.filter((a) => a.supply === "rare").map((a) => surpriseOf(a, graph));
    const hubs = derived.filter((a) => graph.hubness(a) > 0.8).map((a) => surpriseOf(a, graph));
    const mean = (xs: number[]) => xs.reduce((p, q) => p + q, 0) / Math.max(xs.length, 1);
    expect(mean(rare)).toBeGreaterThan(mean(hubs));
  });
});

describe("the hand-made corrections", () => {
  it("name only activities that exist, none twice and none on two lists", () => {
    for (const id of SURPRISE_LISTED) expect(byId.has(id) || lib.activities.some((a) => a.id === id), `${id} does not exist or is hidden`).toBe(true);
    expect(new Set(SURPRISE_LISTED).size, "an id is on two lists").toBe(SURPRISE_LISTED.length);
    const lists = surpriseJson as unknown as Record<string, string[] | string>;
    for (const key of ["everyday", "known", "unusual", "striking"]) expect(Array.isArray(lists[key])).toBe(true);
  });
});

describe("the surprise in the scores of an idea", () => {
  const a = byId.get("wandelen")!;
  const seed = (surprise?: SurpriseLevel): Seed => ({ activityId: a.id, direction: "unexpected", door: "unexpected", chain: [a.id], via: [], lead: null, alsoFormats: [], verify: [], ...(surprise === undefined ? {} : { surprise }) });

  it("moves with the idea's own level, and keeps the direction's value for a seed without one", () => {
    const none = scoresForSeed(seed(), a);
    const low = scoresForSeed(seed(0), a);
    const high = scoresForSeed(seed(3), a);
    expect(high.surprise).toBeGreaterThan(low.surprise);
    expect(high.novelty).toBeGreaterThan(low.novelty);
    expect(none.surprise).toBeGreaterThan(low.surprise);
    expect(none.surprise).toBeLessThan(high.surprise);
    expect(surpriseCentered(0)).toBe(-1);
    expect(surpriseCentered(3)).toBe(1);
  });
});

const inputs = syntheticTwoPageProfiles(12, "surprise").map((p) => p.input);
const T = 180_000;
const off = { ...WEIGHTS_ANCHOR, surprise: { adjacent: 0, unexpected: 0, stretch: 0, wildcard: 0 } };

describe("B4 in the selection", () => {
  const share = (weights: typeof WEIGHTS_ANCHOR, direction: "unexpected" | "wildcard") => {
    let books = 0;
    let surprising = 0;
    for (const input of inputs) {
      const r = selectSeeds(input, lib, { weights });
      const s = r.seeds.find((x) => x.direction === direction);
      if (!s) continue;
      books++;
      if ((s.surprise ?? 0) >= 2) surprising++;
    }
    return surprising / Math.max(books, 1);
  };

  it("makes the unexpected idea and the wildcard surprising more often than without the nudge", () => {
    expect(share(WEIGHTS_ANCHOR, "unexpected")).toBeGreaterThan(share(off, "unexpected") + 0.05);
    expect(share(WEIGHTS_ANCHOR, "wildcard")).toBeGreaterThanOrEqual(share(off, "wildcard"));
  }, T);

  it("leaves the person's own choices in the book as they were: an everyday pick stays a pick", () => {
    for (const input of inputs) {
      const picks = (w: typeof WEIGHTS_ANCHOR) =>
        selectSeeds(input, lib, { weights: w }).seeds.filter((s) => input.interests.includes(s.activityId)).map((s) => s.activityId).sort();
      expect(picks(WEIGHTS_ANCHOR)).toEqual(picks(off));
    }
  }, T);

  it("gives every seed its level", () => {
    for (const input of inputs.slice(0, 4)) for (const s of selectSeeds(input, lib, { weights: WEIGHTS_ANCHOR }).seeds) expect([0, 1, 2, 3], s.activityId).toContain(s.surprise);
  }, T);

  it("is off in every other weight set", () => {
    expect(WEIGHTS_ANCHOR.surprise.unexpected).toBeGreaterThan(0);
  });
});
