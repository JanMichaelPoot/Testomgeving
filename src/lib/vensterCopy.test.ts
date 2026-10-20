import { describe, expect, it } from "vitest";
import { vensterEn, vensterNl, type VensterDictionary } from "@/lib/i18n/venster";

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
      expect(Object.values(dict.chapters)).toHaveLength(4);
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
        dict.reflection.headingGift,
        dict.room.headingGift,
        dict.who.headingGift,
      ]) {
        expect(heading).toContain("{name}");
      }
    });

    it(`${name}: the self headings never talk about someone else`, () => {
      for (const heading of [dict.worlds.heading, dict.rounds.moments.heading, dict.reflection.heading, dict.room.heading, dict.who.heading]) {
        expect(heading).not.toContain("{name}");
      }
    });
  }

  it("has the same shape in nl and en", () => {
    const shape = (v: unknown): unknown =>
      Array.isArray(v) ? v.map(shape) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shape(x)])) : typeof v;
    expect(shape(vensterEn)).toEqual(shape(vensterNl));
  });
});
