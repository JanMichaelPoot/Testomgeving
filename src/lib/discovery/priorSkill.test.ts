// Fix round "skills the reader doesn't have": someone who picked technology and said nothing about skills never gets an idea that needs
// programming.
import { describe, expect, it } from "vitest";
import { confirmedSkills, priorSkillOf, SPECIFIC_SKILLS } from "@/lib/discovery/priorSkill";
import { engineInputFromIntake, passesConstraints, relatedActivities, resolveConstraints, runEngine } from "@/lib/discovery/engine";
import { getActivities, getActivity } from "@/lib/discovery/library";
import { buildConcretePool } from "@/lib/discovery/concretePool";
import type { StoredIntake } from "@/app/intake/actions";

const techLover = {
  practicalToWild: "unexpected",
  budget: "allin",
  effort: "committed",
  timeAvailable: "",
  ageCategory: "",
  mustHaves: "",
  situation: "Ik heb zin in iets met technologie.",
  preferences: "",
  personalReflection: "Ik wil graag leren programmeren.",
  purposeFollowUp: "",
  interestDomains: ["tech"],
  interests: [],
  surpriseMe: false,
} as unknown as StoredIntake;

const needsProgramming = (id: string) => SPECIFIC_SKILLS[id] === "programming";

describe("skills a reader says they have", () => {
  it("counts only a plain statement of having the skill", () => {
    expect(confirmedSkills(["Ik programmeer veel in Python."])).toEqual(["programming"]);
    expect(confirmedSkills(["I am a developer."])).toEqual(["programming"]);
    expect(confirmedSkills(["Ik heb mijn duikbrevet."])).toEqual(["diving"]);
    for (const text of ["Ik wil leren programmeren.", "Ik kan niet programmeren.", "I want to learn to code.", "Iets met technologie", "I have never been a programmer."]) expect(confirmedSkills([text]), text).toEqual([]);
  });

  it("gives every library activity a prerequisite, and every listed specific one exists", () => {
    for (const id of Object.keys(SPECIFIC_SKILLS)) expect(getActivity(id), id).toBeDefined();
    for (const a of getActivities()) expect(priorSkillOf(a)).toMatch(/^(none|basic|specific\([a-z]+\))$/);
    expect(priorSkillOf(getActivity("open-source")!)).toBe("specific(programming)");
  });
});

describe("a technology lover without stated skills", () => {
  it("never gets an idea or a companion that needs programming, over 300 selections", () => {
    for (let i = 0; i < 300; i++) {
      const input = engineInputFromIntake(techLover, { seed: `tech-${i}`, month: (i % 12) + 1 });
      const result = runEngine(input);
      const constraints = resolveConstraints(input);
      const ids = result.seeds.flatMap((s) => [s.activityId, ...relatedActivities(s.activityId, constraints).map((a) => a.id)]);
      expect(ids.filter(needsProgramming), `seed tech-${i}`).toEqual([]);
    }
  }, 120_000);

  it("is not even offered such a card", () => {
    for (const locale of ["nl", "en"] as const) expect(buildConcretePool(locale).activities.filter((a) => a.id in SPECIFIC_SKILLS)).toEqual([]);
  });

  it("can get it once they say they program", () => {
    const programmer = { ...techLover, situation: "Ik programmeer voor mijn werk." } as StoredIntake;
    const open = getActivity("open-source")!;
    expect(passesConstraints(open, resolveConstraints(engineInputFromIntake(programmer, { seed: "s" }))).ok).toBe(true);
    expect(passesConstraints(open, resolveConstraints(engineInputFromIntake(techLover, { seed: "s" }))).ok).toBe(false);
  });
});
