import { describe, expect, it } from "vitest";
import { formatProfile } from "@/lib/claude/generateIdeaBook";
import { computeCharacterProfile } from "@/lib/characterProfile";
import type { IntakeAnswers } from "@/app/intake/actions";

const base: IntakeAnswers = {
  situation: "",
  purpose: "self",
  purposeFollowUp: "",
  ageCategory: "",
  location: "Laren",
  searchDistance: "hour",
  freeTimePattern: "",
  practicalToWild: "either",
  timeAvailable: "halfday",
  budget: "25",
  effort: "some",
  solutionTypes: ["activity"],
  mustHaves: "",
  preferences: "",
  company: ["partner"],
  personalReflection: "",
};

describe("formatProfile", () => {
  it("says 'not stated' for questions the intake did not ask, never a made-up default", () => {
    const text = formatProfile(base, computeCharacterProfile(base));
    expect(text).toMatch(/Situation: not stated/);
    expect(text).toMatch(/Age bracket: not stated/);
    expect(text).toMatch(/Purpose detail: not stated/);
    expect(text).toMatch(/Location: Laren/);
  });

  it("describes the chosen images and says the activities were derived, not picked", () => {
    const text = formatProfile(
      { ...base, intakeVariant: "associations", associations: ["moment-clay"], interests: ["pottenbakken"] },
      computeCharacterProfile(base),
    );
    expect(text).toMatch(/Imagery the person chose/);
    expect(text).toMatch(/Hands full of clay/);
    expect(text).toMatch(/derived from these images by WINDOW, not picked/);
  });

  it("writes a gift to the recipient", () => {
    const text = formatProfile({ ...base, purpose: "gift", recipientName: "Judith" }, computeCharacterProfile(base));
    expect(text).toMatch(/This Idea Book is a GIFT for Judith/);
    expect(text).toMatch(/never "you picked"/);
    expect(formatProfile(base, computeCharacterProfile(base))).not.toMatch(/GIFT/);
  });
});
