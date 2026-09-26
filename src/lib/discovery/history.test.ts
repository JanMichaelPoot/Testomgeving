import { describe, expect, it } from "vitest";
import {
  HISTORY_MONTHS,
  hashDeviceId,
  historyCutoff,
  isValidDeviceId,
  newDeviceId,
  recentlyShown,
} from "@/lib/discovery/history";
import { defaultEngineLibrary, selectSeeds, type EngineInput } from "@/lib/discovery/engine";

describe("device id", () => {
  it("makes valid, unique ids and accepts nothing else back from the browser", () => {
    const a = newDeviceId();
    expect(isValidDeviceId(a)).toBe(true);
    expect(newDeviceId()).not.toBe(a);
    for (const bad of ["", "abc", "1234", undefined, null, 42, `${a}x`, "x' or 1=1 --"]) expect(isValidDeviceId(bad)).toBe(false);
  });

  it("stores a stable hash, never the id itself", () => {
    const id = newDeviceId();
    expect(hashDeviceId(id)).toBe(hashDeviceId(id));
    expect(hashDeviceId(id)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashDeviceId(id)).not.toContain(id);
    expect(hashDeviceId(id)).not.toBe(hashDeviceId(newDeviceId()));
  });
});

describe("historyCutoff", () => {
  it("is twelve months back", () => {
    expect(HISTORY_MONTHS).toBe(12);
    expect(historyCutoff(new Date("2026-09-26T10:00:00.000Z"))).toBe("2025-09-26T10:00:00.000Z");
  });
});

describe("recentlyShown", () => {
  const row = (created_at: string, ...activity_ids: string[]) => ({ created_at, activity_ids });

  it("keeps out what the last two books showed, newest first, without duplicates", () => {
    const rows = [row("2026-01-01T00:00:00Z", "a", "b"), row("2026-03-01T00:00:00Z", "c", "d"), row("2026-02-01T00:00:00Z", "d", "e")];
    expect(recentlyShown(rows).sort()).toEqual(["c", "d", "e"]);
  });

  it("does not count a paid book that has not been generated yet", () => {
    const rows = [row("2026-03-01T00:00:00Z"), row("2026-02-01T00:00:00Z", "x"), row("2026-01-01T00:00:00Z", "y")];
    expect(recentlyShown(rows).sort()).toEqual(["x", "y"]);
  });

  it("is empty without history", () => {
    expect(recentlyShown([])).toEqual([]);
  });
});

// E3 with real history: three books in a row for the same device never show the same
// activity in two consecutive books, unless the person picked it again.
describe("three books in a row for one device (E3)", () => {
  const lib = defaultEngineLibrary();
  const BASE: EngineInput = {
    interests: [],
    interestDomains: ["creative", "outdoors"],
    socialFormats: [],
    practicalToWild: "either",
    budget: "100",
    effort: "some",
    timeAvailable: "halfday",
    ageCategory: "35-44",
    mustHaves: "",
    seed: "s",
  };

  it("does not repeat between consecutive books", () => {
    const rows: { activity_ids: string[]; created_at: string }[] = [];
    const books: string[][] = [];
    for (let i = 0; i < 3; i++) {
      const history = recentlyShown(rows);
      const ids = selectSeeds({ ...BASE, history, seed: `book-${i}` }, lib).seeds.map((s) => s.activityId);
      rows.push({ activity_ids: ids, created_at: `2026-0${i + 1}-01T00:00:00Z` });
      books.push(ids);
    }
    for (let i = 1; i < books.length; i++) {
      expect(books[i].filter((id) => books[i - 1].includes(id))).toEqual([]);
    }
  });
});
