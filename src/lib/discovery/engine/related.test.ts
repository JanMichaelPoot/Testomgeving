import { describe, expect, it } from "vitest";
import { defaultEngineLibrary, passesConstraints, relatedActivities, resolveConstraints, runEngine, BRIDGE_MIN, buildGraph } from "@/lib/discovery/engine";
import type { EngineInput } from "@/lib/discovery/engine";

const lib = defaultEngineLibrary();
const graph = buildGraph(lib.activities, lib.tags);
const byId = new Map(lib.activities.map((a) => [a.id, a]));

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
  seed: "related-1",
};
const open = resolveConstraints(BASE);

describe("relatedActivities", () => {
  it("returns at most three activities, never the activity itself or an excluded one", () => {
    const result = relatedActivities("pottenbakken", open, ["koffie-thee"]);
    expect(result.length).toBeGreaterThan(0);
    expect(result.length).toBeLessThanOrEqual(3);
    for (const a of result) {
      expect(a.id).not.toBe("pottenbakken");
      expect(a.id).not.toBe("koffie-thee");
    }
    expect(new Set(result.map((a) => a.id)).size).toBe(result.length);
  });

  it("only returns real neighbours: a bridge of at least BRIDGE_MIN to the source", () => {
    const source = byId.get("pottenbakken")!;
    for (const a of relatedActivities("pottenbakken", open)) expect(graph.bridge(source, a)).toBeGreaterThanOrEqual(BRIDGE_MIN);
  });

  it("is deterministic", () => {
    expect(relatedActivities("hardlopen", open).map((a) => a.id)).toEqual(relatedActivities("hardlopen", open).map((a) => a.id));
  });

  it("respects the same hard filters as the selection (free only, no groups, outdoors)", () => {
    const strict = resolveConstraints({ ...BASE, budget: "free", mustHaves: "geen groepen, buiten" });
    for (const id of ["pottenbakken", "hardlopen", "creatief-schrijven"]) {
      for (const a of relatedActivities(id, strict)) expect(passesConstraints(a, strict).ok).toBe(true);
    }
  });

  it("leaves out the doors of the book when they are passed as exclusions", () => {
    const seeds = runEngine({ ...BASE, interests: ["pottenbakken"] }).seeds;
    const doors = new Set(seeds.map((s) => s.activityId));
    for (const s of seeds) {
      for (const a of relatedActivities(s.activityId, open, doors)) expect(doors.has(a.id)).toBe(false);
    }
  });

  it("does not need anything else: an unknown id gives an empty list", () => {
    expect(relatedActivities("no-such-activity", open)).toEqual([]);
  });

  it("prefers different sub-domains over a second one from the same sub-domain", () => {
    const result = relatedActivities("pottenbakken", open);
    const subs = result.map((a) => a.sub);
    // A repeated sub-domain is only allowed when there were not enough other candidates.
    if (new Set(subs).size < subs.length) {
      const all = lib.activities.filter((a) => a.id !== "pottenbakken" && passesConstraints(a, open).ok && graph.bridge(byId.get("pottenbakken")!, a) >= BRIDGE_MIN);
      expect(new Set(all.map((a) => a.sub)).size).toBeLessThan(3);
    }
  });
});
