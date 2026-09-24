import { describe, expect, it } from "vitest";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { pickLayout } from "./PillSlider";

const labels = (options: { label: string }[]) => options.map((o) => o.label);

describe("pickLayout", () => {
  for (const locale of ["nl", "en"] as const) {
    const dict = getDictionary(locale).intake;

    it(`stacks the long-label dials in ${locale}`, () => {
      expect(pickLayout(labels(dict.practicalToWild.options))).toBe("stack");
      expect(pickLayout(labels(dict.effort.options))).toBe("stack");
    });

    it(`keeps the short 4-option dials in one row in ${locale}`, () => {
      expect(pickLayout(labels(dict.timeAvailable.options))).toBe("row");
      expect(pickLayout(labels(dict.budget.options))).toBe("row");
      expect(pickLayout(labels(dict.searchDistance.options))).toBe("row");
    });

    it(`wraps the age brackets in ${locale}`, () => {
      expect(pickLayout(labels(dict.ageCategory.options))).toBe("wrap");
    });
  }
});
