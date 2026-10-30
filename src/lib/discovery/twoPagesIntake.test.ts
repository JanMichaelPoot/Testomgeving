import { describe, expect, it } from "vitest";
import type { StoredIntake } from "@/app/intake/actions";
import { applyImageIntake } from "@/lib/discovery/imageIntake";
import { defaultEngineLibrary, engineInputFromIntake, passesConstraints, resolveConstraints, runEngine } from "@/lib/discovery/engine";
import { explainDroppedPicks, whyNot } from "@/lib/discovery/engine/droppedPicks";
import { getActivities, getActivity } from "@/lib/discovery/library";
import { sanitizeDiscoveryAnswers } from "@/lib/discovery/answers";
import { why } from "@/lib/claude/generateFromSeeds";
import { hashSeed, mulberry32 } from "@/lib/discovery/rng";
import { MAX_CONCRETE_PICKS } from "@/lib/discovery/twoPages";

const QUIET = ["place-forest-edge", "place-still-water", "moment-stillness", "sense-grass"];

const base = {
  situation: "",
  purpose: "self",
  purposeFollowUp: "",
  ageCategory: "35-44",
  location: "Utrecht",
  searchDistance: "hour",
  freeTimePattern: "",
  practicalToWild: "either",
  timeAvailable: "halfday",
  budget: "100",
  effort: "some",
  solutionTypes: [],
  mustHaves: "",
  preferences: "",
  company: [],
  personalReflection: "",
  socialFormats: [],
  surpriseMe: false,
  intakeVariant: "associations",
  intakeFlow: "images2",
  associations: QUIET,
  associationCorrections: [],
  locale: "nl",
} as unknown as StoredIntake;

describe("the two-page intake: what the server stores", () => {
  it("reads page 2 as the person's own choice: the picks are the interests, the worlds follow from them, nothing is derived from the images", () => {
    const out = applyImageIntake({ ...base, interests: ["pottenbakken", "schietles", "boulderen"] }, "nl", "seed", 7);
    expect(out.intakeFlow).toBe("images2");
    expect(out.intakeVariant).toBe("associations");
    expect(out.interests).toEqual(["pottenbakken", "schietles", "boulderen"]);
    // Pottery is creative, shooting and bouldering are both in movement: the worlds follow from the picks.
    expect([...(out.interestDomains ?? [])].sort()).toEqual(["creative", "movement"]);
    expect(out.solutionTypes).toEqual(["activity"]);
  });

  it("does not trust the browser: unknown ids are dropped, and at most six picks are kept", () => {
    const many = getActivities().slice(0, 40).map((a) => a.id);
    const out = applyImageIntake({ ...base, interests: ["not-real", 42 as never, ...many] }, "nl", "seed", 7);
    expect(out.interests).toHaveLength(MAX_CONCRETE_PICKS);
    expect((out.interests ?? []).every((id) => !!getActivity(id))).toBe(true);
    const sanitized = sanitizeDiscoveryAnswers({ interests: ["not-real", "pottenbakken"] });
    expect(sanitized.interests).toEqual(["pottenbakken"]);
  });

  it("still takes the dials from the images, and the image behind a chosen activity", () => {
    const out = applyImageIntake({ ...base, interests: ["pottenbakken"] }, "nl", "seed", 7);
    expect(out.effort).toBe("minimal"); // quiet images
    expect(["grounded", "practical"]).toContain(out.practicalToWild);
  });

  it("works with nothing chosen on page 2 (the 'choose for me' path): no interests, the engine's own spread", () => {
    const out = applyImageIntake({ ...base, interests: [], surpriseMe: true }, "nl", "seed", 7);
    expect(out.interests).toEqual([]);
    expect(out.surpriseMe).toBe(true);
    const result = runEngine(engineInputFromIntake(out, { seed: "s", month: 7 }));
    expect(result.seeds).toHaveLength(7);
  });

  it("leaves the four-round intake as it was (no intakeFlow, interests derived from the images)", () => {
    const out = applyImageIntake({ ...base, intakeFlow: undefined, interests: ["not-real"] }, "nl", "seed", 7);
    expect(out.intakeFlow).toBeUndefined();
    expect((out.interests ?? []).length).toBeGreaterThan(0);
    expect(out.interests).not.toContain("not-real");
  });
});

