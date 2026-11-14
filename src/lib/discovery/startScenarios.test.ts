import { describe, expect, it } from "vitest";
import type { StoredIntake } from "@/app/intake/actions";
import { applyImageIntake } from "@/lib/discovery/imageIntake";
import { runEngine, engineInputFromIntake } from "@/lib/discovery/engine";
import { getActivity } from "@/lib/discovery/library";
import { formatProfile } from "@/lib/claude/generateIdeaBook";
import { computeCharacterProfile } from "@/lib/characterProfile";
import { MINOR_UNSUITABLE } from "@/lib/discovery/audience";

// The ten scenarios of the brief, from the start page to what the generator receives: who we search for, where, the limits and the
// images all end up in the same stored answers, the engine's input and the writer's prompt, and nothing is asked twice.

const base = {
  situation: "",
  purpose: "self",
  purposeFollowUp: "",
  ageCategory: "",
  location: "",
  searchDistance: "city",
  freeTimePattern: "",
  practicalToWild: "either",
  timeAvailable: "",
  budget: "",
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
  associations: ["place-forest-edge", "moment-stillness", "sense-grass"],
  associationCorrections: [],
  interests: [],
  locale: "en",
} as unknown as StoredIntake;

function run(overrides: Partial<StoredIntake>, month = 6) {
  const stored = applyImageIntake({ ...base, ...overrides } as StoredIntake, "en", "scenario", month);
  const result = runEngine(engineInputFromIntake(stored, { seed: "scenario", month }));
  const prompt = formatProfile(stored, computeCharacterProfile(stored));
  return { stored, result, prompt };
}

