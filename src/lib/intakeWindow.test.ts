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

type Panes = ReturnType<typeof buildWindowPanes>;
const byId = (panes: Panes) => Object.fromEntries(panes.map((p) => [p.id, p.value]));
const classic = (answers: IntakeAnswers, touched = new Set<string>()) => buildWindowPanes(answers, dict, defaults, touched);
const cards = (
  answers: IntakeAnswers,
  extras: Parameters<typeof buildWindowPanes>[4] = { interestLabels: [] },
  touched = new Set<string>(),
) => buildWindowPanes(answers, dict, defaults, touched, extras);

const cells = (panes: Panes) => panes.reduce((n, p) => n + (p.wide ? 2 : 1), 0);

describe("the window panes", () => {
  it("leaves every pane empty for a fresh wizard, in both wizards", () => {
    expect(classic(defaults).every((p) => p.value === null)).toBe(true);
    expect(cards(defaults).every((p) => p.value === null)).toBe(true);
  });

  it("fills the grid exactly: whole rows, no lonely pane", () => {
    expect(cells(classic(defaults)) % 2).toBe(0);
    expect(cells(cards(defaults)) % 2).toBe(0);
  });

  it("gives every answer of the wizard a pane, so no choice leaves the window unchanged", () => {
    const answers: IntakeAnswers = {
      ...defaults,
      situation: "Ik verveel me",
      purpose: "self",
      ageCategory: "45-54",
      location: "Zutphen",
      searchDistance: "hour",
      freeTimePattern: "spontaneous",
      practicalToWild: "wild",
      effort: "minimal",
      timeAvailable: "weekend",
      budget: "100",
      mustHaves: "geen groepen",
      company: ["friends"],
      solutionTypes: ["gift"],
      socialFormats: ["solo"],
      interests: [],
    };
    const touched = new Set(["ageCategory", "searchDistance", "practicalToWild", "effort", "timeAvailable", "budget"]);
    const wizards: [string, Panes][] = [
      ["classic", classic(answers, touched)],
      ["cards", cards(answers, { interestLabels: ["Yoga"], domainLabels: [] }, touched)],
    ];
    for (const [name, panes] of wizards) {
      const empty = panes.filter((p) => p.value === null).map((p) => p.id);
      expect(empty, name).toEqual([]);
    }
  });

  it("colours a pane by the wizard page it belongs to", () => {
    const groups = Object.fromEntries(cards(defaults).map((p) => [p.id, p.group]));
    expect(groups).toMatchObject({
      situation: "situation",
      purpose: "situation",
      age: "about",
      where: "about",
      distance: "about",
      saturday: "about",
      surprise: "dials",
      time: "dials",
      budget: "dials",
      effort: "dials",
      interests: "interests",
      how: "final",
      company: "final",
      limits: "final",
    });
    const classicGroups = Object.fromEntries(classic(defaults).map((p) => [p.id, p.group]));
    expect(classicGroups).toMatchObject({ open: "openness", limits: "openness", company: "final" });
  });

  it("does not count untouched sliders as answered, despite their defaults", () => {
    const values = byId(classic(defaults));
    for (const id of ["age", "distance", "surprise", "time", "budget", "effort"]) expect(values[id]).toBeNull();
  });

  it("counts a slider once it has been touched, even when left on its default", () => {
    expect(byId(classic(defaults, new Set(["budget"]))).budget).toBe("Tot €25");
    expect(byId(classic(defaults, new Set(["ageCategory"]))).age).toBe("35–44");
    expect(byId(classic(defaults, new Set(["searchDistance"]))).distance).toBe("Binnen mijn stad");
  });

  it("counts a slider whose value differs from the default (e.g. a restored draft)", () => {
    expect(byId(classic({ ...defaults, timeAvailable: "weekend" })).time).toBe("Een heel weekend");
    expect(byId(classic({ ...defaults, ageCategory: "55-64" })).age).toBe("55–64");
  });

  it("shows the situation, falling back to the purpose follow-up, and the goal on its own", () => {
    const withFollowUp = { ...defaults, purposeFollowUp: "Iets met mijn handen", purpose: "self" };
    expect(byId(classic(withFollowUp)).situation).toBe("Iets met mijn handen");
    expect(byId(classic(withFollowUp)).purpose).toBe("Iets te doen, alleen voor mezelf");
    expect(byId(classic({ ...withFollowUp, situation: "Ik verveel me al weken" })).situation).toBe("Ik verveel me al weken");
  });

  it("truncates long free text at a word boundary", () => {
    const long = "Ik zoek al heel lang naar iets wat me weer energie geeft en plezier in gewone dagen en avonden en weekenden";
    const value = byId(classic({ ...defaults, situation: long })).situation!;
    expect(value.endsWith("…")).toBe(true);
    expect(value.length).toBeLessThanOrEqual(85);
    const where = byId(classic({ ...defaults, location: "Een heel lange plaatsnaam met veel extra tekst erachter" })).where!;
    expect(where.length).toBeLessThanOrEqual(41);
  });

  it("maps the Saturday chip to its label and ignores whitespace-only text", () => {
    const values = byId(classic({ ...defaults, freeTimePattern: "spontaneous", location: "   " }));
    expect(values.saturday).toBe("Gewoon spontaan beslissen, ter plekke");
    expect(values.where).toBeNull();
  });
});

