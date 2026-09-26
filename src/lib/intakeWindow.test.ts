import { describe, expect, it } from "vitest";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { IntakeAnswers } from "@/app/intake/actions";
import { buildWindowPanes, minutesLeft } from "./intakeWindow";

const dict = getDictionary("nl").intake;

const defaults: IntakeAnswers = {
  situation: "",
  purpose: "",
  purposeFollowUp: "",
  ageCategory: "35-44",
  location: "",
  searchDistance: "city",
  freeTimePattern: "",
  practicalToWild: "either",
  timeAvailable: "halfday",
  budget: "25",
  effort: "some",
  solutionTypes: [],
  mustHaves: "",
  preferences: "",
  personalReflection: "",
  company: [],
};

const byId = (panes: ReturnType<typeof buildWindowPanes>) =>
  Object.fromEntries(panes.map((p) => [p.id, p.value]));

describe("buildWindowPanes", () => {
  it("has 8 panes and leaves every one empty for a fresh wizard", () => {
    const panes = buildWindowPanes(defaults, dict, defaults, new Set());
    expect(panes).toHaveLength(8);
    expect(panes.every((p) => p.value === null)).toBe(true);
  });

  it("does not count untouched sliders as answered, despite their defaults", () => {
    const values = byId(buildWindowPanes(defaults, dict, defaults, new Set()));
    expect(values.surprise).toBeNull();
    expect(values.time).toBeNull();
    expect(values.budget).toBeNull();
    expect(values.effort).toBeNull();
  });

  it("counts a slider once it has been touched, even when left on its default", () => {
    const values = byId(buildWindowPanes(defaults, dict, defaults, new Set(["budget"])));
    expect(values.budget).toBe("Tot €25");
  });

  it("counts a slider whose value differs from the default (e.g. a restored draft)", () => {
    const answers = { ...defaults, timeAvailable: "weekend" };
    const values = byId(buildWindowPanes(answers, dict, defaults, new Set()));
    expect(values.time).toBe("Een heel weekend");
  });

  it("shows the situation, falling back to the purpose follow-up", () => {
    const withFollowUp = { ...defaults, purposeFollowUp: "Iets met mijn handen" };
    expect(byId(buildWindowPanes(withFollowUp, dict, defaults, new Set())).situation).toBe(
      "Iets met mijn handen"
    );
    const withBoth = { ...withFollowUp, situation: "Ik verveel me al weken" };
    expect(byId(buildWindowPanes(withBoth, dict, defaults, new Set())).situation).toBe(
      "Ik verveel me al weken"
    );
  });

  it("truncates long free text at a word boundary", () => {
    const long = "Ik zoek al heel lang naar iets wat me weer energie geeft en plezier in gewone dagen";
    const value = byId(buildWindowPanes({ ...defaults, situation: long }, dict, defaults, new Set())).situation!;
    expect(value.endsWith("…")).toBe(true);
    expect(value.length).toBeLessThanOrEqual(49);
  });

  it("maps the Saturday chip to its localised label and ignores whitespace-only text", () => {
    const answers = { ...defaults, freeTimePattern: "spontaneous", location: "   " };
    const values = byId(buildWindowPanes(answers, dict, defaults, new Set()));
    expect(values.saturday).toBe("Gewoon spontaan beslissen, ter plekke");
    expect(values.where).toBeNull();
  });
});

describe("minutesLeft", () => {
  it("counts down over the five pages and never goes negative", () => {
    expect([0, 1, 2, 3, 4].map(minutesLeft)).toEqual([3, 2, 2, 1, 0]);
    expect(minutesLeft(9)).toBe(0);
    expect(minutesLeft(-1)).toBe(3);
  });
});

describe("buildWindowPanes for the card wizard", () => {
  it("swaps the Saturday pane for what they picked", () => {
    const panes = buildWindowPanes(defaults, dict, defaults, new Set(), { interestLabels: [] });
    expect(panes).toHaveLength(8);
    expect(panes.map((p) => p.id)).toContain("interests");
    expect(panes.map((p) => p.id)).not.toContain("saturday");
  });

  it("shows the first two picks and how many more", () => {
    const labels = ["Hardlopen", "Yoga", "Schaken", "Origami"];
    const values = byId(buildWindowPanes(defaults, dict, defaults, new Set(), { interestLabels: labels }));
    expect(values.interests).toBe("Hardlopen, Yoga +2");
  });

  it("shows 'surprise me' when they asked for it and picked nothing", () => {
    const values = byId(buildWindowPanes({ ...defaults, surpriseMe: true }, dict, defaults, new Set(), { interestLabels: [] }));
    expect(values.interests).toBe("Verras me");
  });

  it("leaves the pane empty when nothing was chosen", () => {
    expect(byId(buildWindowPanes(defaults, dict, defaults, new Set(), { interestLabels: [] })).interests).toBeNull();
  });
});
