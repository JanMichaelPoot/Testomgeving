import { describe, expect, it } from "vitest";
import { BOOK_COUNT, DOORS, IDEA_COUNT, WILDCARD_COUNT, doorRange, doorTexts, doorsSummary } from "./productStructure";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { LEVEL_NAMES } from "./discoveryLevels";

describe("product structure", () => {
  it("a book is six ideas and one wildcard, and the doors add up to that", () => {
    expect(IDEA_COUNT).toBe(6);
    expect(WILDCARD_COUNT).toBe(1);
    expect(BOOK_COUNT).toBe(7);
    expect(DOORS.reduce((sum, d) => sum + d.count, 0)).toBe(BOOK_COUNT);
    expect(DOORS.filter((d) => d.id !== "wildcard").reduce((sum, d) => sum + d.count, 0)).toBe(IDEA_COUNT);
    expect(DOORS[DOORS.length - 1].id).toBe("wildcard");
  });

  it("the dictionaries take the door names from the config, in nl and en", () => {
    for (const locale of ["nl", "en"] as const) {
      const doors = getDictionary(locale).plan.book.doors;
      expect(doors).toEqual(doorTexts(locale));
    }
  });

  it("the copy that describes the product reads from the config and never mentions levels", () => {
    expect(doorRange("nl")).toBe("Vertrouwd tot Uitdaging");
    expect(doorsSummary("en")).toBe("Familiar, Discovery, Unexpected, Stretch and Wildcard");
    for (const locale of ["nl", "en"] as const) {
      const dict = getDictionary(locale);
      const copy = JSON.stringify([dict.venster.checkout.whatYouGet, dict.landing.whatYouGetItems, dict.plan.reveal]);
      expect(copy).toContain(doorRange(locale));
      // The internal discovery levels stay out of everything a visitor reads.
      expect(copy).not.toMatch(/zeven niveaus|seven levels|Niveau \{n\}|Level \{n\}/i);
      for (const name of Object.values(LEVEL_NAMES[locale])) {
        // "Vertrouwd" / "Familiar" are door names too; only the level-only names must be gone.
        if (!DOORS.some((d) => d.label[locale] === name)) expect(JSON.stringify(dict.venster.checkout)).not.toContain(name);
      }
    }
  });
});
