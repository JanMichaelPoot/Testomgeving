import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { activePhaseFor, elapsedSince, isStalled, mergeProgressMeta, phaseLabels, STALL_AFTER_MS } from "./progressStage";
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


describe("phaseLabels", () => {
  for (const locale of ["nl", "en"] as const) {
    const copy = getDictionary(locale).plan.generating;

    it(`${locale}: shows the real numbers on finished steps, with the place when known`, () => {
      const labels = phaseLabels(copy, 3, { ideas: 7, places: 12 }, "Laren");
      expect(labels[1]).toContain("7");
      expect(labels[2]).toContain("12");
      expect(labels[2]).toContain("Laren");
      expect(labels[3]).toBe(copy.phases[3]);
      expect(labels[4]).toBe(copy.phases[4]);
    });

    it(`${locale}: leaves the number out (never invents one) when nothing was recorded`, () => {
      const labels = phaseLabels(copy, 3, null, "Laren");
      expect(labels[1]).toBe(copy.phasesDone[1]);
      expect(labels[2]).toBe(copy.phasesDone[2]);
      expect(labels.join(" ")).not.toMatch(/\d/);
      // zero places found is not a number worth showing either
      expect(phaseLabels(copy, 3, { ideas: 7, places: 0 }, null)[2]).toBe(copy.phasesDone[2]);
    });

    it(`${locale}: uses the version without a place when the place is unknown`, () => {
      const label = phaseLabels(copy, 3, { places: 4 }, null)[2];
      expect(label).toContain("4");
      expect(label).not.toContain("{place}");
      expect(label).not.toContain("{n}");
    });

    it(`${locale}: has a past-tense line for every step and the stalled and order texts`, () => {
      expect(copy.phasesDone).toHaveLength(5);
      expect(copy.doorsDone).toContain("{n}");
      expect(copy.placesDone).toContain("{n}");
      expect(copy.placesDoneNear).toContain("{place}");
      expect(copy.orderRef).toContain("{ref}");
      expect(copy.stalledOrder.length).toBeGreaterThan(20);
      expect(copy.stalledGeneric.length).toBeGreaterThan(20);
    });
  }

  it("does not say the book is being made any more in the title", () => {
    expect(getDictionary("nl").plan.generating.heading).toBe("We openen je venster…");
  });
});

describe("elapsedSince and isStalled", () => {
  it("measures from the row's own timestamp and survives garbage", () => {
    const start = "2026-10-21T10:00:00.000Z";
    expect(elapsedSince(start, Date.parse(start) + 65_000)).toBe(65_000);
    expect(elapsedSince(start, Date.parse(start) - 5_000)).toBe(0);
    expect(elapsedSince(null, 1)).toBeNull();
    expect(elapsedSince("not a date", 1)).toBeNull();
  });

  it("calls a generation stalled only from the threshold on", () => {
    expect(isStalled(STALL_AFTER_MS - 1)).toBe(false);
    expect(isStalled(STALL_AFTER_MS)).toBe(true);
  });
});

describe("the opening panes of the window", () => {
  it("are visible without relying on a Tailwind variant that generates nothing", () => {
    const frame = readFileSync(path.join(process.cwd(), "src/components/window/WindowFrame.tsx"), "utf8");
    const css = readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");
    // motion-safe:opacity-0 without a working animation left every pane invisible for good.
    expect(frame).not.toMatch(/motion-safe:opacity-0/);
    expect(css).toMatch(/\.window-pane-open\s*{[^}]*animation:[^}]*backwards/);
    expect(css).not.toMatch(/\.window-pane-open\s*{[^}]*opacity:\s*0/);
  });
});

describe("mergeProgressMeta", () => {
  it("keeps the numbers of earlier steps when a later step adds its own", () => {
    const afterSelected = mergeProgressMeta(null, { ideas: 7 });
    expect(mergeProgressMeta(afterSelected, { places: 10 })).toEqual({ ideas: 7, places: 10 });
  });

  it("copes with nothing recorded and never mutates its input", () => {
    const prev = { ideas: 7 };
    expect(mergeProgressMeta(prev, undefined)).toEqual({ ideas: 7 });
    expect(mergeProgressMeta(undefined, undefined)).toEqual({});
    mergeProgressMeta(prev, { places: 1 });
    expect(prev).toEqual({ ideas: 7 });
  });
});

import { stageDurations } from "@/lib/progressStage";

describe("stageDurations", () => {
  it("gives the seconds each step took, in the given order, and skips steps that did not report", () => {
    const out = stageDurations(1_000, { selected: 1_400, written: 36_400, rendered: 38_000 }, ["selected", "researched", "written", "rendered"]);
    expect(out).toEqual({ selected: 0.4, written: 35, rendered: 1.6 });
  });
});
