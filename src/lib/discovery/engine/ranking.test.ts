import { describe, expect, it } from "vitest";
import type { IdeaBookEntry } from "@/lib/claude/ideaBookTypes";
import { defaultEngineLibrary, passesConstraints, resolveConstraints, selectSeeds, WEIGHTS_CURRENT, WEIGHTS_V2 } from "@/lib/discovery/engine";
import type { EngineInput } from "@/lib/discovery/engine";
import { evaluate, type Run } from "@/lib/discovery/engine/evaluate";
import { syntheticProfiles } from "@/lib/discovery/engine/synthetic";
import { computeMetrics } from "@/lib/discovery/eval/metrics";
import { pickOneThingIndex } from "@/lib/possibilityMap";

// B4: the stepwise ranking (weights.ts). Everything here runs on the free, deterministic path.

const lib = defaultEngineLibrary();
const BASE: EngineInput = {
  interests: [],
  interestDomains: [],
  socialFormats: [],
  practicalToWild: "either",
  budget: "100",
  effort: "some",
  timeAvailable: "halfday",
  ageCategory: "35-44",
  mustHaves: "",
  history: [],
  seed: "t1",
};

const unknownCost = lib.activities.filter((a) => a.cost === null);

describe("unknown is never a favourable answer (strictFreeCost)", () => {
  it("the library still has activities of unknown cost to test with", () => {
    expect(unknownCost.length).toBeGreaterThan(0);
  });

  it("without the strict rule an unknown cost passes a free budget, flagged for the research (as before B4)", () => {
    const c = resolveConstraints({ ...BASE, budget: "free" });
    const r = passesConstraints(unknownCost[0], c);
    expect(r.ok).toBe(true);
    expect(r.verify).toContain("cost_unknown");
  });

  it("with the strict rule it does not pass a free budget, but still passes a paid budget (a typed 'gratis' is no filter)", () => {
    const c = resolveConstraints({ ...BASE, budget: "free" }, { strictFreeCost: true });
    expect(passesConstraints(unknownCost[0], c).ok).toBe(false);
    const typed = resolveConstraints({ ...BASE, budget: "100", mustHaves: "graag gratis" }, { strictFreeCost: true });
    expect(passesConstraints(unknownCost[0], typed).ok).toBe(true);
    const paid = resolveConstraints({ ...BASE, budget: "25" }, { strictFreeCost: true });
    expect(passesConstraints(unknownCost[0], paid).ok).toBe(true);
  });

  it("no seed of a free-budget visitor has an unknown cost under the v2 weights, over 300 visitors", () => {
    const profiles = syntheticProfiles(300, "b4-free", lib).map((p) => ({ ...p, input: { ...p.input, budget: "free" } }));
    for (const p of profiles) {
      const { seeds } = selectSeeds(p.input, lib, { weights: WEIGHTS_V2 });
      for (const s of seeds) expect(unknownCost.some((a) => a.id === s.activityId), `${p.id} ${s.activityId}`).toBe(false);
    }
}, 120_000);
});

