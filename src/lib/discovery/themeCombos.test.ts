import { describe, expect, it } from "vitest";
import { THEMES, THEME_CARDS, activityAxes } from "@/lib/discovery/associations";
import { TAGS, getActivities } from "@/lib/discovery/library";
import { registerOfActivity, registerOfCard } from "@/lib/discovery/register";
import { REGISTERS, countRegisters } from "@/lib/discovery/registerTypes";
import { pairVerdict } from "@/lib/discovery/themePairs";
import { averageAxes, tagProfile } from "@/lib/discovery/associationProfile";
import {
  COMBO_FLOOR,
  COMBO_SLOTS,
  COVER_MIN,
  COVER_REL,
  CONCRETE_PAGE_SIZE,
  EXPLORE_SLOTS,
  MIN_PER_REGISTER,
  composeConcretePage,
  registerMix,
  type ConcreteActivity,
  type ThemeProfile,
} from "@/lib/discovery/twoPages";

// Page 2 as theme tiles (Step 211, docs/voorstel-associatie-engine.md): every chosen theme is covered, a few slots are reserved for
// activities that fit two chosen themes at once, and the "Misschien ook?" slots come from nearby themes that were not chosen.

const pool: ConcreteActivity[] = getActivities().map((a) => ({ id: a.id, domain: a.domain, sub: a.sub, register: registerOfActivity(a), tags: a.tags, axes: activityAxes(a) }));
const generic = new Set(TAGS.filter((t) => t.generic).map((t) => t.id));
const profileOf = (id: string): ThemeProfile => ({ id: `theme-${id}`, weights: THEMES.find((t) => t.id === id)!.tagWeights });
const ALL = THEMES.map((t) => profileOf(t.id));

/** The same closeness page 2 uses, relative to the best activity of the theme. */
function rel(theme: ThemeProfile) {
  const raw = (a: ConcreteActivity) => a.tags.reduce((s, t) => s + (theme.weights[t] ?? 0) * (generic.has(t) ? 0.5 : 1), 0) / Math.sqrt(Math.max(1, a.tags.length));
  const best = Math.max(...pool.map(raw));
  return (a: ConcreteActivity) => raw(a) / best;
}

function pageFor(ids: string[], seed: string, withThemes: boolean) {
  const cardIds = ids.map((id) => `theme-${id}-a`);
  const cards = cardIds.map((cid) => THEME_CARDS.find((c) => c.id === cid)!);
  const slim = cards.map((c) => ({ id: c.id, family: c.family, round: c.round, tagWeights: c.tagWeights, axes: c.axes, register: registerOfCard(c) }));
  return composeConcretePage(pool, {
    seed,
    profile: tagProfile(slim, cardIds),
    axes: averageAxes(slim, cardIds),
    genericTags: generic,
    mix: registerMix(slim),
    ...(withThemes ? { themes: ids.map(profileOf), allThemes: ALL } : {}),
  });
}

const PROFILES: string[][] = [
  ["natuur", "techniek", "ambacht"],
  ["natuur", "wetenschap"],
  ["dieren", "zorg", "helpen"],
  ["geschiedenis", "eten", "reizen"],
  ["sport", "avontuur", "water"],
  ["muziek", "podium", "taal"],
  ["spel", "mysterie", "verzamelen", "techniek"],
  ["rust", "tuin", "eten", "natuur", "beeld", "ambacht", "samen"],
];

