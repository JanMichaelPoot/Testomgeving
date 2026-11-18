import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { defaultEngineLibrary, selectSeeds, WEIGHTS_ANCHOR } from "@/lib/discovery/engine";
import { syntheticTwoPageProfiles } from "@/lib/discovery/engine/syntheticTwoPages";
import { THEMES, buildAssociationSources, parseAssociationSources, themeComboFor, themeProfilesFor, themeShortLabel } from "@/lib/discovery/associations";
import { THEME_FAR_COS, themeCosine, themeNameInSentence, themeRelative } from "@/lib/discovery/themeFit";
import { COMBO_FLOOR } from "@/lib/discovery/twoPages";
import { buildIdeaThreads, threadSentence } from "@/lib/ideaThread";
import { buildBecauseLines } from "@/lib/vensterReveal";
import { IdeaThread } from "@/components/plan/IdeaThread";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getActivity } from "@/lib/discovery/library";
import type { IdeaBookEntry } from "@/lib/claude/ideaBookTypes";

// E4 and E5 (docs/voorstel-associatie-engine.md): the unexpected idea from two far-apart chosen themes, and the line "omdat je natuur en ambacht koos".

const lib = defaultEngineLibrary();
const byId = new Map(lib.activities.map((a) => [a.id, a]));
const generic = new Set(lib.tags.filter((t) => t.generic).map((t) => t.id));
const cards = (ids: string[]) => ids.map((id) => `theme-${id}-a`);
const profilesOf = (ids: string[]) => themeProfilesFor(cards(ids));

const PAIRS: string[][] = [
  ["natuur", "techniek", "ambacht"],
  ["muziek", "techniek", "dieren"],
  ["geschiedenis", "sport", "eten"],
  ["wetenschap", "kunst-cultuur", "tuin"],
  ["podium", "water", "spel"],
];

const inputs = syntheticTwoPageProfiles(10, "theme-unexpected").map((p) => p.input);

describe("E4: the unexpected idea from two chosen themes that lie far apart", () => {
  it("does not change anything without themes (no seed carries a combination)", () => {
    for (const input of inputs) {
      const seeds = selectSeeds(input, lib, { weights: WEIGHTS_ANCHOR }).seeds;
      expect(seeds.every((s) => !s.themeCombo)).toBe(true);
    }
  }, 60_000);

  it("is deterministic for a seed", () => {
    const themes = profilesOf(PAIRS[0]);
    const a = selectSeeds({ ...inputs[0], themes }, lib, { weights: WEIGHTS_ANCHOR }).seeds.map((s) => s.activityId);
    const b = selectSeeds({ ...inputs[0], themes }, lib, { weights: WEIGHTS_ANCHOR }).seeds.map((s) => s.activityId);
    expect(a).toEqual(b);
  }, 60_000);

  it("marks only the unexpected idea, with two chosen themes that are far apart and that the activity really fits (and never the person's own pick)", () => {
    let withCombo = 0;
    let books = 0;
    for (const ids of PAIRS) {
      const themes = profilesOf(ids);
      const rel = new Map(themes.map((t) => [t.id, themeRelative(t.weights, lib.activities, generic)] as const));
      for (const input of inputs) {
        books++;
        const seeds = selectSeeds({ ...input, themes }, lib, { weights: WEIGHTS_ANCHOR }).seeds;
        const picks = new Set(input.interests);
        for (const s of seeds.filter((x) => x.themeCombo)) {
          withCombo++;
          expect(s.direction).toBe("unexpected");
          const [x, y] = s.themeCombo!;
          expect(x).not.toBe(y);
          const a = byId.get(s.activityId)!;
          expect(picks.has(s.activityId)).toBe(false);
          expect(Math.min(rel.get(x)!(a.tags), rel.get(y)!(a.tags))).toBeGreaterThanOrEqual(0.5);
          expect(themeCosine(themes.find((t) => t.id === x)!.weights, themes.find((t) => t.id === y)!.weights)).toBeLessThan(THEME_FAR_COS);
        }
        expect(seeds.filter((x) => x.themeCombo).length).toBeLessThanOrEqual(1);
      }
    }
    // Over 50 books with themes that lie far apart, a good part of the unexpected ideas is such a meeting point.
    expect(withCombo / books).toBeGreaterThan(0.3);
  }, 120_000);

  it("needs two themes: with one, nothing changes", () => {
    const themes = profilesOf(["natuur"]);
    for (const input of inputs.slice(0, 4)) {
      const seeds = selectSeeds({ ...input, themes }, lib, { weights: WEIGHTS_ANCHOR }).seeds;
      expect(seeds.every((s) => !s.themeCombo)).toBe(true);
    }
  }, 60_000);
});

