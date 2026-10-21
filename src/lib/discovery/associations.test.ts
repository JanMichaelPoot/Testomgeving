import { describe, expect, it } from "vitest";
import {
  ASSOCIATIONS,
  associationsToEngineInput,
  buildAssociationLibrary,
  describeAssociationsForPrompt,
  imagesBehind,
  sanitizeAssociations,
} from "@/lib/discovery/associations";
import { averageAxes, deriveDials, tagProfile, topTags } from "@/lib/discovery/associationProfile";
import { validateAssociations } from "@/lib/discovery/validate";
import { VOCABULARY, getActivity } from "@/lib/discovery/library";
import { defaultEngineLibrary, agePenalty, selectSeeds } from "@/lib/discovery/engine";
import { evaluate, runProfiles } from "@/lib/discovery/engine/evaluate";
import { syntheticAssociationProfiles } from "@/lib/discovery/engine/syntheticAssociations";
import { syntheticProfiles } from "@/lib/discovery/engine/synthetic";
import { applyImageIntake, cleanRecipientName } from "@/lib/discovery/imageIntake";
import type { StoredIntake } from "@/app/intake/actions";

const CONSTRAINTS = { budget: "100", timeAvailable: "halfday", mustHaves: "", socialFormats: [] as string[], ageCategory: "" };
const QUIET = ["place-forest-edge", "place-still-water", "moment-stillness", "sense-grass"];
const BUSY = ["place-kitchen-table", "moment-laughing", "moment-rhythm", "sense-bass"];

describe("association data", () => {
  it("is valid: at least nine families per round with three variants each, real tags, both languages, no people in the scenes", () => {
    const { errors } = validateAssociations(ASSOCIATIONS, VOCABULARY);
    expect(errors).toEqual([]);
  });

  it("gives the browser one language and no art direction", () => {
    const lib = buildAssociationLibrary("nl");
    expect(lib.cards).toHaveLength(108);
    expect(new Set(lib.cards.map((c) => c.family)).size).toBe(36);
    expect(lib.cards[0]).not.toHaveProperty("scene");
    expect(typeof lib.cards[0].label).toBe("string");
    expect(lib.correctionTags.every((t) => lib.tagLabels[t])).toBe(true);
  });
});

describe("sanitizeAssociations", () => {
  it("keeps real ids only, at most five per round, and real correction tags", () => {
    const places = ASSOCIATIONS.filter((c) => c.round === "places").map((c) => c.id);
    const out = sanitizeAssociations({
      associations: [...places, "nope", 42, "moment-clay", "moment-clay"],
      associationCorrections: ["stillness", "made-up", "food", "water", "play"],
    });
    expect(out.associations).toEqual([...places.slice(0, 5), "moment-clay"]);
    expect(out.associationCorrections).toEqual(["stillness", "food", "water"]);
  });
});

describe("associationsToEngineInput", () => {
  it("is deterministic and gives 4-6 activities, at most one per world", () => {
    const a = associationsToEngineInput({ associationIds: QUIET, interestDomains: [], constraints: CONSTRAINTS, seed: "s" });
    const b = associationsToEngineInput({ associationIds: QUIET, interestDomains: [], constraints: CONSTRAINTS, seed: "s" });
    expect(a).toEqual(b);
    expect(a.interests.length).toBeGreaterThanOrEqual(4);
    expect(a.interests.length).toBeLessThanOrEqual(6);
    const domains = a.interests.map((id) => getActivity(id)!.domain);
    expect(new Set(domains).size).toBe(domains.length);
  });

  it("reads calm images as low effort and busy ones differently", () => {
    const calm = associationsToEngineInput({ associationIds: QUIET, interestDomains: [], constraints: CONSTRAINTS, seed: "s" });
    expect(calm.effort).toBe("minimal");
    const busy = associationsToEngineInput({ associationIds: [...BUSY, "moment-summit", "sense-cold-water"], interestDomains: [], constraints: CONSTRAINTS, seed: "s" });
    expect(busy.effort).toBe("committed");
    expect(["unexpected", "wild"]).toContain(busy.practicalToWild);
  });

  it("respects the hard filters (budget, effort) through the engine's own constraint check", () => {
    const r = associationsToEngineInput({ associationIds: QUIET, interestDomains: [], constraints: { ...CONSTRAINTS, budget: "free" }, seed: "s" });
    for (const id of r.interests) {
      const a = getActivity(id)!;
      if (a.cost !== null) expect(a.cost).toBe(0);
      if (a.intensity !== null) expect(a.intensity).toBeLessThanOrEqual(1);
    }
  });

  it("only cites images that were chosen", () => {
    const r = associationsToEngineInput({ associationIds: BUSY, interestDomains: [], constraints: CONSTRAINTS, seed: "x" });
    for (const ids of Object.values(r.sources)) for (const id of ids) expect(BUSY).toContain(id);
  });

  it("follows the surprise path when nothing was chosen", () => {
    const r = associationsToEngineInput({ associationIds: [], interestDomains: ["nature"], surpriseMe: false, constraints: CONSTRAINTS, seed: "s" });
    expect(r.interests).toEqual([]);
    expect(r.interestDomains).toEqual(["nature"]);
    expect(r).toMatchObject({ practicalToWild: "either", effort: "some" });
  });

  it("gives chosen worlds a head start", () => {
    const withWorld = associationsToEngineInput({ associationIds: ["place-workshop"], interestDomains: ["tech"], constraints: CONSTRAINTS, seed: "s" });
    expect(withWorld.interests.some((id) => getActivity(id)!.domain === "tech")).toBe(true);
  });
});

