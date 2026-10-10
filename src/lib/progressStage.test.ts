import { describe, expect, it } from "vitest";
import { activePhaseFor } from "./progressStage";
import { getDictionary } from "@/lib/i18n/dictionaries";

describe("activePhaseFor", () => {
  it("walks through the five phases as the stages advance", () => {
    expect([null, undefined, "selected", "researched", "written", "rendered"].map((s) => activePhaseFor(s as never))).toEqual([0, 0, 2, 3, 4, 5]);
  });

  it("has five phases in both languages", () => {
    for (const locale of ["nl", "en"] as const) expect(getDictionary(locale).plan.generating.phases).toHaveLength(5);
  });

  it("never promises less than a minute any more", () => {
    for (const locale of ["nl", "en"] as const) {
      const text = JSON.stringify(getDictionary(locale));
      expect(text).not.toMatch(/minder dan een minuut|binnen een minuut|under a minute|within a minute/i);
    }
  });
});