describe("the classic wizard panes", () => {
  it("shows who it is for and what they are open to", () => {
    const values = byId(classic({ ...defaults, company: ["friends", "partner"], solutionTypes: ["gift", "activity"] }));
    expect(values.company).toBe("Vrienden, Een partner");
    expect(values.open).toContain("cadeau");
    expect(values.limits).toBeNull();
  });
});

describe("the card wizard panes", () => {
  it("has a wide pane for the picks", () => {
    expect(cards(defaults).find((p) => p.id === "interests")?.wide).toBe(true);
  });

  it("shows as many picks as fit and how many more", () => {
    const labels = ["Hardlopen", "Yoga", "Schaken", "Origami"];
    expect(byId(cards(defaults, { interestLabels: labels })).interests).toBe("Hardlopen, Yoga, Schaken, Origami");
    const many = Array.from({ length: 12 }, (_, i) => `Activiteit ${i + 1}`);
    const value = byId(cards(defaults, { interestLabels: many })).interests!;
    expect(value).toMatch(/\+\d+$/);
    expect(value.length).toBeLessThanOrEqual(78 + 5);
  });

  it("shows the worlds until specific activities have been picked, and the picks after", () => {
    const withWorlds = cards(defaults, { interestLabels: [], domainLabels: ["Creatief & ambacht", "Natuur & dieren"] });
    expect(byId(withWorlds).interests).toBe("Creatief & ambacht, Natuur & dieren");
    const withPicks = cards(defaults, { interestLabels: ["Pottenbakken"], domainLabels: ["Creatief & ambacht"] });
    expect(byId(withPicks).interests).toBe("Pottenbakken");
  });

  it("shows 'surprise me' when they asked for it and picked nothing", () => {
    expect(byId(cards({ ...defaults, surpriseMe: true })).interests).toBe("Verras me");
  });

  it("shows how they like to do it and who joins, each in its own pane", () => {
    const values = byId(cards({ ...defaults, socialFormats: ["solo", "duo"], company: ["friends"] }));
    expect(values.how).toBe("Alleen, Met één ander");
    expect(values.company).toBe("Vrienden");
  });

  it("shows the hard limits", () => {
    expect(byId(cards({ ...defaults, mustHaves: "Geen groepen" })).limits).toBe("Geen groepen");
  });
});

describe("minutesLeft", () => {
  it("counts down over the five pages and never goes negative", () => {
    expect([0, 1, 2, 3, 4].map(minutesLeft)).toEqual([3, 2, 2, 1, 0]);
    expect(minutesLeft(9)).toBe(0);
    expect(minutesLeft(-1)).toBe(3);
  });
});
