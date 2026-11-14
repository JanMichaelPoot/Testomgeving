import { describe, expect, it } from "vitest";
import {
  SETTLING_MS,
  SILENT_MAX_AGE_DAYS,
  loadQuietSupply,
  parseCacheKey,
  quietActivities,
  requestedPlace,
  supplyIndexEnabled,
  type CacheEvidenceRow,
} from "@/lib/claude/supplyIndex";

// What earlier research says about a place (Stap 195, R1): pure rules over cached rows, no database.

const NOW = Date.parse("2026-11-14T12:00:00Z");
const DAY = 86_400_000;
const daysAgo = (n: number) => new Date(NOW - n * DAY).toISOString();
const row = (activity_id: string, place_key: string, options: unknown[], ageDays = 10): CacheEvidenceRow => ({ activity_id, place_key, searched_at: daysAgo(ageDays), options });
const FOUND = [{ name: "Studio" }];
const req = { place: "laren", radiusKm: 15 };

describe("parseCacheKey", () => {
  it("reads the place, the radius and the version of a physical search, whatever pass or needs follow", () => {
    expect(parseCacheKey("laren|25km|v6")).toEqual({ place: "laren", radiusKm: 25, epoch: "v6" });
    expect(parseCacheKey("laren|15km|v6|broad|n:evening+quiet")).toEqual({ place: "laren", radiusKm: 15, epoch: "v6" });
    expect(parseCacheKey("de:berlin|10km|v6")).toEqual({ place: "de:berlin", radiusKm: 10, epoch: "v6" });
  });

  it("reads the older keys, with a month and with the older radius classes", () => {
    expect(parseCacheKey("laren|city|2026-10|v6")).toEqual({ place: "laren", radiusKm: 15, epoch: "v6" });
    expect(parseCacheKey("laren|region|2026-10|v5")).toEqual({ place: "laren", radiusKm: 75, epoch: "v5" });
  });

  it("is no evidence about a place for the online answers, the whole country, or anything it does not know", () => {
    expect(parseCacheKey("online|v6|online")).toBeNull();
    expect(parseCacheKey("online|2026-10|v6|online")).toBeNull();
    expect(parseCacheKey("nl|nl|v6")).toBeNull();
    expect(parseCacheKey("laren|sideways|v6")).toBeNull();
    expect(parseCacheKey("laren")).toBeNull();
  });
});

describe("requestedPlace", () => {
  it("names the place and the radius of a request, the way the cache keys do", () => {
    expect(requestedPlace("Gemeente Laren", "city", 25, null)).toEqual({ place: "laren", radiusKm: 25 });
    expect(requestedPlace("Laren (NH)", "city", undefined, "NL")).toEqual({ place: "laren", radiusKm: 15 });
    expect(requestedPlace("Berlin", "city", 10, "DE")).toEqual({ place: "de:berlin", radiusKm: 10 });
  });

  it("has none for a search of the whole country", () => {
    expect(requestedPlace("Laren", "anywhere", undefined, null)).toBeNull();
    expect(requestedPlace("Laren", "city", 150, null)).toBeNull();
  });
});

describe("quietActivities", () => {
  it("calls an activity quiet when two different searches near this place found nothing", () => {
    const rows = [row("larp", "laren|15km|v6", []), row("larp", "laren|15km|v6|broad", [])];
    expect(quietActivities(rows, req, NOW)).toEqual(["larp"]);
  });

  it("does not on one empty answer: that is often only a search that was too thin", () => {
    expect(quietActivities([row("larp", "laren|15km|v6", [])], req, NOW)).toEqual([]);
  });

  it("not when something was found for it near this place, at any radius, in any version", () => {
    const empties = [row("larp", "laren|15km|v6", []), row("larp", "laren|15km|v6|broad", [])];
    expect(quietActivities([...empties, row("larp", "laren|50km|v6", FOUND)], req, NOW)).toEqual([]);
    expect(quietActivities([...empties, row("larp", "laren|city|2026-03|v4", FOUND, 200)], req, NOW)).toEqual([]);
  });

  it("counts an empty answer for a radius only when it was asked at least as wide", () => {
    // For a request of 15 km, "nothing within 25 km" and "nothing within 15 km" are both valid evidence; "nothing within 5 km" is not.
    const wide = [row("larp", "laren|25km|v6", []), row("larp", "laren|15km|v6", [])];
    expect(quietActivities(wide, req, NOW)).toEqual(["larp"]);
    const narrow = [row("larp", "laren|5km|v6", []), row("larp", "laren|10km|v6", [])];
    expect(quietActivities(narrow, req, NOW)).toEqual([]);
    expect(quietActivities(narrow, { place: "laren", radiusKm: 5 }, NOW)).toEqual(["larp"]);
  });

  it("only trusts empty answers of the current research version and not older than a few months", () => {
    expect(quietActivities([row("larp", "laren|15km|v5", []), row("larp", "laren|15km|v5|broad", [])], req, NOW)).toEqual([]);
    const old = SILENT_MAX_AGE_DAYS + 1;
    expect(quietActivities([row("larp", "laren|15km|v6", [], old), row("larp", "laren|15km|v6|broad", [], old)], req, NOW)).toEqual([]);
    expect(quietActivities([row("larp", "laren|15km|v6", [], old), row("larp", "laren|15km|v6|broad", [])], req, NOW)).toEqual([]); // one is too old: one left
  });

  it("ignores rows of other places, the online answers, and rows younger than the settling time", () => {
    const other = [row("larp", "blaricum|15km|v6", []), row("larp", "blaricum|15km|v6|broad", [])];
    expect(quietActivities(other, req, NOW)).toEqual([]);
    const online = [row("larp", "online|v6|online", []), row("larp", "laren|15km|v6", [])];
    expect(quietActivities(online, req, NOW)).toEqual([]);
    // The warm-up writes its answers a minute before the real generation reads the index: both must see the same index.
    const fresh = (key: string): CacheEvidenceRow => ({ activity_id: "larp", place_key: key, searched_at: new Date(NOW - SETTLING_MS / 2).toISOString(), options: [] });
    expect(quietActivities([fresh("laren|15km|v6"), fresh("laren|15km|v6|broad")], req, NOW)).toEqual([]);
  });

  it("counts the same answer in two languages once", () => {
    // The cache holds a nl and an en row for one key; they are one observation, not two.
    expect(quietActivities([row("larp", "laren|15km|v6", []), row("larp", "laren|15km|v6", [])], req, NOW)).toEqual([]);
  });

  it("returns the ids in a fixed order", () => {
    const rows = ["zang", "boogschieten", "larp"].flatMap((id) => [row(id, "laren|15km|v6", []), row(id, "laren|15km|v6|broad", [])]);
    expect(quietActivities(rows, req, NOW)).toEqual(["boogschieten", "larp", "zang"]);
  });
});

describe("the loader", () => {
  it("is off with WINDOW_SUPPLY_INDEX=0 and then reads nothing", async () => {
    expect(supplyIndexEnabled({})).toBe(true);
    for (const off of ["0", "false", "off", "No"]) expect(supplyIndexEnabled({ WINDOW_SUPPLY_INDEX: off })).toBe(false);
    // The test environment switches it off (vitest.config.ts): no database is asked.
    expect(await loadQuietSupply({ location: "Laren", searchDistance: "city", searchDistanceKm: 15 })).toEqual([]);
  });
});