describe("page 2 with chosen themes", () => {
  it("still gives a full page of unique activities with the register floors, however the themes lean", () => {
    for (const ids of PROFILES) {
      for (let i = 0; i < 6; i++) {
        const page = pageFor(ids, `c${i}`, true);
        expect(page, ids.join("+")).toHaveLength(CONCRETE_PAGE_SIZE);
        expect(new Set(page.map((s) => s.activity.id)).size).toBe(CONCRETE_PAGE_SIZE);
        expect(page.filter((s) => s.explore)).toHaveLength(EXPLORE_SLOTS);
        const counts = countRegisters(page.map((s) => s.activity.register));
        for (const r of REGISTERS) expect(counts[r], `${ids.join("+")} ${r}`).toBeGreaterThanOrEqual(MIN_PER_REGISTER);
      }
    }
  });

  it("covers every chosen theme: at least two activities that belong to it (one each when more than five were chosen)", () => {
    for (const ids of PROFILES) {
      const need = ids.length > 5 ? 1 : COVER_MIN;
      for (let i = 0; i < 6; i++) {
        const page = pageFor(ids, `cov${i}`, true).filter((s) => !s.explore);
        for (const id of ids) {
          const r = rel(profileOf(id));
          expect(page.filter((s) => r(s.activity) >= COVER_REL).length, `${ids.join("+")} / ${id}`).toBeGreaterThanOrEqual(need);
        }
      }
    }
  });

  it("reserves slots for combinations of two chosen themes, never more than COMBO_SLOTS, and each one really fits both", () => {
    for (const ids of PROFILES.filter((p) => p.length >= 2)) {
      for (let i = 0; i < 6; i++) {
        const page = pageFor(ids, `cmb${i}`, true);
        const combos = page.filter((s) => s.combo);
        expect(combos.length, ids.join("+")).toBeGreaterThanOrEqual(1);
        expect(combos.length, ids.join("+")).toBeLessThanOrEqual(COMBO_SLOTS);
        for (const s of combos) {
          const [a, b] = s.combo!;
          expect(a).not.toBe(b);
          // A hand-made combination (themePairs.json, A4) counts whatever the tags say; any other must fit both themes.
          if (pairVerdict(a, b)?.good.has(s.activity.id)) continue;
          expect(Math.min(rel(ALL.find((t) => t.id === a)!)(s.activity), rel(ALL.find((t) => t.id === b)!)(s.activity)), `${ids.join("+")} ${s.activity.id}`).toBeGreaterThanOrEqual(COMBO_FLOOR);
        }
      }
    }
  });

  it("puts at least as many strong combinations (0.6 or more for two themes at once) on the page as the plain sum, and more over all profiles", () => {
    // Measured (Step 211): the plain sum already leans to activities that fit several themes, so the gain is modest: about 3.6 -> 4.5 per page.
    let withThemes = 0;
    let without = 0;
    for (const ids of PROFILES.filter((p) => p.length >= 2)) {
      const rels = ids.map((id) => rel(profileOf(id)));
      const strong = (a: ConcreteActivity) => {
        let best = 0;
        for (let i = 0; i < rels.length; i++) for (let j = i + 1; j < rels.length; j++) best = Math.max(best, Math.min(rels[i](a), rels[j](a)));
        return best >= 0.6 ? 1 : 0;
      };
      for (let i = 0; i < 6; i++) {
        withThemes += pageFor(ids, `d${i}`, true).filter((s) => !s.explore).reduce((n, s) => n + strong(s.activity), 0);
        without += pageFor(ids, `d${i}`, false).filter((s) => !s.explore).reduce((n, s) => n + strong(s.activity), 0);
      }
    }
    expect(withThemes).toBeGreaterThan(without);
  });

  it("takes the exploring slots from themes that were not chosen, each from another theme, and not from a chosen one", () => {
    for (const ids of PROFILES) {
      const chosen = new Set(ids.map((id) => `theme-${id}`));
      for (let i = 0; i < 6; i++) {
        const explore = pageFor(ids, `x${i}`, true).filter((s) => s.explore);
        const themes = explore.map((s) => s.exploreTheme).filter((t): t is string => !!t);
        expect(new Set(themes).size, ids.join("+")).toBe(themes.length);
        for (const t of themes) expect(chosen.has(t), `${ids.join("+")} ${t}`).toBe(false);
        // At least one of the three comes from a nearby theme (the rest may fall back to the old criterion).
        expect(themes.length, ids.join("+")).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("is deterministic for a seed, and behaves as before when no themes are given", () => {
    const a = pageFor(PROFILES[0], "same", true).map((s) => s.activity.id);
    expect(pageFor(PROFILES[0], "same", true).map((s) => s.activity.id)).toEqual(a);
    const plain = pageFor(PROFILES[0], "same", false);
    expect(plain.every((s) => !s.combo && !s.exploreTheme)).toBe(true);
  });
});
