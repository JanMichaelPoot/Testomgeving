import { describe, expect, it } from "vitest";
import generated from "./searchHints.generated.json";
import manual from "./searchHints.manual.json";
import { ALL_ACTIVITIES } from "./library";
import { HINT_KINDS, hintLine, searchHint, searchHintIds } from "./searchHints";

describe("search hints (what to look for near a person, per activity)", () => {
  const ids = new Set(ALL_ACTIVITIES.map((a) => a.id));

  it("only describe activities that exist, with a known kind and real search terms", () => {
    for (const id of searchHintIds()) {
      expect(ids.has(id), id).toBe(true);
      const h = searchHint(id)!;
      expect(HINT_KINDS as readonly string[], id).toContain(h.kind);
      expect(h.terms.length, id).toBeGreaterThanOrEqual(8);
      // search phrases for a person in the Netherlands, never for an online course, an app or a webshop
      expect(h.terms, id).not.toMatch(/\b(online cursus|webshop|app store|e-?learning)\b/i);
    }
  });

  it("a hand-written hint wins over a generated one", () => {
    for (const id of Object.keys(manual)) expect(searchHint(id)).toEqual((manual as Record<string, unknown>)[id]);
    expect(Object.keys(generated).filter((id) => id in manual)).toEqual([]); // the generator skips what is written by hand
  });

  it("covers the activities the physical search found nothing for before (the weak spots of Nov 2026)", () => {
    for (const id of ["fietsreparatie", "nordic-walking", "wandelmeditatie", "nestkast-bouwen", "paardenverzorgingsdag", "legpuzzels", "sudoku", "plogging", "boulderen", "spotten"]) {
      expect(searchHint(id), id).toBeDefined();
    }
  });

  it("puts the kind and the terms on one line of the research prompt, and says nothing for an activity without a hint", () => {
    expect(hintLine("fietsreparatie")).toContain("repair café fiets");
    expect(hintLine("fietsreparatie")).toContain("a studio, school, workshop or venue");
    expect(hintLine("no-such-activity")).toBe("");
  });
});
