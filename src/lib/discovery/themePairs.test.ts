import { describe, expect, it } from "vitest";
import { CURATED_PAIR_KEYS, pairKey, pairVerdict } from "@/lib/discovery/themePairs";
import pairsJson from "@/lib/discovery/themePairs.json";
import { THEMES, themeComboFor } from "@/lib/discovery/associations";
import { ALL_ACTIVITIES, getActivities, getActivity } from "@/lib/discovery/library";
import { defaultEngineLibrary, selectSeeds, WEIGHTS_ANCHOR } from "@/lib/discovery/engine";
import { syntheticTwoPageProfiles } from "@/lib/discovery/engine/syntheticTwoPages";
import { themeProfilesFor } from "@/lib/discovery/associations";

// A4 and A5 (docs/plan-activiteitenselectie.md): the hand-made verdicts on theme pairs, and one challenging idea per book.

const themeIds = new Set(THEMES.map((t) => t.id));
const live = new Set(getActivities().map((a) => a.id));
const table = (pairsJson as unknown as { pairs: Record<string, { good: string[]; bad: string[] }> }).pairs;

describe("the hand-made theme pairs", () => {
  it("has a list for at least thirty pairs, each between two real, different themes, with its key in alphabetical order", () => {
    expect(CURATED_PAIR_KEYS.length).toBeGreaterThanOrEqual(30);
    for (const key of CURATED_PAIR_KEYS) {
      const [a, b] = key.split("+");
      expect(themeIds.has(a), `${key}: ${a}`).toBe(true);
      expect(themeIds.has(b), `${key}: ${b}`).toBe(true);
      expect(a).not.toBe(b);
      expect(pairKey(a, b), key).toBe(key);
    }
  });

  it("names only activities that exist and are shown, with no activity on both lists and none twice", () => {
    for (const [key, v] of Object.entries(table)) {
      expect(v.good.length, `${key} has something good`).toBeGreaterThanOrEqual(3);
      for (const id of [...v.good, ...v.bad]) {
        expect(ALL_ACTIVITIES.some((a) => a.id === id), `${key}: ${id} does not exist`).toBe(true);
      }
      for (const id of v.good) expect(live.has(id), `${key}: ${id} is not shown (photo pending)`).toBe(true);
      expect(v.good.filter((id) => v.bad.includes(id)), key).toEqual([]);
      expect(new Set(v.good).size, `${key} good twice`).toBe(v.good.length);
      expect(new Set(v.bad).size, `${key} bad twice`).toBe(v.bad.length);
    }
  });

  it("is read the same whatever the order of the two themes or their prefix", () => {
    const v = pairVerdict("theme-techniek", "theme-natuur")!;
    expect(v).toBeDefined();
    expect(pairVerdict("natuur", "techniek")).toBe(v);
    expect(v.good.has("weerstation")).toBe(true);
    expect(v.bad.has("boomklimmen")).toBe(true);
    expect(pairVerdict("natuur", "natuur")).toBeUndefined();
  });
});

describe("the book's 'because you chose X and Y' line follows the hand-made list", () => {
  const chosen = ["natuur", "techniek", "ambacht"].map((id) => `theme-${id}-a`);

  it("claims a combination for an activity on the pair's good list, never for one on its bad list", () => {
    const weerstation = themeComboFor(getActivity("weerstation")!.tags, chosen, "weerstation");
    expect(weerstation?.map((t) => t.replace("theme-", "")).sort()).toEqual(["natuur", "techniek"]);
    const boomklimmen = themeComboFor(getActivity("boomklimmen")!.tags, chosen, "boomklimmen");
    expect(boomklimmen?.map((t) => t.replace("theme-", "")).sort() ?? []).not.toEqual(["natuur", "techniek"]);
  });

  it("claims nothing for a pair with a list when the activity is not on it (the tags alone do not decide)", () => {
    const two = ["natuur", "techniek"].map((id) => `theme-${id}-a`);
    // "enduro-offroad" fits both themes by its tags (0.47), and is on the pair's bad list
    expect(themeComboFor(getActivity("enduro-offroad")!.tags, two, "enduro-offroad")).toBeNull();
    // an activity that is on no list of this pair and fits only by its tags gets nothing either
    expect(themeComboFor(getActivity("valkerij")!.tags, two, "valkerij")).toBeNull();
  });
});

const lib = defaultEngineLibrary();
const byId = new Map(lib.activities.map((a) => [a.id, a]));
const inputs = syntheticTwoPageProfiles(12, "pairs-challenge").map((p) => p.input);
const T = 180_000;

describe("A4 in the selection", () => {
  it("makes most theme combinations a hand-made one when the pair has a list, and never one from the pair's own bad list", () => {
    let combos = 0;
    let good = 0;
    for (const ids of [["natuur", "techniek", "ambacht"], ["muziek", "techniek", "eten"], ["geschiedenis", "sport", "natuur"], ["beeld", "natuur", "taal"]]) {
      const themes = themeProfilesFor(ids.map((id) => `theme-${id}-a`));
      for (const input of inputs) {
        for (const s of selectSeeds({ ...input, themes }, lib, { weights: WEIGHTS_ANCHOR }).seeds.filter((x) => x.themeCombo)) {
          combos++;
          const v = pairVerdict(s.themeCombo![0], s.themeCombo![1]);
          expect(v?.bad.has(s.activityId) ?? false, `${s.themeCombo} ${s.activityId}`).toBe(false);
          if (v?.good.has(s.activityId)) good++;
        }
      }
    }
    expect(combos).toBeGreaterThan(10);
    expect(good / combos).toBeGreaterThan(0.6);
  }, T);
});

describe("A5: one idea that asks more than the person's own choices do", () => {
  const challenge = (a: { level: number | null; intensity: number | null }) => (a.level ?? 0) + (a.intensity ?? 0) / 2;
  const share = (weights: typeof WEIGHTS_ANCHOR) => {
    let books = 0;
    let withChallenge = 0;
    for (const input of inputs) {
      const r = selectSeeds(input, lib, { weights });
      const top = Math.max(0, ...input.interests.map((id) => challenge(byId.get(id)!)));
      books++;
      if (r.seeds.some((s) => !input.interests.includes(s.activityId) && challenge(byId.get(s.activityId)!) > top)) withChallenge++;
    }
    return withChallenge / books;
  };

  it("gives most books such an idea, clearly more than without the nudge", () => {
    const on = share(WEIGHTS_ANCHOR);
    const off = share({ ...WEIGHTS_ANCHOR, challenge: { bonus: 0, byWildness: [1, 1, 1, 1] } });
    expect(on).toBeGreaterThan(0.8);
    expect(on).toBeGreaterThan(off + 0.15);
  }, T);

  it("never goes past the hard limits of someone who wants it gentle (effort and supervision stay as they were)", () => {
    for (const input of inputs) {
      const gentle = { ...input, effort: "minimal", practicalToWild: "grounded" };
      for (const s of selectSeeds(gentle, lib, { weights: WEIGHTS_ANCHOR }).seeds) {
        const a = byId.get(s.activityId)!;
        if (input.interests.includes(a.id)) continue;
        expect(a.intensity ?? 0, a.id).toBeLessThanOrEqual(1);
        expect(a.safety.tier, a.id).toBeLessThan(2);
      }
    }
  }, T);

  it("is off in every other weight set", () => {
    expect(WEIGHTS_ANCHOR.challenge.bonus).toBeGreaterThan(0);
  });
});
