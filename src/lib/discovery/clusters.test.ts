import { describe, expect, it } from "vitest";
import { CLUSTERS, MAX_PER_CLUSTER, clusterOf } from "@/lib/discovery/clusters";
import { defaultEngineLibrary, selectSeeds, WEIGHTS_ANCHOR } from "@/lib/discovery/engine";
import type { EngineInput } from "@/lib/discovery/engine";
import { syntheticTwoPageProfiles } from "@/lib/discovery/engine/syntheticTwoPages";

const lib = defaultEngineLibrary();
const have = new Set(lib.activities.map((a) => a.id));

describe("the clusters of the same kind of activity", () => {
  it("only name activities that exist, and no activity is in two clusters", () => {
    const seen = new Map<string, string>();
    for (const [name, list] of Object.entries(CLUSTERS)) {
      for (const id of list) {
        expect(have.has(id), `${name}: ${id}`).toBe(true);
        expect(seen.get(id), `${id} is in ${seen.get(id)} and ${name}`).toBeUndefined();
        seen.set(id, name);
      }
    }
    expect(clusterOf("swingdansen")).toBe("dance");
    expect(clusterOf("bonsai")).toBeUndefined();
  });

  it("keeps a book from holding more than the cap of one kind, unless the visitor picked them all themselves", () => {
    const profiles = syntheticTwoPageProfiles(20, "cluster-cap");
    for (const p of profiles) {
      const picks = new Set(p.input.interests);
      const { seeds } = selectSeeds(p.input, lib, { weights: WEIGHTS_ANCHOR });
      const byKind = new Map<string, { own: number; added: number }>();
      for (const s of seeds) {
        const kind = clusterOf(s.activityId);
        if (!kind) continue;
        const e = byKind.get(kind) ?? { own: 0, added: 0 };
        if (picks.has(s.activityId)) e.own++;
        else e.added++;
        byKind.set(kind, e);
      }
      // What the engine adds on its own never takes a kind past the cap; the visitor's own picks are theirs to make.
      for (const [kind, e] of byKind) expect(e.own >= MAX_PER_CLUSTER || e.own + e.added <= MAX_PER_CLUSTER, `${p.id} ${kind}`).toBe(true);
    }
  }, 30_000);

  it("holds for a visitor who asked for dance: at most two dances in the book", () => {
    const dance: EngineInput = {
      interests: ["dansen"], interestDomains: [], socialFormats: [], practicalToWild: "either", budget: "allin", effort: "some",
      timeAvailable: "halfday", ageCategory: "", mustHaves: "", history: [], seed: "dance-1",
    };
    for (let i = 0; i < 20; i++) {
      const { seeds } = selectSeeds({ ...dance, seed: `dance-${i}` }, lib, { weights: WEIGHTS_ANCHOR });
      expect(seeds.filter((s) => clusterOf(s.activityId) === "dance").length, `seed ${i}`).toBeLessThanOrEqual(MAX_PER_CLUSTER);
    }
  }, 30_000);
});
