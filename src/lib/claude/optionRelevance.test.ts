import { describe, expect, it, vi } from "vitest";
import { filterRelevant, isRelevant, relevanceScore, relevantOptions } from "@/lib/claude/optionRelevance";
import { researchSeeds, type LocalOption, type ResearchCache } from "@/lib/claude/localResearch";
import { seedResearch, seedsWithoutSupply } from "@/lib/claude/generateFromSeeds";
import type { Seed } from "@/lib/discovery/engine";

// Jan, 14 Nov 2026: the book "Een avond je eigen bordspel schetsen" showed two make-up courses as its "echte plekken". The online round had been asked about
// both ideas in one call and answered both with the same make-up courses. These tests pin that, with the options exactly as they were found.

const opt = (name: string, note: string, extra: Partial<LocalOption> = {}): LocalOption => ({ name, city: "Online", url: null, note, until: null, rating: null, ...extra });
const LOI = opt("LOI - Cursus Make-up artist", "Praktijkgerichte cursus met materialenpakket, 12 maanden, €89/maand");
const THEATER = opt("Online Cursus Theater en Special Effects Make Up", "Uitgebreide cursus speciale effecten make-up, €39");
const UDEMY = opt("Udemy: The Board Game Developer", "Online cursus over het ontwerpen en uitbrengen van een bordspel");
const KERAMIEK = opt("Keramiekles Atelier Brinkhuis Laren", "Keramiekles voor beginners", { city: "Laren" });

describe("is a place about its activity?", () => {
  it("refuses the make-up courses for the board game, whatever else is true of them", () => {
    for (const o of [LOI, THEATER]) {
      expect(relevanceScore(o, "bordspel-ontwerpen")).toBe(0);
      expect(isRelevant(o, "bordspel-ontwerpen", true)).toBe(false);
      expect(isRelevant(o, "bordspel-ontwerpen", false)).toBe(false);
    }
  });

  it("keeps them for the make-up idea, and a board game course for the board game", () => {
    expect(isRelevant(LOI, "theatermake-up", true)).toBe(true);
    expect(isRelevant(THEATER, "theatermake-up", true)).toBe(true);
    expect(isRelevant(UDEMY, "bordspel-ontwerpen", true)).toBe(true);
  });

  it("recognises a place by what it offers, not only by the words of the activity (a ceramics studio for pottery)", () => {
    expect(isRelevant(KERAMIEK, "pottenbakken")).toBe(true);
  });

  it("refuses a place that clearly belongs to another activity: a fitness club for pottery, a woodworking course for painting", () => {
    expect(isRelevant(opt("Fitness Club Laren", "Sportschool met groepslessen", { city: "Laren" }), "pottenbakken")).toBe(false);
    expect(isRelevant(opt("Stadswerkplaats Utrecht - Basis Houtbewerking", "Basis houtbewerking: 8 sessies à 3 uur"), "schilderen", true)).toBe(false);
  });

  it("gives the benefit of the doubt to a place that matches no activity at all (a basilica for monuments)", () => {
    expect(isRelevant(opt("Sint-Servaasbasiliek", "Historische basiliek aan Vrijthof met schatkamer", { city: "Maastricht" }), "monumenten")).toBe(true);
  });

  it("keeps a place of a kindred activity: a boulder hall for a climbing park", () => {
    expect(isRelevant(opt("Bossche Boulders", "Boulderen in 's-Hertogenbosch", { city: "'s-Hertogenbosch" }), "klimpark")).toBe(true);
  });

  it("has nothing to judge an activity without a specific name against", () => {
    expect(isRelevant(opt("Introduction to Dutch", "Gratis online cursus"), "online-cursus", true)).toBe(true);
  });

  it("does not know an activity that does not exist, and so cannot say an option is about it", () => {
    expect(relevanceScore(LOI, "no-such-activity")).toBe(0);
  });
});

