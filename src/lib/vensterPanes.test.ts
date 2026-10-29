import { describe, expect, it } from "vitest";
import { buildSill, buildWindowItems, levelFromNovelty, windowImageHref } from "@/lib/vensterPanes";
import { buildAssociationLibrary } from "@/lib/discovery/associations";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { parseMustHaves } from "@/lib/discovery/engine";
import { VENSTER_EDIT_PAGE, VENSTER_PAGES } from "@/lib/vensterPages";

const dict = getDictionary("nl");
const lib = { cards: buildAssociationLibrary("nl").cards, domains: [{ id: "nature", label: "Natuur" }] };

describe("buildWindowItems", () => {
  const answers = { interestDomains: ["nature"], associations: ["moment-clay", "place-workshop", "place-forest-edge"] };

  it("lists the directions first, then the images in the order they were chosen, each in its own kind", () => {
    const items = buildWindowItems(answers, lib, dict.venster);
    expect(items.map((i) => i.id)).toEqual(["w:nature", "moment-clay", "place-workshop", "place-forest-edge"]);
    expect(items.map((i) => i.kind)).toEqual(["worlds", "moments", "places", "places"]);
    expect(items[0]).toMatchObject({ image: "/illustrations/discovery/domains/nature.jpg", label: "Natuur", weight: 0.8, tags: ["nature"] });
    expect(items[2].label).toBe("Een werkplaats met zaagsel");
  });

  it("gives every image a weight between 0 and 1 (the strongest is 1) and a level from 1 to 7", () => {
    const items = buildWindowItems(answers, lib, dict.venster).filter((i) => i.kind !== "worlds");
    expect(Math.max(...items.map((i) => i.weight))).toBe(1);
    for (const i of items) {
      expect(i.weight).toBeGreaterThanOrEqual(0);
      expect(i.weight).toBeLessThanOrEqual(1);
      expect(Number.isInteger(i.level)).toBe(true);
      expect(i.level).toBeGreaterThanOrEqual(1);
      expect(i.level).toBeLessThanOrEqual(7);
    }
  });

  it("maps the novelty axis to the seven levels", () => {
    expect(levelFromNovelty(-1)).toBe(1);
    expect(levelFromNovelty(0)).toBe(4);
    expect(levelFromNovelty(1)).toBe(7);
    expect(levelFromNovelty(5)).toBe(7);
  });

  it("shows 'Verras me' as one placeholder pane instead of nothing", () => {
    const [first] = buildWindowItems({ surpriseMe: true, interestDomains: [] }, lib, dict.venster);
    expect(first).toMatchObject({ kind: "worlds", placeholder: "Verras me" });
    expect(first.image).toBeUndefined();
  });

  it("ignores an unknown image id instead of failing", () => {
    expect(buildWindowItems({ associations: ["place-forest-edge", "bestaat-niet"] }, lib, dict.venster).map((i) => i.id)).toEqual(["place-forest-edge"]);
  });
});

describe("windowImageHref", () => {
  it("carries ids only, directions as w:<id>", () => {
    expect(windowImageHref({ interestDomains: ["nature"], associations: ["place-forest-edge"] })).toBe("/api/window-image?c=w%3Anature%2Cplace-forest-edge");
  });

  it("is null when nothing was chosen, and asks for the surprise pane when only that was", () => {
    expect(windowImageHref({})).toBeNull();
    expect(windowImageHref({ surpriseMe: true, interestDomains: [] })).toBe("/api/window-image?s=1");
  });
});

describe("buildSill", () => {
  it("puts the text answers on one line", () => {
    expect(buildSill({ location: "Laren, Noord-Holland", timeAvailable: "halfday", budget: "25", company: ["partner"] }, dict.intake, dict.venster)).toBe(
      "Laren · Een halve dag · Tot €25 · met een partner",
    );
    expect(buildSill({ company: ["alone"] }, dict.intake, dict.venster)).toBe("Alleen ik");
    expect(buildSill({}, dict.intake, dict.venster)).toBe("");
  });
});

describe("the image intake's limit chips", () => {
  for (const locale of ["nl", "en"] as const) {
    it(`are all understood by the must-have parser (${locale})`, () => {
      for (const chip of getDictionary(locale).venster.who.limitChips) {
        const r = parseMustHaves(chip);
        const understood = r.setting !== null || r.noGroups || r.free || r.verify.length > 0;
        expect(understood, chip).toBe(true);
      }
    });
  }
});

describe("venster pages", () => {
  it("has six screens and edit links that point at real ones", () => {
    expect(VENSTER_PAGES).toHaveLength(6);
    for (const page of Object.values(VENSTER_EDIT_PAGE)) expect(page).toBeLessThan(VENSTER_PAGES.length);
    expect(VENSTER_PAGES[VENSTER_EDIT_PAGE.situation]).toBe("situation");
    expect(VENSTER_PAGES[VENSTER_EDIT_PAGE.profile]).toBe("profile");
    expect(VENSTER_PAGES.at(-1)).toBe("profile"); // the profile is the last screen, and it holds the payment
  });

  it("has the same copy keys in both languages", () => {
    const keys = (o: object): string[] => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" && !Array.isArray(v) ? keys(v).map((x) => `${k}.${x}`) : [k]));
    expect(keys(getDictionary("en").venster)).toEqual(keys(getDictionary("nl").venster));
  });
});
