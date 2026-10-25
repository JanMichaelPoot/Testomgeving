import { describe, expect, it } from "vitest";
import { buildAssociationLibrary } from "@/lib/discovery/associations";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { resolveConstraints } from "@/lib/discovery/engine/constraints";
import { deriveDials, effectiveAxes, averageAxes, sanitizeAxesOverride } from "@/lib/discovery/associationProfile";
import {
  buildProfileStory,
  describeFilters,
  findTension,
  pickRepresentativeCards,
  strongestAxis,
  suggestMissing,
  type ProfileInput,
} from "@/lib/discovery/profileStory";

const lib = {
  nl: buildAssociationLibrary("nl"),
  en: buildAssociationLibrary("en"),
};
const copyOf = (locale: "nl" | "en") => getDictionary(locale).venster.profile;

function input(locale: "nl" | "en", chosen: string[], extra: Partial<ProfileInput> = {}): ProfileInput {
  return {
    cards: lib[locale].cards,
    tagLabels: lib[locale].tagLabels,
    chosen,
    corrections: [],
    timeAvailable: "halfday",
    budget: "25",
    searchDistance: "hour",
    company: ["alone"],
    socialFormats: [],
    mustHaves: "",
    gift: false,
    name: "",
    ...extra,
  };
}

const QUIET = ["place-forest-edge", "place-still-water", "moment-clay", "moment-stillness", "sense-wood"];
const TENSION = ["place-reading-room", "place-under-stars", "moment-summit", "moment-stillness", "sense-wind"];
const BUSY = ["place-kitchen-table", "moment-laughing", "moment-rhythm", "sense-bass"];

