import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/anthropic", () => ({ anthropic: { messages: { create: vi.fn() } }, CLAUDE_MODEL: "test-model" }));

import { dedupePlaces, seedResearch, seedsWithoutSupply } from "@/lib/claude/generateFromSeeds";
import type { SeedResearch } from "@/lib/claude/localResearch";
import type { Seed } from "@/lib/discovery/engine/types";

// The Laren book of 14 Nov 2026 showed the same pen shop twice: once for the person's own choice "fountain pens" and once for the curated combination
// "letters with a fountain pen", which reads the options of its partner activity too. One place, one idea has to hold for the combination as well.

const seed = (activityId: string, extra: Partial<Seed> = {}): Seed => ({ activityId, direction: "familiar", door: "natural", chain: [activityId], via: [], lead: null, alsoFormats: [], verify: [], ...extra });
const hybrid = (partnerId: string): Seed["hybrid"] => ({ partnerId, label: { nl: "Brieven schrijven met een vulpen op mooi papier", en: "Writing letters with a fountain pen on nice paper" } });
const option = (name: string) => ({ name, city: "Laren", url: null, note: "vulpennen pennenwinkel brieven", until: null, rating: null });
const research = (activityId: string, names: string[]): SeedResearch => ({ activityId, options: names.map(option), source: "search" });

const pick = seed("vulpennen");
const combo = seed("brieven", { direction: "unexpected", door: "unexpected", hybrid: hybrid("vulpennen") });

describe("a combination does not bring its partner's place into the book a second time", () => {
  it("leaves the combination without the shop its own pick already has", () => {
    const byActivity = new Map([["vulpennen", research("vulpennen", ["Appelboom Pennenspeciaalzaak"])], ["brieven", research("brieven", [])]]);
    // Before the fix the partner's options were merged in at read time, whatever dedupePlaces had done.
    expect(seedResearch(combo, byActivity)?.options.map((o) => o.name)).toEqual(["Appelboom Pennenspeciaalzaak"]);
    const deduped = dedupePlaces([pick, combo], byActivity, new Set(["vulpennen"]));
    expect(seedResearch(pick, deduped)?.options).toHaveLength(1);
    expect(seedResearch(combo, deduped)?.options).toEqual([]);
    expect(seedsWithoutSupply([pick, combo], deduped, true).map((s) => s.activityId)).toEqual(["brieven"]);
  });

  it("keeps the other places of the partner for the combination, and only the first place of the pick is taken", () => {
    const byActivity = new Map([["vulpennen", research("vulpennen", ["Appelboom Pennenspeciaalzaak", "Pennenhuis Blaricum"])], ["brieven", research("brieven", ["Schrijfcafe Laren"])]]);
    const deduped = dedupePlaces([pick, combo], byActivity, new Set(["vulpennen"]));
    expect(seedResearch(combo, deduped)?.options.map((o) => o.name)).toEqual(["Schrijfcafe Laren", "Pennenhuis Blaricum"]);
  });

  it("still gives the combination its partner's places when the partner is not an idea of the book", () => {
    const byActivity = new Map([["vulpennen", research("vulpennen", ["Appelboom Pennenspeciaalzaak"])], ["brieven", research("brieven", [])]]);
    const deduped = dedupePlaces([combo], byActivity);
    expect(seedResearch(combo, deduped)?.options.map((o) => o.name)).toEqual(["Appelboom Pennenspeciaalzaak"]);
  });

  it("gives the same answer when it is applied twice", () => {
    const byActivity = new Map([["vulpennen", research("vulpennen", ["Appelboom Pennenspeciaalzaak", "Pennenhuis Blaricum"])], ["brieven", research("brieven", ["Schrijfcafe Laren"])]]);
    const once = dedupePlaces([pick, combo], byActivity, new Set(["vulpennen"]));
    const twice = dedupePlaces([pick, combo], once, new Set(["vulpennen"]));
    expect(seedResearch(combo, twice)?.options).toEqual(seedResearch(combo, once)?.options);
  });
});