describe("the ten scenarios: start page to generator", () => {
  it("1. for myself: the context is stated, nothing about age is assumed", () => {
    const { stored, prompt } = run({ searchContext: "self", location: "Utrecht" });
    expect(stored.searchContext).toBe("self");
    expect(stored.audienceProfile?.audience.source).toBe("unknown");
    expect(prompt).toContain("Search context (stated): for themselves");
    expect(prompt).toContain("Location: Utrecht");
    expect(prompt).toContain("Age bracket: not stated");
  });

  it("2. a parent for a child: a soft age, the child wording for the writer, nothing that is not for minors", () => {
    const { stored, result, prompt } = run({ searchContext: "child", location: "Haarlem", recipientName: "Emma", budget: "100" });
    expect(stored.audienceProfile?.audience).toMatchObject({ value: "child_or_youth", source: "inferred" });
    expect(prompt).toMatch(/for a child or young person/);
    expect(prompt).toMatch(/do not assume a young child or a teenager/);
    expect(prompt).toContain("NOT the person");
    expect(prompt).toContain("Emma");
    expect(result.seeds.length).toBeGreaterThanOrEqual(4);
    for (const s of result.seeds) expect(MINOR_UNSUITABLE.has(s.activityId), s.activityId).toBe(false);
  });

  it("3. for a teenager: an explicit age is kept and wins over the soft reading", () => {
    const { stored } = run({ searchContext: "child", ageCategory: "under18" });
    expect(stored.ageCategory).toBe("under18");
    expect(stored.audienceProfile?.audience).toMatchObject({ value: "child_or_youth", source: "explicit" });
  });

  it("4. for another adult: written to them, no age assumed", () => {
    const { stored, prompt } = run({ searchContext: "adult", recipientName: "Sam", location: "Zwolle" });
    expect(stored.audienceProfile?.audience.value).toBe("adult");
    expect(stored.audienceProfile?.audience.source).toBe("inferred");
    expect(prompt).toContain("for another adult");
    expect(prompt).toContain("Sam");
  });

  it("5. an older stored 'senior' context reads as another adult: no age bracket is ever a label, nothing is assumed", () => {
    const { stored, result, prompt } = run({ searchContext: "senior", location: "Eindhoven" });
    expect(stored.searchContext).toBe("adult");
    expect(stored.audienceProfile?.audience).toMatchObject({ value: "adult", source: "inferred" });
    expect(prompt).not.toMatch(/older person|senior|quiet or traditional/i);
    expect(result.seeds.length).toBeGreaterThanOrEqual(4);
  });

  it("6. for a group with different ages: no single age, no name, ideas that hold for a mixed group", () => {
    const { stored, prompt } = run({ searchContext: "group", location: "Utrecht", company: ["friends"], recipientName: "Het team" });
    expect(stored.recipientName).toBe("");
    expect(stored.audienceProfile?.audience).toMatchObject({ value: "mixed" });
    expect(stored.audienceProfile?.lifeWorld).toMatchObject({ value: "friends", source: "explicit" });
    expect(prompt).toMatch(/for a group of people/);
    expect(prompt).toContain("the group");
  });

  it("7. the context left unknown: everything still works and the prompt says so", () => {
    const { stored, result, prompt } = run({ searchContext: undefined, location: "Groningen" });
    expect(stored.searchContext).toBe("unknown");
    expect(stored.audienceProfile?.searchContext.source).toBe("unknown");
    expect(prompt).toContain("Search context (unknown): not stated");
    expect(result.seeds.length).toBeGreaterThanOrEqual(4);
  });

  it("8. only a place, no limits: the book is still made and the place is the one thing that is required", () => {
    const { stored, result, prompt } = run({ location: "Maastricht", budget: "", timeAvailable: "", company: [], mustHaves: "" });
    expect(stored.location).toBe("Maastricht");
    expect(prompt).toContain("Location: Maastricht");
    expect(prompt).toContain("Time available: not stated");
    expect(prompt).toContain("Budget (per person): not stated");
    expect(result.seeds.length).toBeGreaterThanOrEqual(4);
  });

  it("9. several limits: distance, budget, time, setting, access and moment all reach the engine and the writer", () => {
    const mustHaves = "Moet buiten zijn; Rolstoeltoegankelijk; Zonder auto bereikbaar; In het weekend";
    const { stored, result, prompt } = run({ location: "Haarlem", searchDistance: "hour", searchDistanceKm: 50, budget: "25", timeAvailable: "halfday", company: ["family"], mustHaves });
    expect(prompt).toContain("Location: Haarlem");
    // The slider's real values reach the writer in words: kilometres from the starting place, and a budget per person.
    expect(prompt).toContain("Search distance (from the place above): up to 50 km from the starting place");
    expect(prompt).toContain("Budget (per person): up to €25 per person");
    expect(prompt).toContain(`Must-haves (hard constraints): ${mustHaves}`);
    // The engine's filters: outdoors is a hard limit, the rest travels as "to verify".
    expect(result.constraints.setting).toBe("outdoor");
    for (const verify of ["accessibility", "transport", "weekend"]) expect(result.constraints.verify, verify).toContain(verify);
    for (const s of result.seeds) expect(getActivity(s.activityId)?.setting, s.activityId).not.toBe("indoor");
    expect(stored.audienceProfile?.lifeWorld).toMatchObject({ value: "family" });
  });

  it("10. images that point in different directions: the profile stays broad, no single reading is forced", () => {
    const calm = ["place-forest-edge", "moment-stillness", "sense-grass"];
    const wild = ["place-arena-lights", "moment-countdown", "sense-engine-roar"];
    const { stored, result } = run({ searchContext: "self", associations: [...calm, ...wild] });
    const profile = stored.audienceProfile!;
    expect(profile.interests.value.length).toBeGreaterThanOrEqual(3);
    // Contradicting images do not produce a confident one-sided orientation: at most two orientations are named.
    expect(profile.orientation.value.length).toBeLessThanOrEqual(2);
    expect(profile.breadth).toBeGreaterThan(0);
    expect(new Set(result.seeds.map((s) => getActivity(s.activityId)?.domain)).size).toBeGreaterThanOrEqual(3);
  });
});
