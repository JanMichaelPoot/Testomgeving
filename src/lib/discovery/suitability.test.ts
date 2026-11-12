import { describe, expect, it } from "vitest";
import { defaultEngineLibrary, parseMustHaves, resolveConstraints, selectSeeds } from "@/lib/discovery/engine";
import type { EngineInput } from "@/lib/discovery/engine";
import { whyNot } from "@/lib/discovery/engine/droppedPicks";
import { getDictionary } from "@/lib/i18n/dictionaries";
import {
  WHEELCHAIR_UNSUITABLE,
  YOUNG_KIDS_UNSUITABLE,
  unsuitableForCalmPace,
  unsuitableForWheelchair,
  unsuitableForYoungKids,
} from "@/lib/discovery/suitability";

const lib = defaultEngineLibrary();
const byId = new Map(lib.activities.map((a) => [a.id, a]));

const BASE: EngineInput = {
  interests: [],
  interestDomains: [],
  socialFormats: [],
  practicalToWild: "unexpected",
  budget: "allin",
  effort: "committed",
  timeAvailable: "fullday",
  ageCategory: "",
  mustHaves: "",
  history: [],
  seed: "suit-1",
};

describe("the suitability lists", () => {
  it("only name activities that exist in the library", () => {
    for (const id of [...YOUNG_KIDS_UNSUITABLE, ...WHEELCHAIR_UNSUITABLE]) expect(byId.has(id), id).toBe(true);
  });

  it("keep out what the research found for families, wheelchair users and a calm pace", () => {
    for (const id of ["boogparcours-3d", "mountainbiken", "week-meewerken-boerderij", "buurtvrijwilliger", "urbex-tour"]) {
      expect(unsuitableForYoungKids(byId.get(id)!), `young kids: ${id}`).toBe(true);
    }
    for (const id of ["klimmen", "boulderen", "wandeltocht-lang", "grotduiken", "hardlopen"]) {
      expect(unsuitableForWheelchair(byId.get(id)!), `wheelchair: ${id}`).toBe(true);
    }
    for (const id of ["mountainbiken", "boogparcours-3d", "boksen", "hardlopen"]) {
      const a = byId.get(id);
      if (a) expect(unsuitableForCalmPace(a), `calm: ${id}`).toBe(true);
    }
  });

  it("leave a family day out, a museum visit and a quiet walk untouched", () => {
    for (const id of ["familie-uitje", "kinderboerderij", "geocaching", "minigolf", "picknick"]) {
      expect(unsuitableForYoungKids(byId.get(id)!), id).toBe(false);
    }
    expect(unsuitableForWheelchair(byId.get("musea")!)).toBe(false);
    expect(unsuitableForCalmPace(byId.get("musea")!)).toBe(false);
    expect(unsuitableForCalmPace(byId.get("lezen")!)).toBe(false);
  });
});

describe("the chips that carry these needs", () => {
  it("are read by the must-have parser", () => {
    expect(parseMustHaves("Met jonge kinderen").youngKids).toBe(true);
    expect(parseMustHaves("With young children").youngKids).toBe(true);
    expect(parseMustHaves("Met kinderen").youngKids).toBeUndefined();
    expect(parseMustHaves("Rustig tempo").calmPace).toBe(true);
    expect(parseMustHaves("Calm pace").calmPace).toBe(true);
    expect(parseMustHaves("Met de rolstoel bereikbaar").wheelchair).toBe(true);
    expect(parseMustHaves("Wheelchair accessible").wheelchair).toBe(true);
    // Another accessibility wish is only checked, never a filter.
    expect(parseMustHaves("slecht ter been").wheelchair).toBeUndefined();
    expect(parseMustHaves("slecht ter been").verify).toContain("accessibility");
  });

  it("exist on the start page in both languages", () => {
    for (const [locale, chips] of [["nl", ["Met jonge kinderen", "Rustig tempo"]], ["en", ["With young children", "Calm pace"]]] as const) {
      const all = getDictionary(locale).venster.who.limitChips;
      for (const c of chips) expect(all, `${locale}: ${c}`).toContain(c);
    }
  });

  it("a calm pace caps the effort at light movement even when the dial says committed", () => {
    expect(resolveConstraints({ ...BASE, mustHaves: "Rustig tempo" }).intensityCap).toBe(1);
    expect(resolveConstraints({ ...BASE, mustHaves: "" }).intensityCap).toBe(3);
  });
});

describe("the engine with these needs", () => {
  const seedsFor = (mustHaves: string, n = 25) =>
    Array.from({ length: n }, (_, i) => selectSeeds({ ...BASE, mustHaves, seed: `suit-${i}` }, lib).seeds.map((s) => byId.get(s.activityId)!));

  it("never puts an unsuitable idea in a family-with-young-children book", () => {
    for (const set of seedsFor("Met jonge kinderen")) for (const a of set) expect(unsuitableForYoungKids(a), a.id).toBe(false);
  });

  it("never puts a known wheelchair conflict in the book", () => {
    for (const set of seedsFor("Met de rolstoel bereikbaar")) for (const a of set) expect(unsuitableForWheelchair(a), a.id).toBe(false);
  });

  it("keeps a calm pace calm: no supervised, no heavy, no advanced idea", () => {
    for (const set of seedsFor("Rustig tempo")) for (const a of set) expect(unsuitableForCalmPace(a), a.id).toBe(false);
  });

  it("still fills the full set of ideas for each need", () => {
    for (const chip of ["Met jonge kinderen", "Met de rolstoel bereikbaar", "Rustig tempo"]) {
      for (const set of seedsFor(chip, 5)) expect(set.length, chip).toBeGreaterThanOrEqual(7);
    }
  });

  it("names the need when a chosen activity is ruled out by it", () => {
    const c = (m: string) => resolveConstraints({ ...BASE, mustHaves: m });
    expect(whyNot(byId.get("mountainbiken")!, c("Met jonge kinderen"))).toBe("young_kids");
    expect(whyNot(byId.get("klimmen")!, c("Met de rolstoel bereikbaar"))).toBe("access");
    expect(whyNot(byId.get("hardlopen")!, c("Rustig tempo"))).toBe("effort");
    expect(whyNot(byId.get("urbex-tour")!, c("Rustig tempo"))).not.toBeNull();
  });
});
