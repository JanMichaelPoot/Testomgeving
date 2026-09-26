import { describe, expect, it } from "vitest";
import { buildChoiceGroups, usesCardWizard } from "@/lib/checkoutChoices";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { IntakeAnswers } from "@/app/intake/actions";

const nl = getDictionary("nl");
const labels = {
  activity: (id: string) => ({ pottenbakken: "Pottenbakken", schaken: "Schaken" })[id] ?? null,
  domain: (id: string) => ({ creative: "Creatief" })[id] ?? null,
};

const base: IntakeAnswers = {
  situation: "Ik zoek iets nieuws voor de zaterdag",
  purpose: "self",
  purposeFollowUp: "",
  ageCategory: "35-44",
  location: "Utrecht",
  searchDistance: "city",
  freeTimePattern: "",
  practicalToWild: "either",
  timeAvailable: "halfday",
  budget: "100",
  effort: "some",
  solutionTypes: ["activity"],
  mustHaves: "geen groepen",
  preferences: "",
  company: ["alone"],
  personalReflection: "",
};

const groups = (a: IntakeAnswers) => buildChoiceGroups(a, nl.intake, nl.checkout.choicesGroups, nl.checkout.choicesSurprise, labels);

describe("usesCardWizard", () => {
  it("recognises any use of the interest step", () => {
    expect(usesCardWizard({ interests: ["schaken"] })).toBe(true);
    expect(usesCardWizard({ interestDomains: ["creative"] })).toBe(true);
    expect(usesCardWizard({ surpriseMe: true })).toBe(true);
    expect(usesCardWizard({})).toBe(false);
  });
});

describe("buildChoiceGroups", () => {
  it("groups the answers per wizard page, in order", () => {
    const g = groups({ ...base, interests: ["pottenbakken", "schaken"], socialFormats: ["solo"] });
    expect(g.map((x) => [x.id, x.page])).toEqual([
      ["situation", 0],
      ["about", 1],
      ["dials", 2],
      ["interests", 3],
      ["final", 4],
    ]);
    expect(g[0].lines.join(" ")).toContain("Ik zoek iets nieuws");
    expect(g[1].lines).toContain("Utrecht");
    expect(g[3].lines[0]).toBe("Pottenbakken, Schaken");
  });

  it("puts must-haves on the page that holds them: the last page for the card wizard, page 4 for the legacy one", () => {
    const cards = groups({ ...base, interests: ["schaken"] });
    expect(cards[4].lines).toContain("geen groepen");
    expect(cards[3].lines).not.toContain("geen groepen");
    const legacy = groups(base);
    expect(legacy[3].lines).toContain("geen groepen");
    expect(legacy[4].lines).not.toContain("geen groepen");
  });

  it("shows worlds when nothing specific was picked, and 'surprise me'", () => {
    expect(groups({ ...base, interestDomains: ["creative"] })[3].lines).toEqual(["Creatief"]);
    expect(groups({ ...base, surpriseMe: true })[3].lines).toEqual([nl.checkout.choicesSurprise]);
  });

  it("caps a long list of picks and skips ids it does not know", () => {
    const many = Array.from({ length: 9 }, () => "schaken");
    const line = groups({ ...base, interests: [...many, "onbekend-id"] })[3].lines[0];
    expect(line.endsWith("+3")).toBe(true);
    expect(line).not.toContain("onbekend");
  });

  it("leaves an unanswered group empty instead of inventing text", () => {
    expect(groups({ ...base, situation: "", purposeFollowUp: "", purpose: "" })[0].lines).toEqual([]);
  });
});