describe("the engine honours what was chosen on page 2", () => {
  it("keeps a chosen activity that needs supervision although the 'predictable' dial came from quiet images, but not when it was not chosen", () => {
    const stored = applyImageIntake({ ...base, interests: ["schietles", "pottenbakken", "wandelen"] }, "nl", "seed", 7);
    expect(["grounded", "practical"]).toContain(stored.practicalToWild); // both hide supervised activities
    let withPick = 0;
    let without = 0;
    for (let i = 0; i < 30; i++) {
      const input = engineInputFromIntake(stored, { seed: `h${i}`, month: 7 });
      expect(input.explicitPicks).toBe(true);
      if (runEngine(input).seeds.some((s) => s.activityId === "schietles")) withPick += 1;
      // Same picks as in the card wizard (no explicit flag): the dial hides supervised activities.
      const plain = { ...input, explicitPicks: undefined };
      if (runEngine(plain).seeds.some((s) => s.activityId === "schietles")) without += 1;
    }
    expect(withPick).toBeGreaterThan(10); // one of the two "familiar" slots in about half of the books; see docs/fase4-opzet.md
    expect(without).toBe(0);
  }, 60000);

  it("calls a chosen activity picked, and an activity reached from it related to what they picked (not 'reached from images')", () => {
    const stored = applyImageIntake({ ...base, interests: ["pottenbakken", "schilderen", "wandelen"] }, "nl", "seed", 7);
    const result = runEngine(engineInputFromIntake(stored, { seed: "w", month: 7 }));
    const familiar = result.seeds.find((s) => s.direction === "familiar" && s.chain.length === 1);
    expect(familiar).toBeTruthy();
    // The writer is told the person picked it (fromImages false), exactly as in the card wizard.
    expect(why(familiar!, "en", false, false)).toContain("picked this themselves");
    const adjacent = result.seeds.find((s) => s.direction === "adjacent");
    expect(why(adjacent!, "en", false, false)).toContain("Related to something they picked");
  });
});

describe("a chosen activity that a limit rules out is named, not lost", () => {
  const lib = defaultEngineLibrary();
  const picks = ["wandelen", "bungeejump", "zwemmen"].map((id) => getActivity(id)!);

  it("names the activity and the first limit it breaks", () => {
    const c = resolveConstraints({ interests: [], interestDomains: [], socialFormats: [], practicalToWild: "either", budget: "25", effort: "minimal", timeAvailable: "halfday", ageCategory: "", mustHaves: "", seed: "x", month: 7 });
    const dropped = explainDroppedPicks(picks, c);
    expect(dropped.map((d) => d.activityId)).toContain("bungeejump");
    expect(dropped.find((d) => d.activityId === "bungeejump")!.reason).toMatch(/budget|effort/);
    expect(dropped.map((d) => d.activityId)).not.toContain("wandelen");
  });

  it("does not drop a supervised activity for the 'predictable' dial when the person chose it", () => {
    const c = resolveConstraints({ interests: [], interestDomains: [], socialFormats: [], practicalToWild: "grounded", budget: "100", effort: "committed", timeAvailable: "halfday", ageCategory: "", mustHaves: "", seed: "x", month: 7 });
    expect(explainDroppedPicks([getActivity("schietles")!], c)).toEqual([]);
    expect(whyNot(getActivity("schietles")!, c)).toBe("supervised");
  });

  it("says the same as the engine's own filter: an activity passes exactly when no limit is named, over 400 random limits", () => {
    const rnd = mulberry32(hashSeed("parity"));
    const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)];
    for (let i = 0; i < 400; i++) {
      const c = resolveConstraints({
        interests: [],
        interestDomains: [],
        socialFormats: pick([[], ["solo"], ["small_group"], ["duo", "online"]]),
        practicalToWild: pick(["grounded", "either", "wild"]),
        budget: pick(["free", "25", "100", "allin"]),
        effort: pick(["minimal", "some", "committed"]),
        timeAvailable: "halfday",
        ageCategory: "",
        mustHaves: pick(["", "buiten", "binnen", "geen groepen"]),
        seed: "x",
        month: 1 + Math.floor(rnd() * 12),
      });
      for (const a of lib.activities) expect(whyNot(a, c) === null, `${a.id} #${i}`).toBe(passesConstraints(a, c).ok);
    }
  });
});

describe("effort for the picks of page 2", () => {
  it("rises to what a chosen activity needs, but never below what the images say, and never against a slider the person moved", async () => {
    const { effortForPicks } = await import("@/lib/discovery/imageIntake");
    // Quiet images, but they chose bouldering (intensity 3 or 2): the effort rises so the pick is not ruled out by a dial nobody answered.
    const need = getActivity("boulderen")!.intensity ?? 0;
    expect(["some", "committed"]).toContain(effortForPicks("minimal", ["boulderen"], false));
    expect(need).toBeGreaterThanOrEqual(2);
    expect(effortForPicks("committed", ["yoga"], false)).toBe("committed");
    expect(effortForPicks("minimal", ["boulderen"], true)).toBe("minimal");
    expect(effortForPicks("minimal", [], false)).toBe("minimal");
  });
});

describe("the two-page visitors in the engine (regression over 150 synthetic visitors)", () => {
  it("never breaks a hard rule (E1, E3, E4, E5, E6) and keeps the book varied", async () => {
    const { evaluate, runProfiles } = await import("@/lib/discovery/engine/evaluate");
    const { syntheticTwoPageProfiles } = await import("@/lib/discovery/engine/syntheticTwoPages");
    const lib = defaultEngineLibrary();
    const report = evaluate(runProfiles(syntheticTwoPageProfiles(150, "two-regression"), lib), lib);
    for (const k of ["E1", "E3", "E4", "E5", "E6"] as const) expect(report.violations[k], k).toEqual([]);
    expect(report.rates.seedsAtLeastSix).toBeGreaterThanOrEqual(0.98);
    expect(report.rates.fourDomains).toBeGreaterThanOrEqual(0.98);
    expect(report.rates.maxTwoPerDomain).toBeGreaterThanOrEqual(0.97);
    expect(report.rates.allDirections).toBeGreaterThanOrEqual(0.94);
  }, 300000);
});
