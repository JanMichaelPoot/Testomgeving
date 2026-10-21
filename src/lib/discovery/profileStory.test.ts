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
    place: "Laren",
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

    it(`${locale}: is deterministic and tells 3-4 sentences that refer to the chosen images`, () => {
      const a = buildProfileStory(input(locale, QUIET), copy);
      const b = buildProfileStory(input(locale, QUIET), copy);
      expect(a).toEqual(b);
      expect(a.pickedCards.length).toBeGreaterThanOrEqual(2);
      expect(a.pickedCards.length).toBeLessThanOrEqual(3);
      // every picked image's label is quoted in the story
      for (const c of a.pickedCards) expect(a.story.toLowerCase()).toContain(c.label.toLowerCase());
      const sentences = a.story.split(/(?<=\.)\s+/);
      expect(sentences.length).toBeGreaterThanOrEqual(3);
      expect(sentences.length).toBeLessThanOrEqual(4);
      expect(a.story).not.toMatch(/\{\w+\}/);
    });

    it(`${locale}: mentions the place and the practical frame, without a place when none was given`, () => {
      expect(buildProfileStory(input(locale, QUIET), copy).story).toContain("Laren");
      const without = buildProfileStory(input(locale, QUIET, { place: "" }), copy).story;
      expect(without).not.toContain("Laren");
      expect(without).not.toMatch(/\{\w+\}/);
    });

    it(`${locale}: a gift talks about the recipient and never says "you chose" in the first person`, () => {
      const r = buildProfileStory(input(locale, BUSY, { gift: true, name: "Anna" }), copy);
      expect(r.story).toContain("Anna");
      expect(r.story).not.toMatch(/^(Je koos|You chose)/);
      expect(r.tension.text).not.toMatch(/\{name\}/);
    });

    it(`${locale}: nothing chosen gives a sensible story instead of an empty one`, () => {
      const r = buildProfileStory(input(locale, []), copy);
      expect(r.tension.kind).toBe("open");
      expect(r.pickedCards).toEqual([]);
      expect(r.story.length).toBeGreaterThan(20);
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