describe("the ranking weights", () => {
  it("default to the weights from before B4, and leave the seeds without B4 fields", () => {
    const { seeds } = selectSeeds({ ...BASE, interests: ["pottenbakken"] }, lib);
    const withDefault = selectSeeds({ ...BASE, interests: ["pottenbakken"] }, lib, { weights: WEIGHTS_CURRENT }).seeds;
    expect(withDefault).toEqual(seeds);
    expect(seeds.every((s) => s.fit === undefined && s.reasons === undefined)).toBe(true);
  });

  it("v2 seeds carry a measured fit (1 for a pick, never above 1) and the reasons that led to them", () => {
    const { seeds } = selectSeeds({ ...BASE, interests: ["pottenbakken", "hardlopen"], interestDomains: ["creative"] }, lib, { weights: WEIGHTS_V2 });
    for (const s of seeds) {
      expect(s.fit).toBeGreaterThanOrEqual(0);
      expect(s.fit).toBeLessThanOrEqual(1);
      expect(s.reasons?.some((r) => r.startsWith("direction:"))).toBe(true);
    }
    const picked = seeds.filter((s) => ["pottenbakken", "hardlopen"].includes(s.activityId));
    for (const s of picked) {
      expect(s.fit).toBe(1);
      expect(s.reasons).toContain("picked");
    }
    const unexpected = seeds.find((s) => s.direction === "unexpected");
    if (unexpected) expect(unexpected.fit).toBeLessThan(0.5);
  });

  it("with nothing to compare to the fit is neutral, never favourable", () => {
    const { seeds } = selectSeeds({ ...BASE, surpriseMe: true }, lib, { weights: WEIGHTS_V2 });
    expect(seeds.length).toBeGreaterThanOrEqual(6);
    expect(seeds.every((s) => s.fit === 0.5)).toBe(true);
  });

  it("the diversity step puts fewer variations of one thing in a book (pairs that share two or more real tags)", () => {
    const profiles = syntheticProfiles(150, "ke-1", lib);
    const runOf = (weights: typeof WEIGHTS_V2): Run[] =>
      profiles.map((profile) => {
        const result = selectSeeds(profile.input, lib, { weights });
        return { profile, result, sessions: [result] };
      });
    const before = computeMetrics(runOf(WEIGHTS_CURRENT), lib).pairBooks;
    const after = computeMetrics(runOf(WEIGHTS_V2), lib, { strictFreeCost: true }).pairBooks;
    expect(after).toBeLessThan(before - 0.08);
  }, 120_000);

  it("keeps every hard limit under the v2 weights, over 300 visitors (E1, E3, E4, E5, E6 and the free-budget rule)", () => {
    const profiles = syntheticProfiles(300, "b4-hard", lib);
    const runs: Run[] = profiles.map((profile) => {
      const s1 = selectSeeds({ ...profile.input, history: [] }, lib, { weights: WEIGHTS_V2 });
      const s2 = selectSeeds({ ...profile.input, seed: `${profile.input.seed}-s2`, history: s1.seeds.map((s) => s.activityId) }, lib, { weights: WEIGHTS_V2 });
      const s3 = selectSeeds({ ...profile.input, seed: `${profile.input.seed}-s3`, history: [...s1.seeds, ...s2.seeds].map((s) => s.activityId) }, lib, { weights: WEIGHTS_V2 });
      return { profile, result: s1, sessions: [s1, s2, s3] };
    });
    const report = evaluate(runs, lib, { strictFreeCost: true });
    for (const [rule, list] of Object.entries(report.violations)) expect(list, rule).toEqual([]);
  }, 120_000);
});

describe("'if you only pick one' with a measured fit", () => {
  const idea = (door: IdeaBookEntry["door"], scores: Partial<IdeaBookEntry["scores"]>, fit?: number) =>
    ({ door, scores: { relevance: 50, novelty: 50, feasibility: 70, surprise: 50, ...scores }, ...(fit !== undefined ? { fit } : {}) }) as unknown as IdeaBookEntry;

  it("is unchanged for books without a fit (the constants per direction decide, as before)", () => {
    const familiar = idea("natural", { relevance: 92, novelty: 15, surprise: 12 });
    const unexpected = idea("unexpected", { relevance: 56, novelty: 78, surprise: 78 });
    expect(pickOneThingIndex([familiar, unexpected])).toBe(1);
  });

  it("prefers what really fits when books carry a fit: a far-out idea no longer wins on its constants alone", () => {
    const familiar = idea("natural", { relevance: 92, novelty: 15, surprise: 12 }, 100);
    const unexpected = idea("unexpected", { relevance: 56, novelty: 78, surprise: 78 }, 10);
    expect(pickOneThingIndex([familiar, unexpected])).toBe(0);
  });

  it("still lets a convincing new idea win when the person's picks are weakly related to everything", () => {
    const familiar = idea("natural", { relevance: 92, novelty: 15, surprise: 12 }, 35);
    const adjacent = idea("discovery", { relevance: 72, novelty: 48, surprise: 40 }, 60);
    expect(pickOneThingIndex([familiar, adjacent])).toBe(1);
  });
});