describe("dials", () => {
  const lib = buildAssociationLibrary("nl");

  it("derives neutral dials when nothing was chosen", () => {
    expect(deriveDials(averageAxes(lib.cards, []), false)).toEqual({ practicalToWild: "either", effort: "some" });
    expect(topTags(tagProfile(lib.cards, []), 3)).toEqual([]);
  });
});

describe("imagesBehind", () => {
  it("finds the chosen image that shares the most with an activity", () => {
    const pottery = getActivity("pottenbakken")!;
    expect(imagesBehind(pottery.tags, ["place-still-water", "moment-clay"])).toEqual(["moment-clay"]);
    expect(imagesBehind(pottery.tags, ["moment-start"])).toEqual([]);
  });
});

describe("prompt lines", () => {
  it("lists the chosen images per round and tells the writer they are images, not activities", () => {
    const text = describeAssociationsForPrompt(["place-workshop", "moment-clay"], ["food"]);
    expect(text).toMatch(/places: A workshop full of sawdust/);
    expect(text).toMatch(/moments: Hands full of clay/);
    expect(text).toMatch(/more of: Food/);
    expect(describeAssociationsForPrompt([])).toBe("");
  });
});

describe("applyImageIntake", () => {
  const base = {
    situation: "",
    purpose: "gift",
    purposeFollowUp: "x",
    ageCategory: "65plus",
    location: "Laren",
    searchDistance: "hour",
    freeTimePattern: "search",
    practicalToWild: "wild",
    timeAvailable: "halfday",
    budget: "25",
    effort: "committed",
    solutionTypes: [],
    mustHaves: "",
    preferences: "",
    company: ["partner"],
    personalReflection: "vaker buiten zijn",
    interests: ["not-real"],
    interestDomains: ["nature"],
    socialFormats: [],
    surpriseMe: false,
    intakeVariant: "associations",
    associations: QUIET,
    associationCorrections: ["food"],
    recipientName: "  Judith\n<b>  ",
    locale: "nl",
  } as StoredIntake;

  it("lets the sliders of the profile screen replace the axis the images gave (effort follows energy, practicalToWild follows novelty)", () => {
    const calm = applyImageIntake({ ...base, axesOverride: { energy: -1, novelty: -1 } }, "nl", "seed");
    expect(calm.effort).toBe("minimal");
    expect(calm.practicalToWild).toBe("grounded");
    expect(calm.axesOverride).toEqual({ energy: -1, novelty: -1 });
    const wild = applyImageIntake({ ...base, axesOverride: { energy: 1, novelty: 1 } }, "nl", "seed");
    expect(wild.effort).toBe("committed");
    expect(wild.practicalToWild).toBe("wild");
    // an axis that was not moved keeps what the images say
    const onlyNovelty = applyImageIntake({ ...base, axesOverride: { novelty: 1 } }, "nl", "seed");
    expect(onlyNovelty.effort).toBe("minimal");
    expect(onlyNovelty.practicalToWild).toBe("wild");
  });

  it("does not trust the browser for the sliders: garbage is dropped, numbers are clamped", () => {
    const out = applyImageIntake({ ...base, axesOverride: { energy: 99, social: "x", setting: -5, evil: 1 } as never }, "nl", "seed");
    expect(out.axesOverride).toEqual({ energy: 1, setting: -1 });
    expect(applyImageIntake({ ...base, axesOverride: undefined }, "nl", "seed").axesOverride).toEqual({});
  });

  it("counts a moved slider even when no image was chosen", () => {
    const out = applyImageIntake({ ...base, associations: [], associationCorrections: [], axesOverride: { energy: -1 } }, "nl", "seed");
    expect(out.effort).toBe("minimal");
  });

  it("replaces the dials and interests by what the images say, and empties what was not asked", () => {
    const out = applyImageIntake(base, "nl", "seed");
    expect(out.effort).toBe("minimal");
    expect(out.practicalToWild).not.toBe("wild");
    expect(out.interests).not.toContain("not-real");
    expect(out.interests!.length).toBeGreaterThanOrEqual(4);
    expect(out).toMatchObject({ purposeFollowUp: "", freeTimePattern: "", solutionTypes: ["activity"], preferences: "Eten", ageCategory: "65plus" });
    expect(out.personalReflection).toBe("vaker buiten zijn");
  });

  it("keeps a cleaned first name only for a gift", () => {
    expect(applyImageIntake(base, "nl", "s").recipientName).toBe("Judith b");
    expect(applyImageIntake({ ...base, purpose: "self" }, "nl", "s").recipientName).toBe("");
    expect(applyImageIntake({ ...base, purpose: "problem" }, "nl", "s").purpose).toBe("self");
    expect(cleanRecipientName("x".repeat(80))).toHaveLength(40);
  });
});