describe("E5: 'omdat je natuur en ambacht koos'", () => {
  const chosen = cards(["natuur", "ambacht", "techniek"]);

  it("finds the two chosen themes an activity fits at once, never fewer than two, never a theme that was not chosen", () => {
    const combo = themeComboFor(getActivity("vogelhuisjes-bouwen")?.tags ?? getActivity("houtbewerking")!.tags, chosen);
    expect(combo).not.toBeNull();
    const ids = new Set(chosen.map((c) => c.replace(/-a$/, "")));
    for (const t of combo!) expect(ids.has(t)).toBe(true);
    expect(themeComboFor(getActivity("houtbewerking")!.tags, cards(["natuur"]))).toBeNull();
    expect(themeComboFor(getActivity("houtbewerking")!.tags, [])).toBeNull();
    // A theme the activity does not touch cannot make a pair.
    const weights = themeProfilesFor(cards(["muziek", "mode"]));
    const rel = weights.map((t) => themeRelative(t.weights, lib.activities, generic)(getActivity("houtbewerking")!.tags));
    expect(Math.min(...rel) < COMBO_FLOOR).toBe(true);
    expect(themeComboFor(getActivity("houtbewerking")!.tags, cards(["muziek", "mode"]))).toBeNull();
  });

  it("names a theme without its 'Iets met', in both languages", () => {
    expect(themeNameInSentence("Iets met ambacht en handwerk")).toBe("ambacht en handwerk");
    expect(themeNameInSentence("Something with Nature")).toBe("nature");
    expect(themeNameInSentence("Iets medisch of met gezondheid")).toBe("iets medisch of met gezondheid");
    expect(themeShortLabel("theme-natuur", "nl")).toBe("natuur");
    expect(themeShortLabel("theme-ambacht", "en")).toBe("crafts and making by hand");
    expect(THEMES.length).toBe(30);
  });

  // An idea built from woodwork: fits nature and craft.
  const ideas = [{ title: "Hout bewerken", activity_id: "houtbewerking", location: null }] as unknown as IdeaBookEntry[];

  it("stores the pair with the book, reads it back, and still reads an older book without it", () => {
    const built = buildAssociationSources(ideas, chosen);
    const combo = built.combos?.houtbewerking;
    expect(combo).toBeTruthy();
    expect(parseAssociationSources(JSON.parse(JSON.stringify(built)))?.combos?.houtbewerking).toEqual(combo);
    const old = { version: 2, sources: { houtbewerking: [chosen[0]] }, sourceTags: {} };
    expect(parseAssociationSources(old)?.combos).toBeUndefined();
    // Rubbish in the stored pair is dropped, not shown.
    expect(parseAssociationSources({ ...old, combos: { houtbewerking: ["theme-natuur", "theme-natuur"], x: "no" } })?.combos).toBeUndefined();
  });

  it("puts the two themes in the thread and in the PDF sentence, instead of a single image", () => {
    const built = buildAssociationSources(ideas, chosen);
    for (const locale of ["nl", "en"] as const) {
      const copy = getDictionary(locale).venster;
      const threads = buildIdeaThreads(ideas, null, built, locale);
      const t = threads["idea-0"];
      expect(t.themes).toHaveLength(2);
      expect(t.image).toBeNull();
      const line = threadSentence(t, copy.thread, copy.profile.and)!;
      expect(line).toContain(t.themes![0]);
      expect(line).toContain(t.themes![1]);
      const html = renderToStaticMarkup(createElement(IdeaThread, { thread: t, copy: copy.thread }));
      expect(html).toContain(`${t.themes![0]} + ${t.themes![1]}`);
      expect(html).toContain(copy.thread.comboCaption);
    }
  });

  it("says 'chosen by you' first when the person chose the activity themselves, and shows no combination", () => {
    const built = buildAssociationSources(ideas, chosen, ["houtbewerking"]);
    const t = buildIdeaThreads(ideas, null, built, "nl")["idea-0"];
    expect(t.own).toBe(true);
    expect(t.themes).toBeUndefined();
  });

  it("gives the 'Omdat je ... koos' line of the book both themes", () => {
    for (const locale of ["nl", "en"] as const) {
      const dict = getDictionary(locale).venster;
      const lines = buildBecauseLines(ideas, null, { intakeVariant: "associations", associations: chosen }, locale, dict);
      const text = lines["idea-0"].text;
      const [a, b] = themeComboFor(getActivity("houtbewerking")!.tags, chosen)!.map((t) => themeShortLabel(t, locale));
      expect(text).toContain(a);
      expect(text).toContain(b);
      expect(text).not.toContain("{");
    }
  });
});
