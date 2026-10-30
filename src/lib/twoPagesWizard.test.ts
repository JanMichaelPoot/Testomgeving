import { describe, expect, it } from "vitest";
import { TWO_PAGE_PAGES, VENSTER_PAGES, chapterOf, pagesFor } from "@/lib/vensterPages";
import { buildWindowItems } from "@/lib/vensterPanes";
import { images2WizardPercent } from "@/lib/vensterLanding";
import { buildAssociationLibrary } from "@/lib/discovery/associations";
import { buildConcretePool } from "@/lib/discovery/concretePool";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { layoutWindow } from "@/lib/windowLayout";
import { REGISTERS } from "@/lib/discovery/registerTypes";

describe("the two-page intake: screens", () => {
  it("has four screens (images, concrete, situation, profile) and keeps the four-round intake as it was", () => {
    expect(pagesFor("images2")).toEqual(["images", "concrete", "situation", "profile"]);
    expect(pagesFor(undefined)).toBe(VENSTER_PAGES);
    expect(TWO_PAGE_PAGES).toHaveLength(4);
  });

  it("puts both image pages in the first chapter, then the situation, then the profile", () => {
    expect(TWO_PAGE_PAGES.map(chapterOf)).toEqual([0, 0, 1, 2]);
    expect(VENSTER_PAGES.map(chapterOf)).toEqual([0, 0, 0, 0, 1, 2]);
  });

  it("is off by default and clamps the percentage", () => {
    expect(images2WizardPercent(undefined)).toBe(0);
    expect(images2WizardPercent("")).toBe(0);
    expect(images2WizardPercent("25")).toBe(25);
    expect(images2WizardPercent("400")).toBe(100);
    expect(images2WizardPercent("abc")).toBe(0);
  });
});

describe("what the browser gets for the two pages", () => {
  const lib = buildAssociationLibrary("nl", 7);
  const pool = buildConcretePool("nl", 7);

  it("gives every card a register, and the pool a register and a label per activity, in one language", () => {
    expect(lib.cards.every((c) => c.register && (REGISTERS as readonly string[]).includes(c.register))).toBe(true);
    expect(pool.activities.length).toBeGreaterThan(400);
    expect(pool.activities.every((a) => REGISTERS.includes(a.register) && a.label.length > 0)).toBe(true);
    expect(pool.activities[0]).not.toHaveProperty("scene");
    expect(pool.genericTags.length).toBeGreaterThan(3);
  });

  it("holds only what can be done in the month of asking", () => {
    const winter = new Set(buildConcretePool("nl", 1).activities.map((a) => a.id));
    const summer = new Set(buildConcretePool("nl", 7).activities.map((a) => a.id));
    expect(summer.has("open-water")).toBe(true);
    expect(winter.has("open-water")).toBe(false);
  });
});

describe("the window of the two-page intake", () => {
  const lib = buildAssociationLibrary("nl", 7);
  const pool = buildConcretePool("nl", 7);
  const dict = getDictionary("nl").venster;

  it("holds the chosen images and the chosen activities, in that order, with no direction panes", () => {
    const images = lib.cards.slice(0, 4).map((c) => c.id);
    const picks = pool.activities.slice(0, 3).map((a) => a.id);
    const items = buildWindowItems({ intakeFlow: "images2", associations: images, interests: picks, interestDomains: ["nature"] }, { cards: lib.cards, domains: [{ id: "nature", label: "Natuur" }], activities: pool.activities }, dict);
    expect(items.map((i) => i.kind)).toEqual(["images", "images", "images", "images", "picks", "picks", "picks"]);
    expect(items.slice(4).map((i) => i.image)).toEqual(picks.map((id) => `/illustrations/discovery/${id}.jpg`));
    // The same window layout takes it (3 to 24 panes, one per choice).
    expect(layoutWindow(items).panes.length).toBe(7);
  });

  it("is unchanged for the four-round intake: directions first, images by round, no activities", () => {
    const images = lib.cards.slice(0, 3).map((c) => c.id);
    const items = buildWindowItems({ associations: images, interestDomains: ["nature"], interests: ["wandelen"] }, { cards: lib.cards, domains: [{ id: "nature", label: "Natuur" }] }, dict);
    expect(items[0].kind).toBe("worlds");
    expect(items.some((i) => i.kind === "picks")).toBe(false);
    expect(items.length).toBe(4);
  });
});
