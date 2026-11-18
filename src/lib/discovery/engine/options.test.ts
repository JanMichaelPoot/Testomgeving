import { describe, expect, it } from "vitest";
import { defaultEngineLibrary, selectSeeds, WEIGHTS_ANCHOR } from "@/lib/discovery/engine";
import { tagOverlap } from "@/lib/discovery/engine/options";
import { syntheticTwoPageProfiles } from "@/lib/discovery/engine/syntheticTwoPages";
import { themeProfilesFor } from "@/lib/discovery/associations";
import { themeRelative } from "@/lib/discovery/themeFit";
import { kindOfActivity } from "@/lib/discovery/activityKind";

// R1, A1 to A3 (docs/plan-activiteitenselectie.md): every idea heads an option of three, in a direction taken from the chosen themes.

const lib = defaultEngineLibrary();
const byId = new Map(lib.activities.map((a) => [a.id, a]));
const generic = new Set(lib.tags.filter((t) => t.generic).map((t) => t.id));
const themesOf = (ids: string[]) => themeProfilesFor(ids.map((id) => `theme-${id}-a`));
const SETS: string[][] = [
  ["natuur", "techniek", "ambacht"],
  ["muziek", "techniek", "dieren"],
  ["geschiedenis", "sport", "eten"],
  ["rust", "samen", "reizen", "beeld"],
];
const inputs = syntheticTwoPageProfiles(8, "options").map((p) => p.input);
const T = 120_000;

