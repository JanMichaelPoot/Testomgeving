import { describe, expect, it } from "vitest";
import { vensterEn, vensterNl, type VensterDictionary } from "@/lib/i18n/venster";
import { parseMustHaves } from "@/lib/discovery/engine/constraints";

// R1.1: the first group of images is called "direction" (Richting / Direction), not "worlds",
// everywhere the person sees it. The internal names (interestDomains, dict.worlds, ...) stay.

function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

const both: [string, VensterDictionary][] = [
  ["nl", vensterNl],
  ["en", vensterEn],
];

describe("image intake copy (R1.1)", () => {
  for (const [name, dict] of both) {
    it(`${name}: no visible text calls the directions "worlds"`, () => {
      const hits = strings(dict).filter((t) => /wereld|world/i.test(t));
      expect(hits).toEqual([]);
    });

    it(`${name}: the stepper and the pane labels follow the agreed names`, () => {
      expect(Object.values(dict.chapters)).toHaveLength(3);
      expect(dict.panes.worlds).toBe(name === "nl" ? "Richting" : "Direction");
      expect(dict.panes.places).toBe(name === "nl" ? "Plek" : "Place");
      expect(dict.panes.moments).toBe("Moment");
      expect(dict.panes.senses).toBe(name === "nl" ? "Zintuig" : "Sense");
    });

    it(`${name}: every screen that has a gift heading keeps {name} in it`, () => {
      for (const heading of [
        dict.worlds.headingGift,
        dict.rounds.places.headingGift,
        dict.rounds.moments.headingGift,
        dict.rounds.senses.headingGift,
        dict.profile.headingGift,
        dict.situation.headingGift,
      ]) {
        expect(heading).toContain("{name}");
      }
    });

    it(`${name}: the self headings never talk about someone else`, () => {
      for (const heading of [dict.worlds.heading, dict.rounds.moments.heading, dict.profile.heading, dict.situation.heading]) {
        expect(heading).not.toContain("{name}");
      }
    });
  }

  for (const [name, dict] of both) {
    it(`${name}: the budget question already covers "free", so there is no such hard limit chip`, () => {
      expect(dict.who.limitChips.filter((c) => /gratis|free/i.test(c))).toEqual([]);
    });
  }

  it("still reads a typed wish for something free as a constraint", () => {
    expect(parseMustHaves("Het moet gratis zijn").free).toBe(true);
    expect(parseMustHaves("must be free of charge").free).toBe(true);
  });

  it("has the same shape in nl and en", () => {
    const shape = (v: unknown): unknown =>
      Array.isArray(v) ? v.map(shape) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shape(x)])) : typeof v;
    expect(shape(vensterEn)).toEqual(shape(vensterNl));
  });
});
