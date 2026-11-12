import { describe, expect, it } from "vitest";
import { defaultEngineLibrary, selectSeeds, WEIGHTS_ANCHOR, WEIGHTS_CURRENT, WEIGHTS_V2 } from "@/lib/discovery/engine";
import { buildGraph } from "@/lib/discovery/engine/graph";
import { syntheticTwoPageProfiles } from "@/lib/discovery/engine/syntheticTwoPages";

const lib = defaultEngineLibrary();
const graph = buildGraph(lib.activities, lib.tags);
const byId = new Map(lib.activities.map((a) => [a.id, a]));

describe("hub damping (weights.hub)", () => {
  it("measures how connected an activity is, 0..1, with the walks and nature work high and a niche craft low", () => {
    for (const a of lib.activities) {
      const h = graph.hubness(a);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(1);
    }
    expect(graph.hubness(byId.get("wandelen")!)).toBeGreaterThan(0.6);
    expect(graph.hubness(byId.get("natuurbeheer")!)).toBeGreaterThan(0.6);
    expect(graph.hubness(byId.get("glasblazen")!)).toBe(0);
  });

  it("is on only in the production weights, so the pinned seeds of the other sets do not move", () => {
    expect(WEIGHTS_CURRENT.hub).toBe(0);
    expect(WEIGHTS_V2.hub).toBe(0);
    expect(WEIGHTS_ANCHOR.hub).toBeGreaterThan(0);
  });

  it("puts fewer of the most connected activities in books the engine fills itself, and never touches the visitor's own picks", () => {
    const profiles = syntheticTwoPageProfiles(24, "hub-damping");
    const hubShare = (weights: typeof WEIGHTS_ANCHOR) => {
      let hubs = 0;
      let all = 0;
      for (const p of profiles) {
        const picks = new Set(p.input.interests);
        const seeds = selectSeeds(p.input, lib, { weights }).seeds;
        // Every pick that was usable before stays a seed: the damping is only for what the engine adds.
        for (const s of seeds) {
          if (picks.has(s.activityId)) continue;
          all++;
          if (graph.hubness(byId.get(s.activityId)!) >= 0.6) hubs++;
        }
      }
      return hubs / all;
    };
    expect(hubShare(WEIGHTS_ANCHOR)).toBeLessThan(hubShare({ ...WEIGHTS_ANCHOR, hub: 0 }));
  }, 90_000);
});