describe("options: the idea and two companions in one direction", () => {
  it("gives every idea two companions, never an idea of the book or one used twice, and different in sub-domain, tags and cluster", () => {
    for (const ids of SETS) {
      const themes = themesOf(ids);
      for (const input of inputs) {
        const { seeds } = selectSeeds({ ...input, themes }, lib, { weights: WEIGHTS_ANCHOR });
        const inBook = new Set(seeds.map((s) => s.activityId));
        const seen = new Set<string>();
        for (const s of seeds) {
          expect(s.option, s.activityId).toBeDefined();
          expect(s.option!.companions).toHaveLength(2);
          const group = [byId.get(s.activityId)!, ...s.option!.companions.map((id) => byId.get(id)!)];
          expect(new Set(group.map((a) => a.sub)).size, `${s.activityId} subs`).toBe(3);
          for (let i = 0; i < group.length; i++) for (let j = i + 1; j < group.length; j++) expect(tagOverlap(group[i].tags, group[j].tags), `${group[i].id}/${group[j].id}`).toBeLessThan(0.6);
          for (const c of s.option!.companions) {
            expect(inBook.has(c), `${c} is an idea of the book`).toBe(false);
            expect(seen.has(c), `${c} twice`).toBe(false);
            seen.add(c);
          }
        }
      }
    }
  }, T);

  it("takes the companions of a themed option from that theme", () => {
    for (const ids of SETS) {
      const themes = themesOf(ids);
      const rels = new Map(themes.map((t) => [t.id, themeRelative(t.weights, lib.activities, generic)] as const));
      for (const input of inputs) {
        const { seeds } = selectSeeds({ ...input, themes }, lib, { weights: WEIGHTS_ANCHOR });
        for (const s of seeds.filter((x) => x.option!.themes.length > 0)) {
          // A companion fits at least one of the option's themes (0.35 is the loosest level the builder falls back to).
          for (const c of s.option!.companions) {
            const best = Math.max(...s.option!.themes.map((t) => rels.get(t)!(byId.get(c)!.tags)));
            expect(best, `${s.activityId} -> ${c}`).toBeGreaterThanOrEqual(0.35);
          }
        }
      }
    }
  }, T);

  it("gives the five options several different directions, more than the ideas alone had", () => {
    let total = 0;
    let books = 0;
    for (const ids of SETS) {
      const themes = themesOf(ids);
      for (const input of inputs) {
        const { seeds } = selectSeeds({ ...input, themes }, lib, { weights: WEIGHTS_ANCHOR });
        total += new Set(seeds.map((s, i) => s.option!.themes.join("+") || `none-${i}`)).size;
        books++;
      }
    }
    expect(total / books).toBeGreaterThan(3.5);
  }, T);

  it("lets the companions of a combination lean to one of its two themes each (mostly), and always to one of them", () => {
    let seen = 0;
    let both = 0;
    let onTheme = 0;
    for (const ids of SETS) {
      const themes = themesOf(ids);
      const rels = new Map(themes.map((t) => [t.id, themeRelative(t.weights, lib.activities, generic)] as const));
      for (const input of inputs) {
        for (const s of selectSeeds({ ...input, themes }, lib, { weights: WEIGHTS_ANCHOR }).seeds.filter((x) => x.themeCombo)) {
          seen++;
          expect(s.option!.themes).toEqual(s.themeCombo);
          const [x, y] = s.themeCombo!;
          const [c0, c1] = s.option!.companions.map((id) => byId.get(id)!);
          if (rels.get(x)!(c0.tags) >= 0.35 && rels.get(y)!(c1.tags) >= 0.35) both++;
          if ([c0, c1].every((c) => Math.max(rels.get(x)!(c.tags), rels.get(y)!(c.tags)) >= 0.35)) onTheme++;
        }
      }
    }
    expect(seen).toBeGreaterThan(5);
    expect(both / seen).toBeGreaterThan(0.6);
    expect(onTheme / seen).toBeGreaterThan(0.9);
  }, T);

  it("also gives options without themes, from what is related to the idea, and does not change the ideas", () => {
    for (const input of inputs.slice(0, 4)) {
      const plain = selectSeeds(input, lib, { weights: WEIGHTS_ANCHOR });
      const noCover = selectSeeds(input, lib, { weights: { ...WEIGHTS_ANCHOR, option: { ...WEIGHTS_ANCHOR.option, coverage: 0 } } });
      expect(plain.seeds.map((s) => s.activityId)).toEqual(noCover.seeds.map((s) => s.activityId));
      for (const s of plain.seeds) {
        expect(s.option!.themes).toEqual([]);
        expect(s.option!.companions.length).toBeGreaterThanOrEqual(1);
      }
    }
  }, T);

  it("leans the adjacent idea to a chosen theme that no other idea covers, so more themes get an idea", () => {
    const fit = (ids: string[], coverage: number) => {
      const themes = themesOf(ids);
      const rels = themes.map((t) => themeRelative(t.weights, lib.activities, generic));
      let covered = 0;
      let n = 0;
      for (const input of inputs) {
        const w = { ...WEIGHTS_ANCHOR, option: { ...WEIGHTS_ANCHOR.option, coverage } };
        const acts = selectSeeds({ ...input, themes }, lib, { weights: w }).seeds.map((s) => byId.get(s.activityId)!);
        covered += rels.filter((r) => acts.some((a) => r(a.tags) >= 0.5)).length / rels.length;
        n++;
      }
      return covered / n;
    };
    let on = 0;
    let off = 0;
    for (const ids of SETS) {
      on += fit(ids, WEIGHTS_ANCHOR.option.coverage);
      off += fit(ids, 0);
    }
    expect(on).toBeGreaterThan(off);
  }, T);

  it("is deterministic for a seed, and mixes the kinds within an option", () => {
    const themes = themesOf(SETS[0]);
    const a = selectSeeds({ ...inputs[0], themes }, lib, { weights: WEIGHTS_ANCHOR }).seeds.map((s) => s.option);
    const b = selectSeeds({ ...inputs[0], themes }, lib, { weights: WEIGHTS_ANCHOR }).seeds.map((s) => s.option);
    expect(a).toEqual(b);
    let kinds = 0;
    let options = 0;
    for (const input of inputs) {
      for (const s of selectSeeds({ ...input, themes }, lib, { weights: WEIGHTS_ANCHOR }).seeds) {
        kinds += new Set([s.activityId, ...s.option!.companions].map((id) => kindOfActivity(byId.get(id)!))).size;
        options++;
      }
    }
    expect(kinds / options).toBeGreaterThan(2.2);
  }, T);
});