describe("one answer for several activities (the failure of 14 Nov 2026)", () => {
  it("keeps the make-up courses with the make-up idea only: the board game idea is left without an option", () => {
    const { kept, dropped } = filterRelevant(
      new Map([
        ["bordspel-ontwerpen", [LOI, THEATER]],
        ["theatermake-up", [LOI, THEATER]],
      ]),
      { online: true },
    );
    expect(kept.get("bordspel-ontwerpen")).toEqual([]);
    expect(kept.get("theatermake-up")).toEqual([LOI, THEATER]);
    expect(dropped.map((d) => d.activityId)).toEqual(["bordspel-ontwerpen", "bordspel-ontwerpen"]);
  });

  it("leaves a provider that two activities were given with the one it fits best", () => {
    const both = opt("Atelier Vorm", "Pottenbakken en tekenen voor beginners", { city: "Laren" });
    const { kept } = filterRelevant(new Map([["pottenbakken", [both]], ["schilderen", [both]]]));
    expect(kept.get("pottenbakken")).toEqual([both]);
    expect(kept.get("schilderen")).toEqual([]);
  });

  it("does not touch an answer in which every option fits", () => {
    const { kept, dropped } = filterRelevant(new Map([["pottenbakken", [KERAMIEK]], ["bordspel-ontwerpen", [UDEMY]]]));
    expect(dropped).toEqual([]);
    expect(kept.get("pottenbakken")).toEqual([KERAMIEK]);
    expect(kept.get("bordspel-ontwerpen")).toEqual([UDEMY]);
  });
});

describe("the research, end to end", () => {
  const args = { location: "Laren", searchDistance: "hour", searchDistanceKm: 25, locale: "nl" as const, verify: false as const, now: new Date("2026-11-14T10:00:00Z") };

  it("stores and returns nothing for the board game when the online answer files the make-up courses under it", async () => {
    const stored = new Map<string, LocalOption[]>();
    const cache: ResearchCache = {
      async get() { return new Map(); },
      async put(entries, key) { for (const e of entries) stored.set(`${e.activityId}|${key}`, e.options); },
    };
    const search = vi.fn(async () => new Map([["bordspel-ontwerpen", [LOI, THEATER]], ["theatermake-up", [LOI, THEATER]]]));
    const { byActivity, stats } = await researchSeeds({ ...args, activityIds: ["bordspel-ontwerpen", "theatermake-up"], mode: "online", cache, search });
    expect(byActivity.get("bordspel-ontwerpen")?.options).toEqual([]);
    expect(byActivity.get("theatermake-up")?.options).toHaveLength(2);
    // what is cached is clean too, so the next book does not read it back
    expect(stored.get("bordspel-ontwerpen|online|v6|online")).toEqual([]);
    expect(stats.dropped).toBe(2);
  });

  it("does not trust a poisoned answer that is already in the cache: it is a new question, searched again", async () => {
    const cache: ResearchCache = {
      async get(ids) { return new Map(ids.map((id) => [id, [LOI, THEATER]] as const)); },
      async put() {},
    };
    const search = vi.fn(async (ids: string[]) => new Map(ids.map((id) => [id, [UDEMY]] as [string, LocalOption[]])));
    const { byActivity } = await researchSeeds({ ...args, activityIds: ["bordspel-ontwerpen"], mode: "online", cache, search });
    expect(search).toHaveBeenCalledTimes(1);
    expect(byActivity.get("bordspel-ontwerpen")?.options.map((o) => o.name)).toEqual(["Udemy: The Board Game Developer"]);
  });
});

describe("the last guard before the book", () => {
  const seed = (activityId: string, partnerId?: string): Seed => ({
    activityId, direction: "familiar", door: "natural", chain: [activityId], via: [], lead: null, alsoFormats: [], verify: [],
    ...(partnerId ? { hybrid: { partnerId, label: { nl: "x", en: "x" } } } : {}),
  });

  it("never shows an option that is not about the idea, and counts the idea as lacking an option", () => {
    const byActivity = new Map([["bordspel-ontwerpen", { activityId: "bordspel-ontwerpen", source: "cache" as const, options: [LOI, THEATER] }]]);
    expect(seedResearch(seed("bordspel-ontwerpen"), byActivity)?.options).toEqual([]);
    expect(seedsWithoutSupply([seed("bordspel-ontwerpen")], byActivity, true)).toHaveLength(1);
  });

  it("leaves what fits untouched (the same object, nothing copied)", () => {
    const r = { activityId: "pottenbakken", source: "search" as const, options: [KERAMIEK] };
    expect(seedResearch(seed("pottenbakken"), new Map([["pottenbakken", r]]))).toBe(r);
  });

  it("counts the options of the partner of a curated combination as its own", () => {
    const byActivity = new Map([
      ["hist-koken", { activityId: "hist-koken", source: "search" as const, options: [] as LocalOption[] }],
      ["pottenbakken", { activityId: "pottenbakken", source: "search" as const, options: [KERAMIEK] }],
    ]);
    expect(seedResearch(seed("hist-koken", "pottenbakken"), byActivity)?.options).toEqual([KERAMIEK]);
  });

  it("filters a list for one activity", () => {
    expect(relevantOptions([KERAMIEK, LOI], "pottenbakken")).toEqual([KERAMIEK]);
  });
});
