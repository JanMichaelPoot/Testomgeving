import { describe, expect, it } from "vitest";
import { describeToday, inSeason, isoDateNL, currentMonth, seasonOf } from "@/lib/discovery/season";
import { ALL_ACTIVITIES, getActivity } from "@/lib/discovery/library";
import { buildCardLibrary } from "@/lib/discovery/cardLibrary";
import { associationsToEngineInput, buildAssociationLibrary } from "@/lib/discovery/associations";

describe("seasons", () => {
  it("reads the month in the Netherlands, not in the server's zone", () => {
    expect(currentMonth(new Date("2026-10-25T10:00:00Z"))).toBe(10);
    // 23:30 UTC on 31 October is already 1 November in Amsterdam
    expect(currentMonth(new Date("2026-10-31T23:30:00Z"))).toBe(11);
    expect(isoDateNL(new Date("2026-10-31T23:30:00Z"))).toBe("2026-11-01");
    expect(isoDateNL(new Date("2026-07-01T10:00:00Z"))).toBe("2026-07-01");
  });

  it("names the meteorological seasons", () => {
    expect([12, 1, 2].map(seasonOf)).toEqual(["winter", "winter", "winter"]);
    expect([3, 4, 5].map(seasonOf)).toEqual(["spring", "spring", "spring"]);
    expect([6, 7, 8].map(seasonOf)).toEqual(["summer", "summer", "summer"]);
    expect([9, 10, 11].map(seasonOf)).toEqual(["autumn", "autumn", "autumn"]);
  });

  it("describes today for a prompt, in both languages", () => {
    const now = new Date("2026-10-25T10:00:00Z");
    expect(describeToday(now, "en")).toBe("25 October 2026 (autumn)");
    expect(describeToday(now, "nl")).toBe("25 oktober 2026 (herfst)");
  });

  it("inSeason: no months means all year, no month means no filter", () => {
    expect(inSeason({}, 1)).toBe(true);
    expect(inSeason({ months: [6, 7] }, 7)).toBe(true);
    expect(inSeason({ months: [6, 7] }, 10)).toBe(false);
    expect(inSeason({ months: [6, 7] }, null)).toBe(true);
    expect(inSeason({ months: [6, 7] }, undefined)).toBe(true);
  });
});

describe("the library's seasons", () => {
  it("knows the clearly seasonal activities", () => {
    expect(getActivity("open-water")?.months).toEqual([6, 7, 8, 9]);
    expect(getActivity("schaatsen")?.months).toEqual([10, 11, 12, 1, 2, 3]);
    expect(getActivity("paddenstoelen")?.months).toEqual([9, 10, 11]);
    expect(getActivity("hardlopen")?.months).toBeUndefined();
  });

  it("leaves something to do in every month of the year in every domain that is not only seasonal", () => {
    for (let month = 1; month <= 12; month++) {
      const open = ALL_ACTIVITIES.filter((a) => inSeason(a, month));
      expect(open.length, `month ${month}`).toBeGreaterThan(150);
    }
  });
});

describe("what the wizards offer", () => {
  it("the card wizard does not offer an activity that cannot be done this month", () => {
    const ids = (month?: number) => new Set(buildCardLibrary("nl", month).activities.map((a) => a.id));
    expect(ids(1).has("open-water")).toBe(false);
    expect(ids(7).has("open-water")).toBe(true);
    expect(ids(7).has("schaatsen")).toBe(false);
    expect(ids().has("schaatsen")).toBe(true); // no month: everything, as before
  });

  it("the examples under the directions are in season too", () => {
    const labels = (month: number) => Object.values(buildAssociationLibrary("nl", month).worldExamples ?? {}).flat().map((e) => e.label);
    expect(labels(1)).not.toContain("Zwemmen in open water");
    expect(labels(7)).toContain("Zwemmen in open water");
    expect(labels(7)).not.toContain("Schaatsen");
  });

  it("the activities read from the images are in season in the month of asking", () => {
    const base = {
      associationIds: ["place-still-water", "moment-stillness", "sense-wind"],
      interestDomains: ["nature"],
      constraints: { budget: "allin", timeAvailable: "halfday", mustHaves: "", socialFormats: [], ageCategory: "35-44" },
      seed: "season",
    };
    const winter = associationsToEngineInput({ ...base, month: 1 }).interests;
    expect(winter).not.toContain("open-water");
    for (const id of winter) expect(inSeason(getActivity(id)!, 1), id).toBe(true);
    for (const id of associationsToEngineInput({ ...base, month: 7 }).interests) expect(inSeason(getActivity(id)!, 7), id).toBe(true);
  });
});
