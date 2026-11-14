import { describe, expect, it } from "vitest";
import { runEngine, WEIGHTS_CURRENT } from "@/lib/discovery/engine";
import type { EngineInput } from "@/lib/discovery/engine";

// Quiet supply (Stap 195, R1): an activity that earlier research found nothing for near this place is a little less likely, never one the person picked,
// and never excluded. The pinned seeds of the 20 profiles do not move because without `quietSupply` nothing changes (the baseline test of the harness).
// A person with picks: without any picks the engine chooses at random per world and supply plays no part.

const PICKS = ["wandelen", "yoga", "pottenbakken"];
const BASE: EngineInput = {
  interests: PICKS,
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

const books = (n: number, input: Partial<EngineInput>) =>
  Array.from({ length: n }, (_, i) => runEngine({ ...BASE, ...input, seed: `quiet-${i}` }).seeds.map((s) => s.activityId));
const share = (all: string[][], id: string) => all.filter((ids) => ids.includes(id)).length / all.length;

describe("quiet supply in the selection", () => {
  it("changes nothing without it, and nothing for an empty list", () => {
    expect(books(4, { quietSupply: [] })).toEqual(books(4, {}));
  }, 60_000);

  it("steers away from the quiet activities where an alternative fits, without removing them", () => {
    const plain = books(30, {});
    // The five activities (other than the picks) that appear in the most books: where a nudge can be seen.
    const counts = new Map<string, number>();
    for (const ids of plain) for (const id of ids) if (!PICKS.includes(id)) counts.set(id, (counts.get(id) ?? 0) + 1);
    const quiet = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id]) => id);
    const after = books(30, { quietSupply: quiet });
    const before = quiet.reduce((s, id) => s + share(plain, id), 0);
    const now = quiet.reduce((s, id) => s + share(after, id), 0);
    expect(now).toBeLessThan(before);
    // Measured with these 30 books: 53 appearances of the five before, 3 after. The penalty is the size of a noise unit, so wherever a near-equal alternative
    // exists the selection takes it; a quiet activity only stays when nothing else fits. The books are still full ones and the picks are still in them.
    expect(after.every((ids) => ids.length === 7)).toBe(true);
    expect(share(after, "wandelen")).toBeGreaterThan(0);
  }, 120_000);

  it("never touches what the person picked themselves", () => {
    expect(books(4, { quietSupply: PICKS })).toEqual(books(4, {}));
  }, 60_000);

  it("has a weight that is a nudge: more than a rare activity's penalty, well under a whole score", () => {
    expect(WEIGHTS_CURRENT.supply.quiet).toBeGreaterThan(WEIGHTS_CURRENT.supply.rare);
    expect(WEIGHTS_CURRENT.supply.quiet).toBeLessThanOrEqual(0.5);
  });
});