describe("the engine on image-intake visitors", () => {
  const lib = defaultEngineLibrary();

  it("meets the hard rules E1-E6 and spreads at least as wide as the card wizard", () => {
    const assoc = evaluate(runProfiles(syntheticAssociationProfiles(200, "t"), lib), lib);
    for (const list of Object.values(assoc.violations)) expect(list).toEqual([]);
    const cards = evaluate(runProfiles(syntheticProfiles(200, "t", lib), lib), lib);
    expect(assoc.rates.fourDomains).toBeGreaterThanOrEqual(cards.rates.fourDomains - 0.01);
    expect(assoc.rates.seedsAtLeastSix).toBe(1);
  }, 120_000);

  it("still meets E1-E6 when visitors also move the sliders of the profile screen (R2.1)", () => {
    const withSliders = evaluate(runProfiles(syntheticAssociationProfiles(300, "sliders", { overrides: true }), lib), lib);
    for (const list of Object.values(withSliders.violations)) expect(list).toEqual([]);
    expect(withSliders.rates.seedsAtLeastSix).toBe(1);
  }, 120_000);
});

describe("age weighting (fase 1.5)", () => {
  const lib = defaultEngineLibrary();
  const byId = new Map(lib.activities.map((a) => [a.id, a]));

  it("only shifts scores for the outer age groups and leaves an unknown age alone", () => {
    const heavy = lib.activities.find((a) => a.intensity === 3)!;
    expect(agePenalty(heavy, "65plus")).toBeGreaterThan(0);
    expect(agePenalty(heavy, "35-44")).toBe(0);
    expect(agePenalty(heavy, "")).toBe(0);
    expect(agePenalty(heavy, undefined)).toBe(0);
  });

  it("never excludes: a 65+ visitor who picks something demanding still gets it", () => {
    const demanding = lib.activities.find((a) => a.safety.tier === 2 && (a.cost ?? 0) <= 2 && (a.intensity ?? 0) <= 2)!;
    const r = selectSeeds(
      { interests: [demanding.id], interestDomains: [], socialFormats: [], practicalToWild: "wild", budget: "100", effort: "committed", timeAvailable: "fullday", ageCategory: "65plus", mustHaves: "", seed: "age" },
      lib,
    );
    expect(r.seeds.map((s) => s.activityId)).toContain(demanding.id);
  });

  it("makes supervised activities rarer for 65+ than for 35-44, same visitors otherwise", () => {
    const share = (age: string) => {
      const seeds = runProfiles(syntheticProfiles(200, "age", lib).map((p) => ({ ...p, input: { ...p.input, ageCategory: age } })), lib)
        .flatMap((r) => r.result.seeds.map((s) => byId.get(s.activityId)!));
      return seeds.filter((a) => a.safety.tier === 2).length / seeds.length;
    };
    expect(share("65plus")).toBeLessThan(share("35-44"));
  }, 120_000);
});
