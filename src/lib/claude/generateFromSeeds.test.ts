import { describe, expect, it } from "vitest";
import { checkEntry, shouldUseEngine } from "@/lib/claude/generateFromSeeds";
import type { IdeaBookEntry } from "@/lib/claude/ideaBookTypes";
import type { LocalOption } from "@/lib/claude/localResearch";
import { ALL_ACTIVITIES } from "@/lib/discovery/library";
import { PHOTO_CATEGORIES } from "@/lib/claude/ideaBookTypes";
import { photoCategoryFor } from "@/lib/discovery/engine/photo";
import { scoresForSeed } from "@/lib/discovery/engine/scores";
import type { Seed } from "@/lib/discovery/engine";

const baseEntry: IdeaBookEntry = {
  title: "Klei onder je nagels",
  intro: "x",
  why_it_fits: "y",
  details: ["Open steckutrecht.nl en boek een plek.", "Kom vijf minuten eerder."],
  first_action: "Zoek op Google Maps naar 'pottenbakken Utrecht'.",
  practical: { estimated_cost: "€25", duration: "2 uur", difficulty: "easy", preparation: "" },
  location: { name: "Steck Utrecht", address: "", city: "Utrecht" },
  requirements: [],
  image_suggestion: "",
  photo_category: "creative_workshop",
  door: "natural",
  scores: { relevance: 1, novelty: 1, feasibility: 1, surprise: 1, shareability: 1, effort: 1, cost: 1, social_fit: 1, challenge_level: 1 },
};

const steck: LocalOption = { name: "Steck Utrecht", city: "Utrecht", url: "https://www.steckutrecht.nl/workshops", note: "workshops" };

describe("shouldUseEngine", () => {
  it("is for people who used the interest step, in any way", () => {
    expect(shouldUseEngine({ interests: ["yoga"] })).toBe(true);
    expect(shouldUseEngine({ interestDomains: ["creative"] })).toBe(true);
    expect(shouldUseEngine({ surpriseMe: true })).toBe(true);
  });

  it("is not for the classic wizard or for someone who skipped the step", () => {
    expect(shouldUseEngine({})).toBe(false);
    expect(shouldUseEngine({ interests: [], interestDomains: [], surpriseMe: false })).toBe(false);
  });
});

describe("checkEntry", () => {
  it("keeps a location that is one of the researched options", () => {
    const { entry, issues } = checkEntry(baseEntry, [steck], new Set(["steckutrecht.nl"]));
    expect(entry.location?.name).toBe("Steck Utrecht");
    expect(issues).toEqual([]);
  });

  it("drops a location that is not in the research", () => {
    const { entry, issues } = checkEntry({ ...baseEntry, location: { name: "Atelier Verzonnen", address: "", city: "Utrecht" } }, [steck], new Set());
    expect(entry.location).toBeNull();
    expect(issues[0]).toContain("location_not_in_research");
  });

  it("reports a website that appears nowhere in the research, but not certainly-real platforms", () => {
    const entry: IdeaBookEntry = { ...baseEntry, details: ["Ga naar verzonnenatelier.nl", "Zoek op meetup.com naar 'klei'."] };
    const { issues } = checkEntry(entry, [steck], new Set(["steckutrecht.nl"]));
    expect(issues).toEqual(["unverified_website:verzonnenatelier.nl"]);
  });

  it("accepts a website that another idea's research found", () => {
    const entry: IdeaBookEntry = { ...baseEntry, details: ["Open buurman.nl", "x"], location: null };
    expect(checkEntry(entry, [], new Set(["buurman.nl"])).issues).toEqual([]);
  });
});

describe("photo category and scores of a seed", () => {
  it("gives every activity in the library one of the 12 photo categories", () => {
    for (const a of ALL_ACTIVITIES) expect(PHOTO_CATEGORIES).toContain(photoCategoryFor(a));
  });

  const seed = (direction: Seed["direction"]): Seed => ({ activityId: "hardlopen", direction, door: "natural", chain: ["hardlopen"], via: [], lead: "solo", alsoFormats: [], verify: [] });
  const a = ALL_ACTIVITIES.find((x) => x.id === "hardlopen")!;

  it("is deterministic and stays within 0-100", () => {
    const s = scoresForSeed(seed("familiar"), a);
    expect(scoresForSeed(seed("familiar"), a)).toEqual(s);
    for (const v of Object.values(s)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });

  it("makes a familiar idea more relevant and a wildcard more novel", () => {
    const familiar = scoresForSeed(seed("familiar"), a);
    const wildcard = scoresForSeed(seed("wildcard"), a);
    expect(familiar.relevance).toBeGreaterThan(wildcard.relevance);
    expect(wildcard.novelty).toBeGreaterThan(familiar.novelty);
  });

  it("counts an unknown cost and a supervised activity against feasibility", () => {
    const base = scoresForSeed(seed("familiar"), { ...a, cost: 1, intensity: 1, level: 0 });
    const unknown = scoresForSeed(seed("familiar"), { ...a, cost: null, intensity: 1, level: 0 });
    const supervised = scoresForSeed(seed("familiar"), { ...a, cost: 1, intensity: 1, level: 0, safety: { tier: 2, note: { nl: "x", en: "x" } } });
    expect(unknown.feasibility).toBeLessThan(base.feasibility + 1);
    expect(supervised.feasibility).toBeLessThan(base.feasibility);
  });
});
