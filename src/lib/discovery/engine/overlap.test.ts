import { describe, expect, it } from "vitest";
import { defaultEngineLibrary, selectSeeds, WEIGHTS_ANCHOR } from "@/lib/discovery/engine";
import { overlappingSeeds } from "@/lib/discovery/engine/overlap";
import { syntheticProfiles } from "@/lib/discovery/engine/synthetic";
import { syntheticTwoPageProfiles } from "@/lib/discovery/engine/syntheticTwoPages";

// "The same idea twice" (the Laren book of 14 Nov 2026: fountain pens, and letters with a fountain pen): a curated combination next to its own pick, or two
// combinations built on one pick. The engine must never build such a book, whichever weights it runs on.

const lib = defaultEngineLibrary();
const hybrid = (partnerId: string) => ({ partnerId, label: { nl: "x", en: "x" } });

describe("overlappingSeeds", () => {
  it("finds a combination next to its own pick, two combinations on one pick, and a repeated activity", () => {
    expect(overlappingSeeds([{ activityId: "vulpennen" }, { activityId: "brieven", hybrid: hybrid("vulpennen") }])).toEqual([["vulpennen", "brieven"]]);
    expect(overlappingSeeds([{ activityId: "a", hybrid: hybrid("p") }, { activityId: "b", hybrid: hybrid("p") }])).toEqual([["a", "b"]]);
    expect(overlappingSeeds([{ activityId: "a" }, { activityId: "a" }])).toEqual([["a", "a"]]);
  });

  it("is quiet for ideas that are only neighbours", () => {
    expect(overlappingSeeds([{ activityId: "a", hybrid: hybrid("p") }, { activityId: "b", hybrid: hybrid("q") }, { activityId: "p2" }])).toEqual([]);
  });
});

describe("the selection never builds the same idea twice", () => {
  it("over 300 simulated visitors, on the ordinary weights", () => {
    for (const p of syntheticProfiles(300, "overlap-1", lib)) {
      expect(overlappingSeeds(selectSeeds(p.input, lib).seeds), p.input.seed).toEqual([]);
    }
  }, 120_000);

  it("over 120 visitors who chose their activities themselves, on the production weights with the anchor model", () => {
    for (const p of syntheticTwoPageProfiles(120, "overlap-2")) {
      expect(overlappingSeeds(selectSeeds(p.input, lib, { weights: WEIGHTS_ANCHOR }).seeds), p.input.seed).toEqual([]);
    }
  }, 120_000);
});
