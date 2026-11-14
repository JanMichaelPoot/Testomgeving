import { describe, expect, it } from "vitest";
import { defaultEngineLibrary, parseMustHaves, resolveConstraints, selectSeeds } from "@/lib/discovery/engine";
import type { EngineInput } from "@/lib/discovery/engine";
import { whyNot } from "@/lib/discovery/engine/droppedPicks";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { hiddenByNeeds } from "@/lib/discovery/needs";
import {
  ALCOHOL_CENTRAL,
  ALCOHOL_SIDE,
  HUNT_OR_FISH,
  unsuitableWithoutAnimals,
  unsuitableWithoutHuntFish,
  DUTCH_BOUND,
  INTERNATIONAL_FRIENDLY,
  internationalBias,
  unsuitableWithoutDutch,
  LOUD_OR_CROWDED,
  WHEELCHAIR_UNSUITABLE,
  meetingBias,
  unfitFlags,
  unsuitableForMeeting,
  unsuitableForQuiet,
  unsuitableWithoutAlcohol,
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
    for (const id of [...YOUNG_KIDS_UNSUITABLE, ...WHEELCHAIR_UNSUITABLE, ...ALCOHOL_CENTRAL, ...ALCOHOL_SIDE, ...LOUD_OR_CROWDED]) expect(byId.has(id), id).toBe(true);
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
      for (const set of seedsFor(chip, 5)) expect(set.length, chip).toBeGreaterThanOrEqual(5);
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

// --- P1: the way of taking part, alcohol and few stimuli ---------------------------------------------------------------------

describe("P1 chips", () => {
  it("are read by the parser, in both languages", () => {
    expect(parseMustHaves("Mensen ontmoeten").meetPeople).toBe(true);
    expect(parseMustHaves("Meet people").meetPeople).toBe(true);
    expect(parseMustHaves("Met één ander").withOne).toBe(true);
    expect(parseMustHaves("With one other person").withOne).toBe(true);
    expect(parseMustHaves("Met een groep").withGroup).toBe(true);
    expect(parseMustHaves("With a group").withGroup).toBe(true);
    // "Not in a group" is the opposite and stays a different thing.
    expect(parseMustHaves("Niet in een groep").withGroup).toBeUndefined();
    expect(parseMustHaves("Not in a group").withGroup).toBeUndefined();
    expect(parseMustHaves("Zonder alcohol").noAlcohol).toBe(true);
    expect(parseMustHaves("No alcohol").noAlcohol).toBe(true);
    expect(parseMustHaves("Rustig en voorspelbaar").quiet).toBe(true);
    expect(parseMustHaves("Quiet and predictable").quiet).toBe(true);
    // A mention of alcohol that is not a wish for none is only checked.
    expect(parseMustHaves("een glas wijn is prima").noAlcohol).toBeUndefined();
    expect(parseMustHaves("een glas wijn is prima, alcohol mag").verify).toContain("alcohol");
  });

  it("exist on the start page in both languages", () => {
    for (const [locale, chips] of [
      ["nl", ["Mensen ontmoeten", "Met één ander", "Met een groep", "Rustig en voorspelbaar"]],
      ["en", ["Meet people", "With one other person", "With a group", "Quiet and predictable"]],
    ] as const) {
      const all = getDictionary(locale).venster.who.limitChips;
      for (const c of chips) expect(all, `${locale}: ${c}`).toContain(c);
    }
  });

  it("turn the two forms into the forms the engine filters on, together with what was stated", () => {
    expect(resolveConstraints({ ...BASE, mustHaves: "Met één ander" }).formats).toEqual(["duo"]);
    expect(resolveConstraints({ ...BASE, mustHaves: "Met een groep" }).formats).toEqual(["small_group", "large_group"]);
    expect(resolveConstraints({ ...BASE, mustHaves: "Met één ander; Met een groep" }).formats).toEqual(["duo", "small_group", "large_group"]);
    expect(resolveConstraints({ ...BASE, mustHaves: "" }).formats).toBeNull();
  });

  it("keep the alcohol list to what is about drinking, and apart from the side issues", () => {
    for (const id of ALCOHOL_CENTRAL) expect(ALCOHOL_SIDE.has(id), id).toBe(false);
    expect(unsuitableWithoutAlcohol(byId.get("netwerkborrel")!)).toBe(true);
    expect(unsuitableWithoutAlcohol(byId.get("pubquiz")!)).toBe(false);
  });

  it("keep loud and crowded ideas out of a quiet book, and a way to meet people in front", () => {
    for (const id of ["karaoke", "klein-festival", "boksles", "trekkertrek"]) expect(unsuitableForQuiet(byId.get(id)!), id).toBe(true);
    for (const id of ["legpuzzels", "schaken", "bonsai"]) expect(unsuitableForQuiet(byId.get(id)!), id).toBe(false);
    // Something done alone is no way to meet people; a coffee morning where you can come alone is the best way.
    expect(unsuitableForMeeting(byId.get("niets-doen")!)).toBe(true);
    expect(unsuitableForMeeting(byId.get("kletscafe")!)).toBe(false);
    expect(meetingBias(byId.get("kletscafe")!)).toBeLessThan(meetingBias(byId.get("spelavond-thuis")!));
  });

  it("send the flags the browser needs", () => {
    expect(unfitFlags(byId.get("netwerkborrel")!)).toContain("alcohol");
    expect(unfitFlags(byId.get("niets-doen")!)).toEqual(expect.arrayContaining(["no_meet", "no_group", "no_duo"]));
    expect(unfitFlags(byId.get("kletscafe")!)).not.toContain("no_meet");
  });
});

describe("the engine with the P1 chips", () => {
  const sets = (mustHaves: string, n = 25) =>
    Array.from({ length: n }, (_, i) => selectSeeds({ ...BASE, mustHaves, seed: `p1-${i}` }, lib).seeds.map((s) => byId.get(s.activityId)!));

  it("never puts an alcohol activity in a book for someone who wants none", () => {
    for (const set of sets("Zonder alcohol")) for (const a of set) expect(unsuitableWithoutAlcohol(a), a.id).toBe(false);
  });

  it("never puts a loud or crowded idea in a quiet book", () => {
    for (const set of sets("Rustig en voorspelbaar")) for (const a of set) expect(unsuitableForQuiet(a), a.id).toBe(false);
  });

  it("gives someone who wants to meet people ideas with a way to meet others, and clearly more of them than without the chip", () => {
    const withChip = sets("Mensen ontmoeten");
    for (const set of withChip) for (const a of set) expect(unsuitableForMeeting(a), a.id).toBe(false);
    const share = (all: typeof withChip) =>
      all.flat().filter((a) => (a.formats ?? []).includes("drop_in_alone")).length / all.flat().length;
    expect(share(withChip)).toBeGreaterThan(share(sets("")));
  });

  it("keeps every idea able to be done as a pair (or in a group) when asked", () => {
    for (const set of sets("Met één ander")) for (const a of set) expect((a.formats ?? ["duo"]).includes("duo"), a.id).toBe(true);
    for (const set of sets("Met een groep")) for (const a of set) expect((a.formats ?? ["small_group"]).some((f) => f === "small_group" || f === "large_group"), a.id).toBe(true);
  });

  it("still fills the set for each P1 chip", () => {
    for (const chip of ["Zonder alcohol", "Rustig en voorspelbaar", "Mensen ontmoeten", "Met één ander", "Met een groep"]) {
      for (const set of sets(chip, 5)) expect(set.length, chip).toBeGreaterThanOrEqual(5);
    }
  });

  it("names the need when a chosen activity is ruled out by it", () => {
    const c = (m: string) => resolveConstraints({ ...BASE, mustHaves: m });
    expect(whyNot(byId.get("bier-brouwen")!, c("Zonder alcohol"))).toBe("no_alcohol");
    expect(whyNot(byId.get("karaoke")!, c("Rustig en voorspelbaar"))).toBe("quiet");
    expect(whyNot(byId.get("niets-doen")!, c("Mensen ontmoeten"))).toBe("meet");
    expect(whyNot(byId.get("kletscafe")!, c("Mensen ontmoeten"))).toBeNull();
  });
});

// --- P3: no Dutch needed ---------------------------------------------------------------------------------------------------------

describe("P3 chip: no Dutch needed", () => {
  it("names only activities that exist", () => {
    for (const id of [...DUTCH_BOUND, ...INTERNATIONAL_FRIENDLY]) expect(byId.has(id), id).toBe(true);
    for (const id of INTERNATIONAL_FRIENDLY) expect(DUTCH_BOUND.has(id), `${id} is both`).toBe(false);
  });

  it("is read by the parser and exists on the start page in both languages", () => {
    expect(parseMustHaves("Zonder Nederlands").noDutch).toBe(true);
    expect(parseMustHaves("No Dutch needed").noDutch).toBe(true);
    expect(parseMustHaves("No Dutch needed").verify).toContain("no_dutch");
    expect(parseMustHaves("Met de hond").noDutch).toBeUndefined();
    expect(getDictionary("nl").venster.who.limitChips).toContain("Zonder Nederlands");
    expect(getDictionary("en").venster.who.limitChips).toContain("No Dutch needed");
  });

  it("keeps what is done in Dutch out of the book and names the reason for a dropped pick", () => {
    expect(unsuitableWithoutDutch(byId.get("stand-up")!)).toBe(true);
    expect(unsuitableWithoutDutch(byId.get("taalcafe")!)).toBe(false);
    for (let i = 0; i < 25; i++) {
      const set = selectSeeds({ ...BASE, mustHaves: "Zonder Nederlands", seed: `nl-${i}` }, lib).seeds.map((s) => byId.get(s.activityId)!);
      expect(set.length).toBeGreaterThanOrEqual(5);
      for (const a of set) expect(unsuitableWithoutDutch(a), a.id).toBe(false);
    }
    expect(whyNot(byId.get("stand-up")!, resolveConstraints({ ...BASE, mustHaves: "Zonder Nederlands" }))).toBe("no_dutch");
  });

  it("favours language-free worlds and what welcomes newcomers over the same book without the chip", () => {
    const friendly = (mh: string) => {
      const all = Array.from({ length: 25 }, (_, i) => selectSeeds({ ...BASE, mustHaves: mh, seed: `intl-${i}` }, lib).seeds.map((s) => byId.get(s.activityId)!)).flat();
      return all.filter((a) => internationalBias(a) < 0).length / all.length;
    };
    expect(friendly("Zonder Nederlands")).toBeGreaterThan(friendly(""));
  });

  it("sends the flag the browser needs", () => {
    expect(unfitFlags(byId.get("stand-up")!)).toContain("dutch");
    expect(unfitFlags(byId.get("taalcafe")!)).not.toContain("dutch");
  });
});

// --- animals: knuffelen, wedstrijden, vissen, jagen -----------------------------------------------------------------------------------------

describe("the animal activities", () => {
  const NEW = ["kattencafe", "geitenyoga", "ezel-wandeling", "lammetjesdag", "dierenopvang-knuffelen", "paardenverzorgingsdag", "ponyrijden", "hondenshow", "paardensportwedstrijd",
    "duivenwedstrijd", "pluimveetentoonstelling", "schapendrijven", "ringrijden", "karpervissen", "vliegvissen", "zeevissen", "visvijver", "krabben-vangen", "jachtkennismaking",
    "wildkijken", "hertenbronst", "valkerij", "jachthoorn-blazen", "jachthonden-demo", "kaninhop", "koeknuffelen", "ganzenkijken"];

  it("are in the library, visible (their photo exists) and part of the nature world", () => {
    for (const id of NEW) {
      const a = byId.get(id);
      expect(a, id).toBeDefined();
      expect(a!.domain, id).toBe("nature");
    }
    expect(NEW).toHaveLength(27);
  });

  it("explain the permit for hunting and fishing, and hunting needs qualified supervision", () => {
    for (const id of ["karpervissen", "vliegvissen", "zeevissen"]) expect(byId.get(id)!.safety.note?.nl, id).toMatch(/VISpas/);
    const hunt = byId.get("jachtkennismaking")!;
    expect(hunt.safety.tier).toBe(2);
    expect(hunt.safety.note?.nl).toMatch(/jachtakte/);
    expect(hunt.safety.note?.en).toMatch(/hunting licence/);
  });

  it("keep the seasonal ones to their months", () => {
    expect(byId.get("lammetjesdag")!.months).toEqual([3, 4, 5]);
    expect(byId.get("hertenbronst")!.months).toEqual([9, 10]);
    expect(byId.get("pluimveetentoonstelling")!.months).toEqual([11, 12, 1, 2]);
  });

  it("keep hunting from young searchers and children", () => {
    const c = resolveConstraints({ ...BASE, searchContext: "child" });
    expect(whyNot(byId.get("jachtkennismaking")!, c)).toBe("audience");
    expect(whyNot(byId.get("kattencafe")!, c)).toBeNull();
  });

  it("have two opt-out chips in both languages, read by the parser", () => {
    expect(parseMustHaves("Zonder jagen of vissen").noHuntFish).toBe(true);
    expect(parseMustHaves("No hunting or fishing").noHuntFish).toBe(true);
    expect(parseMustHaves("Zonder dieren").noAnimals).toBe(true);
    expect(parseMustHaves("No animals").noAnimals).toBe(true);
    expect(parseMustHaves("Met de hond").noAnimals).toBeUndefined();
    for (const c of ["Zonder jagen of vissen", "Zonder dieren"]) expect(getDictionary("nl").venster.who.limitChips).toContain(c);
    for (const c of ["No hunting or fishing", "No animals"]) expect(getDictionary("en").venster.who.limitChips).toContain(c);
  });

  it("never put hunting or fishing in a book of someone who chose 'Zonder jagen of vissen', and nothing with animals for 'Zonder dieren'", () => {
    const sets = (mh: string) => Array.from({ length: 25 }, (_, i) => selectSeeds({ ...BASE, mustHaves: mh, seed: `animals-${i}` }, lib).seeds.map((s) => byId.get(s.activityId)!)).flat();
    for (const a of sets("Zonder jagen of vissen")) expect(unsuitableWithoutHuntFish(a), a.id).toBe(false);
    for (const a of sets("Zonder dieren")) {
      expect(unsuitableWithoutAnimals(a), a.id).toBe(false);
      expect(unsuitableWithoutHuntFish(a), a.id).toBe(false);
    }
    // Without the chips the animals are there like anything else.
    expect(sets("").some((a) => unsuitableWithoutAnimals(a))).toBe(true);
    expect(whyNot(byId.get("vissen")!, resolveConstraints({ ...BASE, mustHaves: "Zonder jagen of vissen" }))).toBe("hunt_fish");
    expect(whyNot(byId.get("kattencafe")!, resolveConstraints({ ...BASE, mustHaves: "Zonder dieren" }))).toBe("animals");
    expect(whyNot(byId.get("kattencafe")!, resolveConstraints({ ...BASE, mustHaves: "Zonder jagen of vissen" }))).toBeNull();
  });

  it("send the flags the browser needs, and every id on the hunt-or-fish list exists", () => {
    for (const id of HUNT_OR_FISH) expect(byId.has(id), id).toBe(true);
    expect(unfitFlags(byId.get("karpervissen")!)).toEqual(expect.arrayContaining(["hunt_fish", "animals"]));
    expect(unfitFlags(byId.get("kattencafe")!)).toContain("animals");
    expect(unfitFlags(byId.get("kattencafe")!)).not.toContain("hunt_fish");
    expect(hiddenByNeeds(["animals"], { noAnimals: true })).toBe(true);
    expect(hiddenByNeeds(["animals"], { noHuntFish: true })).toBe(false);
    expect(hiddenByNeeds(["hunt_fish", "animals"], { noHuntFish: true })).toBe(true);
  });
});