describe("buildProfileStory", () => {
  for (const locale of ["nl", "en"] as const) {
    const copy = copyOf(locale);

    it(`${locale}: is deterministic, opens with one line about what is looked for and then reads the choices in 2-4 sentences`, () => {
      const a = buildProfileStory(input(locale, QUIET), copy);
      const b = buildProfileStory(input(locale, QUIET), copy);
      expect(a).toEqual(b);
      expect(a.pickedCards.length).toBeGreaterThanOrEqual(2);
      expect(a.pickedCards.length).toBeLessThanOrEqual(3);
      expect(a.headline).toMatch(locale === "nl" ? /^Je zoekt .+, en .+\.$/ : /^You're looking for .+, and .+\.$/);
      const sentences = a.story.split(/(?<=\.)\s+/);
      expect(sentences.length).toBeGreaterThanOrEqual(2);
      expect(sentences.length).toBeLessThanOrEqual(4);
      for (const text of [a.headline, a.story]) expect(text).not.toMatch(/\{\w+\}|undefined/);
    });

    it(`${locale}: reads the choices instead of listing them: no image label is repeated, and neither is the practical frame the sill shows`, () => {
      const r = buildProfileStory(input(locale, QUIET), copy);
      for (const c of r.pickedCards) expect(`${r.headline} ${r.story}`.toLowerCase()).not.toContain(c.label.toLowerCase());
      expect(r.story).not.toMatch(/Laren|€\d/);
    });

    it(`${locale}: a gift talks about the recipient and never says "you chose" in the first person`, () => {
      const r = buildProfileStory(input(locale, BUSY, { gift: true, name: "Anna" }), copy);
      expect(r.headline).toContain("Anna");
      expect(r.headline).not.toMatch(/^(Je zoekt|You're looking)/);
      expect(r.story).not.toMatch(/Je koos|You chose/);
      expect(r.tension.text).not.toMatch(/\{name\}/);
    });

    it(`${locale}: nothing chosen gives a sensible story instead of an empty one`, () => {
      const r = buildProfileStory(input(locale, []), copy);
      expect(r.tension.kind).toBe("open");
      expect(r.pickedCards).toEqual([]);
      expect(r.story.length).toBeGreaterThan(20);
      expect(r.headline.length).toBeGreaterThan(10);
    });
  }

  it("reads the tags from the images, and what the person added comes first", () => {
    const plain = buildProfileStory(input("nl", QUIET), copyOf("nl"));
    expect(plain.tags).toContain("stilte");
    const fixed = buildProfileStory(input("nl", QUIET, { corrections: ["food"] }), copyOf("nl"));
    expect(fixed.tags[0]).toBe("eten");
  });

  it("uses the slider the person moved instead of the images for the axes", () => {
    const base = buildProfileStory(input("nl", QUIET), copyOf("nl"));
    const moved = buildProfileStory(input("nl", QUIET, { override: { energy: 1 } }), copyOf("nl"));
    expect(moved.axes.energy).toBe(1);
    expect(moved.axes.social).toBe(base.axes.social);
    expect(moved.fromImages.energy).toBe(base.fromImages.energy);
  });
});

describe("the portrait", () => {
  const nl = copyOf("nl");

  it("reads a pair of tags that belong together with one written sentence, and the strongest pair wins", () => {
    const r = buildProfileStory(input("nl", QUIET), nl);
    expect(nl.reads.some((x) => r.story.includes(x.text))).toBe(true);
  });

  it("reads the choices against who comes along: togetherness while alone, stillness with company", () => {
    const together = ["place-kitchen-table", "moment-laughing", "sense-bass"];
    expect(buildProfileStory(input("nl", together, { company: ["alone"] }), nl).story).toContain(nl.aloneButTogether);
    expect(buildProfileStory(input("nl", together, { company: ["friends"] }), nl).story).not.toContain(nl.aloneButTogether);
    const quiet = buildProfileStory(input("nl", QUIET, { company: ["partner"] }), nl).story;
    expect(quiet).toContain(nl.quietTogether);
    expect(buildProfileStory(input("nl", QUIET, { company: ["alone"] }), nl).story).not.toContain(nl.quietTogether);
  });

  it("follows a slider the person moved: the lean sentence changes with it", () => {
    const calm = buildProfileStory(input("nl", BUSY, { override: { energy: -1 } }), nl).story;
    const active = buildProfileStory(input("nl", BUSY, { override: { energy: 1 } }), nl).story;
    expect(calm).toContain(nl.leanLines.calm);
    expect(active).toContain(nl.leanLines.active);
  });

  it("has an image for every tag a person can read from the images, in both languages, and only real tags in the pairs", () => {
    for (const locale of ["nl", "en"] as const) {
      const copy = copyOf(locale);
      const tags = new Set(lib[locale].cards.flatMap((c) => Object.keys(c.tagWeights)));
      for (const t of tags) expect(copy.motifs[t], `${locale} motif ${t}`).toBeTruthy();
      for (const t of tags) expect(copy.tagLines[t], `${locale} tag line ${t}`).toBeTruthy();
      for (const r of copy.reads) for (const t of r.tags) expect(tags.has(t), `${locale} read tag ${t}`).toBe(true);
    }
  });

  it("is written so it reads right for a gift too: no first person singular and no 'you chose' in any fixed sentence", () => {
    for (const locale of ["nl", "en"] as const) {
      const copy = copyOf(locale);
      const all = [
        ...Object.values(copy.motifs),
        ...Object.values(copy.tagLines),
        ...copy.reads.map((r) => r.text),
        copy.aloneButTogether,
        copy.quietTogether,
        copy.leanNeutral,
        ...Object.values(copy.leanLines),
      ];
      for (const text of all) expect(text, text).not.toMatch(/\b(ik|mezelf|mij|mijn|I|myself|my)\b|je koos|you chose/i);
    }
  });

  it("is the same length class for every mix: a headline of at most 160 characters and at most 4 sentences", () => {
    const ids = lib.nl.cards.filter((c) => c.family === undefined || c.family === c.id).map((c) => c.id);
    for (const locale of ["nl", "en"] as const) {
      for (let i = 0; i < ids.length; i++) {
        const chosen = [ids[i], ids[(i + 5) % ids.length], ids[(i + 11) % ids.length]];
        const r = buildProfileStory(input(locale, chosen), copyOf(locale));
        expect(r.headline.length, r.headline).toBeLessThanOrEqual(160);
        expect(r.story.split(/(?<=\.)\s+/).length).toBeLessThanOrEqual(4);
      }
    }
  });
});

describe("tension and strong axes", () => {
  it("finds the axis on which the images pull in opposite directions, and shows both sides in the story", () => {
    expect(findTension(lib.nl.cards, TENSION)).toBe("energy");
    const r = buildProfileStory(input("nl", TENSION), copyOf("nl"));
    expect(r.tension.kind).toBe("tension");
    expect(r.tension.axis).toBe("energy");
    // the thumbnails and the story carry a calm and an active image, so "rust én spanning" has both halves in view
    const energies = r.pickedCards.map((c) => lib.nl.cards.find((x) => x.id === c.id)!.axes.energy);
    expect(Math.max(...energies)).toBeGreaterThanOrEqual(0.5);
    expect(Math.min(...energies)).toBeLessThanOrEqual(-0.5);
  });

  it("finds no tension when the images agree, and then speaks about the strongest axis", () => {
    expect(findTension(lib.nl.cards, ["place-reading-room", "place-rain-window", "moment-stillness"])).toBeNull();
    const r = buildProfileStory(input("nl", ["place-reading-room", "place-rain-window", "moment-stillness"]), copyOf("nl"));
    expect(r.tension.kind).toBe("strong");
    expect(r.tension.axis).toBe("energy");
    expect(r.tension.text).toContain("rust");
  });

  it("says plainly that nothing leans when nothing does", () => {
    expect(strongestAxis({ social: 0, energy: 0.1, setting: -0.1, novelty: 0 })).toBeNull();
    const flat = lib.nl.cards.map((c) => ({ ...c, axes: { social: 0, energy: 0, setting: 0, novelty: 0 } }));
    const r = buildProfileStory({ ...input("nl", QUIET), cards: flat }, copyOf("nl"));
    expect(r.tension.kind).toBe("balanced");
  });

  it("works for every mix of up to five images from the library without leaking a placeholder", () => {
    const ids = lib.nl.cards.filter((c) => c.family === undefined || c.family === c.id).map((c) => c.id);
    for (const locale of ["nl", "en"] as const) {
      for (let i = 0; i < ids.length; i++) {
        const chosen = [ids[i], ids[(i + 7) % ids.length], ids[(i + 13) % ids.length], ids[(i + 19) % ids.length]];
        const r = buildProfileStory(input(locale, chosen), copyOf(locale));
        expect(r.story).not.toMatch(/\{\w+\}|undefined/);
        expect(r.tension.text).not.toMatch(/\{\w+\}|undefined/);
      }
    }
  });
});

describe("what we look for and what we leave out", () => {
  const copy = copyOf("nl");
  const dialsOf = (axes = averageAxes(lib.nl.cards, QUIET)) => deriveDials(axes, true);

  it("every line under 'laten we weg' belongs to a filter that is really active", () => {
    const profiles: Partial<ProfileInput>[] = [
      {},
      { mustHaves: "Geen groepen" },
      { mustHaves: "Moet buiten zijn" },
      { mustHaves: "Moet binnen kunnen" },
      { budget: "free" },
      { budget: "allin" },
      { socialFormats: ["duo"] },
      { override: { energy: -1 } },
      { override: { novelty: -1 } },
      { override: { energy: 1, novelty: 1 } },
    ];
    for (const p of profiles) {
      const i = input("nl", QUIET, p);
      const axes = effectiveAxes(averageAxes(i.cards, i.chosen), i.override);
      const dials = deriveDials(axes, true);
      const c = resolveConstraints({
        interests: [], interestDomains: [], socialFormats: i.socialFormats, practicalToWild: dials.practicalToWild, budget: i.budget,
        effort: dials.effort, timeAvailable: i.timeAvailable, ageCategory: "", mustHaves: i.mustHaves, seed: "t",
      });
      const { omit } = describeFilters(i, dials, copy);
      expect(omit.length).toBeLessThanOrEqual(2);
      const active: Record<string, boolean> = {
        [copy.omitLines.noGroups]: c.noGroups,
        [copy.omitLines.needsInside]: c.setting === "outdoor",
        [copy.omitLines.needsOutside]: c.setting === "indoor",
        [copy.omitLines.formats]: c.formats !== null,
        [copy.omitLines.supervised]: c.hideSupervised,
        [copy.omitLines.effortMinimal]: c.intensityCap === 1,
        [copy.omitLines.effortSome]: c.intensityCap === 2,
        [copy.omitLines.costFree]: c.costCap === 0,
        [copy.omitLines.costMid]: c.costCap === 2,
      };
      for (const line of omit) expect(active[line], `${line} for ${JSON.stringify(p)}`).toBe(true);
    }
  });

  it("follows the sliders: calm shows the heavy-effort line, a hard limit shows up as typed", () => {
    const calm = describeFilters(input("nl", QUIET), deriveDials({ social: 0, energy: -1, setting: 0, novelty: 0 }, true), copy);
    expect(calm.omit).toContain(copy.omitLines.effortMinimal);
    expect(calm.seek).toContain(copy.seekLines.effortMinimal);
    const groups = describeFilters(input("nl", QUIET, { mustHaves: "Geen groepen; Moet buiten zijn" }), dialsOf(), copy);
    expect(groups.omit).toEqual([copy.omitLines.noGroups, copy.omitLines.needsInside]);
    expect(groups.seek).toContain(copy.seekLines.outdoor);
  });

  it("never shows more than three lines under 'dit zoeken we'", () => {
    const r = describeFilters(
      input("nl", QUIET, { mustHaves: "Moet buiten zijn", socialFormats: ["solo"], budget: "free" }),
      deriveDials({ social: 0, energy: -1, setting: 0, novelty: 0 }, true),
      copy,
    );
    expect(r.seek).toHaveLength(3);
  });

  it("a slider moved to calm changes what is left out, live", () => {
    const base = buildProfileStory(input("nl", BUSY), copy);
    const calm = buildProfileStory(input("nl", BUSY, { override: { energy: -1 } }), copy);
    expect(base.omit).not.toContain(copy.omitLines.effortMinimal);
    expect(calm.omit).toContain(copy.omitLines.effortMinimal);
  });
});

describe("what are we missing", () => {
  it("starts from the person's own choices: a combination first, then single tags", () => {
    const copy = copyOf("nl");
    const r = buildProfileStory(input("nl", QUIET), copy);
    expect(r.suggestions.length).toBeGreaterThanOrEqual(2);
    expect(r.suggestions.length).toBeLessThanOrEqual(3);
    expect(new Set(r.suggestions).size).toBe(r.suggestions.length);
    expect(suggestMissing({ nature: 3, story: 2.5, stillness: 1 }, copy)[0]).toBe("Een middag in de natuur met een goed verhaal");
  });

  it("is written so it also reads right for a gift: no first person in any suggestion", () => {
    for (const locale of ["nl", "en"] as const) {
      const copy = copyOf(locale);
      const all = [...Object.values(copy.suggestions), ...copy.combos.map((c) => c.text)];
      for (const text of all) expect(text, text).not.toMatch(/\b(ik|mezelf|mij|me|mijn|I|myself|me|my|we|ons|our)\b/i);
    }
  });

  it("has a suggestion for every tag a person can read from the images", () => {
    for (const locale of ["nl", "en"] as const) {
      const tags = new Set(lib[locale].cards.flatMap((c) => Object.keys(c.tagWeights)));
      for (const t of tags) expect(copyOf(locale).suggestions[t], t).toBeTruthy();
    }
  });
});

describe("pickRepresentativeCards", () => {
  it("never picks an image that was not chosen and does not repeat one", () => {
    const picked = pickRepresentativeCards({ cards: lib.nl.cards, chosen: TENSION, corrections: [] });
    expect(picked.every((c) => TENSION.includes(c.id))).toBe(true);
    expect(new Set(picked.map((c) => c.id)).size).toBe(picked.length);
  });
});

describe("the sliders", () => {
  it("are sanitised on the server: known axes only, clamped and rounded", () => {
    expect(sanitizeAxesOverride({ energy: 5, social: -9, setting: 0.12345, novelty: "x", other: 1 })).toEqual({ energy: 1, social: -1, setting: 0.12 });
    expect(sanitizeAxesOverride(null)).toEqual({});
    expect(sanitizeAxesOverride({ energy: Number.NaN, novelty: Infinity })).toEqual({});
  });
});
