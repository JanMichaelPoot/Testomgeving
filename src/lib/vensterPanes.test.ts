import { describe, expect, it } from "vitest";
import { buildSill, buildVensterPanes } from "@/lib/vensterPanes";
import { buildAssociationLibrary } from "@/lib/discovery/associations";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { parseMustHaves } from "@/lib/discovery/engine";
import { VENSTER_EDIT_PAGE, VENSTER_PAGES } from "@/lib/vensterPages";

const dict = getDictionary("nl");
const lib = { cards: buildAssociationLibrary("nl").cards, domains: [{ id: "nature", label: "Natuur" }] };

describe("buildVensterPanes", () => {
  it("fills each pane with the photos of its own step, in the order chosen", () => {
    const panes = buildVensterPanes(
      { interestDomains: ["nature"], associations: ["moment-clay", "place-workshop", "place-forest-edge"] },
      lib,
      dict.venster,
      { active: "moments", hrefs: { places: "/intake?edit=1&page=1" } },
    );
    expect(panes.map((p) => p.key)).toEqual(["worlds", "places", "moments", "senses"]);
    expect(panes[0].images).toEqual([{ src: "/illustrations/discovery/domains/nature.jpg", alt: "Natuur" }]);
    expect(panes[1].images.map((i) => i.alt)).toEqual(["Een werkplaats met zaagsel", "Een stille bosrand"]);
    expect(panes[2].active).toBe(true);
    expect(panes[1].href).toBe("/intake?edit=1&page=1");
    expect(panes[3].images).toEqual([]);
  });

  it("shows 'Verras me' instead of an empty worlds pane", () => {
    const [worlds] = buildVensterPanes({ surpriseMe: true, interestDomains: [] }, lib, dict.venster);
    expect(worlds.placeholder).toBe("Verras me");
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
  it("has eight screens and edit links that point at real ones", () => {
    expect(VENSTER_PAGES).toHaveLength(7);
    for (const page of Object.values(VENSTER_EDIT_PAGE)) expect(page).toBeLessThan(VENSTER_PAGES.length);
    expect(VENSTER_PAGES[VENSTER_EDIT_PAGE.room]).toBe("room");
    expect(VENSTER_PAGES[VENSTER_EDIT_PAGE.who]).toBe("who");
    expect(VENSTER_PAGES[VENSTER_EDIT_PAGE.profile]).toBe("profile");
    expect(VENSTER_PAGES.at(-1)).toBe("profile"); // the profile is the last screen, right before the checkout
  });

  it("has the same copy keys in both languages", () => {
    const keys = (o: object): string[] => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" && !Array.isArray(v) ? keys(v).map((x) => `${k}.${x}`) : [k]));
    expect(keys(getDictionary("en").venster)).toEqual(keys(getDictionary("nl").venster));
  });
});
