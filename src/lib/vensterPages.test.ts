import { describe, expect, it } from "vitest";
import { DRAFT_VERSION, VENSTER_PAGES, migrateDraftPage } from "@/lib/vensterPages";

describe("migrateDraftPage", () => {
  it("leaves a current draft alone, clamped to the real pages", () => {
    for (let p = 0; p < VENSTER_PAGES.length; p++) expect(migrateDraftPage(p, DRAFT_VERSION)).toBe(p);
    expect(migrateDraftPage(99, DRAFT_VERSION)).toBe(VENSTER_PAGES.length - 1);
    expect(migrateDraftPage(-3, DRAFT_VERSION)).toBe(0);
  });

  it("maps a draft of the seven screens of before (room, who, profile) to the same screen, or the closest one", () => {
    const name = (old: number) => VENSTER_PAGES[migrateDraftPage(old, 2)];
    expect([0, 1, 2, 3].map(name)).toEqual(["worlds", "places", "moments", "senses"]);
    expect(name(4)).toBe("situation"); // room
    expect(name(5)).toBe("situation"); // who: merged with room
    expect(name(6)).toBe("profile");
  });

  it("maps a draft of the first eight screens to the same screen, or the closest one", () => {
    // first layout: worlds places moments senses reflection room who extra
    const name = (old: number) => VENSTER_PAGES[migrateDraftPage(old, undefined)];
    expect([0, 1, 2, 3].map(name)).toEqual(["worlds", "places", "moments", "senses"]);
    expect(name(4)).toBe("situation"); // the old reflection screen is gone: on to the first practical screen
    expect(name(5)).toBe("situation");
    expect(name(6)).toBe("situation");
    expect(name(7)).toBe("profile"); // the old open question lives on the profile screen now
  });

  it("copes with garbage instead of crashing", () => {
    expect(migrateDraftPage(Number.NaN, undefined)).toBe(0);
    expect(migrateDraftPage(1000, undefined)).toBe(VENSTER_PAGES.length - 1);
    expect(migrateDraftPage(1000, 2)).toBe(VENSTER_PAGES.length - 1);
    expect(migrateDraftPage(2.7, undefined)).toBe(2);
  });
});
