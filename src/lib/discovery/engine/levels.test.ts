import { describe, expect, it } from "vitest";
import { defaultEngineLibrary, selectSeeds, WEIGHTS_CURRENT, WEIGHTS_V2 } from "@/lib/discovery/engine";
import { practicality } from "@/lib/discovery/engine/levels";
import { syntheticProfiles } from "@/lib/discovery/engine/synthetic";
import { DISCOVERY_LEVELS, LEVEL_NAMES, isDiscoveryLevel, levelName } from "@/lib/discoveryLevels";

// Fase 3: the seven discovery levels and the "Praktisch" rule. All on the free, deterministic path.

const lib = defaultEngineLibrary();
const byId = new Map(lib.activities.map((a) => [a.id, a]));

describe("the level names", () => {
  it("has seven levels in both languages, in the order of the brief", () => {
    expect(DISCOVERY_LEVELS).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(Object.values(LEVEL_NAMES.nl)).toEqual(["Vertrouwd", "Praktisch", "Verwant", "Inspirerend", "Verrassend", "Uitdagend", "Onontdekt"]);
    expect(Object.values(LEVEL_NAMES.en)).toEqual(["Familiar", "Practical", "Related", "Inspiring", "Surprising", "Challenging", "Undiscovered"]);
    expect(levelName(5, "nl")).toBe("Verrassend");
    expect(isDiscoveryLevel(7)).toBe(true);
    expect(isDiscoveryLevel(0)).toBe(false);
    expect(isDiscoveryLevel("3")).toBe(false);
  });
});

describe("practicality (uitvoerbaarheid)", () => {
  it("stays within 0..1 for every activity in the library", () => {
    for (const a of lib.activities) {
      const p = practicality(a);
      expect(p, a.id).toBeGreaterThanOrEqual(0);
      expect(p, a.id).toBeLessThanOrEqual(1);
    }
  });

  it("ranks an easy, cheap, short activity above a supervised, expensive, rare one", () => {
    const easy = lib.activities.filter((a) => a.cost !== null && a.cost <= 1 && a.safety.tier === 0 && a.duration !== null && a.duration <= 2 && !a.supply);
    const hard = lib.activities.filter((a) => a.cost === 3 && a.safety.tier === 2 && a.supply === "rare");
    expect(easy.length).toBeGreaterThan(0);
    expect(hard.length).toBeGreaterThan(0);
    const worstEasy = Math.min(...easy.map(practicality));
    const bestHard = Math.max(...hard.map(practicality));
    expect(worstEasy).toBeGreaterThan(bestHard);
  });

  it("never rates an unknown cost as favourably as a known low one", () => {
    const base = lib.activities.find((a) => a.cost === 0 && a.duration === 2)!;
    expect(practicality({ ...base, cost: null })).toBeLessThan(practicality(base));
  });
});

describe("the seven levels on the seeds", () => {
  const profiles = syntheticProfiles(300, "f3-levels", lib);

  it("gives a full set of seven seeds one level each, 1 to 7, over 300 visitors", () => {
    let full = 0;
    for (const p of profiles) {
      const r = selectSeeds(p.input, lib);
      expect(r.seeds.every((s) => s.level !== undefined), p.input.seed).toBe(true);
      if (r.seeds.length === 7 && !r.notes.some((n) => n.startsWith("direction_"))) {
        full++;
        // The list stays ordered by door (the Idea Book's order); the levels are a property of each seed.
        expect(r.seeds.map((s) => s.level).sort()).toEqual([1, 2, 3, 4, 5, 6, 7]);
      }
    }
    expect(full).toBeGreaterThan(200);
  }, 120_000);

  it("ties the levels to the directions: unexpected is 5, stretch 6, the wildcard 7", () => {
    for (const p of profiles.slice(0, 80)) {
      for (const s of selectSeeds(p.input, lib).seeds) {
        if (s.direction === "unexpected") expect(s.level).toBe(5);
        if (s.direction === "stretch") expect(s.level).toBe(6);
        if (s.direction === "wildcard") expect(s.level).toBe(7);
        if (s.direction === "familiar") expect([1, 2]).toContain(s.level);
        if (s.direction === "adjacent") expect([3, 4]).toContain(s.level);
      }
    }
  }, 60_000);

  it("never gives two seeds of one set the same level while the set is complete", () => {
    for (const p of profiles.slice(0, 100)) {
      const r = selectSeeds(p.input, lib);
      if (r.notes.some((n) => n.startsWith("direction_") || n === "filled")) continue;
      expect(new Set(r.seeds.map((s) => s.level)).size, p.input.seed).toBe(r.seeds.length);
    }
  }, 60_000);

  it("makes level 2 (Praktisch) the more practical of the two familiar ideas", () => {
    for (const p of profiles.slice(0, 120)) {
      const fam = selectSeeds(p.input, lib).seeds.filter((s) => s.direction === "familiar");
      if (fam.length !== 2) continue;
      const [one, two] = [fam.find((s) => s.level === 1)!, fam.find((s) => s.level === 2)!];
      expect(practicality(byId.get(two.activityId)!), p.input.seed).toBeGreaterThanOrEqual(practicality(byId.get(one.activityId)!));
    }
  }, 60_000);
});

describe("the Praktisch rule on the second familiar slot (weights.familiar.practicalBonus)", () => {
  it("is off in the current weights and on in v2", () => {
    expect(WEIGHTS_CURRENT.familiar.practicalBonus).toBe(0);
    expect(WEIGHTS_V2.familiar.practicalBonus).toBeGreaterThan(0);
  });

  it("makes the second familiar idea more practical on average, without touching the first", () => {
    const profiles = syntheticProfiles(300, "f3-praktisch", lib);
    let before = 0;
    let after = 0;
    let n = 0;
    let sameFirst = 0;
    for (const p of profiles) {
      const a = selectSeeds(p.input, lib, { weights: { ...WEIGHTS_V2, familiar: { ...WEIGHTS_V2.familiar, practicalBonus: 0 } } });
      const b = selectSeeds(p.input, lib, { weights: WEIGHTS_V2 });
      const fa = a.seeds.filter((s) => s.direction === "familiar");
      const fb = b.seeds.filter((s) => s.direction === "familiar");
      if (fa.length !== 2 || fb.length !== 2) continue;
      n++;
      if (fa[0].activityId === fb[0].activityId) sameFirst++;
      before += practicality(byId.get(fa[1].activityId)!);
      after += practicality(byId.get(fb[1].activityId)!);
    }
    expect(n).toBeGreaterThan(150);
    expect(after / n).toBeGreaterThan(before / n);
    // The rule only acts on the second slot; the first slot is chosen before it and so does not change.
    expect(sameFirst / n).toBeGreaterThan(0.95);
  }, 120_000);
});
