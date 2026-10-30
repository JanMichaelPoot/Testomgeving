import { hashSeed, mulberry32, shuffled } from "@/lib/discovery/rng";
import { SOCIAL_FORMATS } from "@/lib/discovery/types";
import { ASSOCIATIONS, activityAxes, associationsToEngineInput, hasOwnImage } from "@/lib/discovery/associations";
import { TAGS, getActivities } from "@/lib/discovery/library";
import { inSeason } from "@/lib/discovery/season";
import { averageAxes, tagProfile } from "@/lib/discovery/associationProfile";
import { registerOfActivity, registerOfCard } from "@/lib/discovery/register";
import { REGISTERS, type Register } from "@/lib/discovery/registerTypes";
import { MAX_CONCRETE_PICKS, MAX_IMAGE_PICKS, MIN_CONCRETE_PICKS, MIN_IMAGE_PICKS, composeConcretePage, registerMix, sampleBalancedBatch, type ConcreteActivity, type RegisteredCard } from "@/lib/discovery/twoPages";
import type { SyntheticProfile } from "@/lib/discovery/engine/synthetic";
import { effortForPicks } from "@/lib/discovery/imageIntake";

// Synthetic visitors of the two-page image intake (docs/fase4-opzet.md): page 1 (18 balanced images, 5-8 chosen, usually leaning
// to one register), page 2 (18 concrete activities that follow, 3-6 chosen, usually from the register they lean to), then the
// situation screen. They go through the same translation as a real visitor (associationsToEngineInput with explicit picks) and
// run with `explicitPicks`. Used by the vitest regression and scripts/twopages-measure.ts.

const BUDGETS = ["25", "100", "allin"]; // "free" is no longer offered (improvement plan D5)
const TIMES = ["hour", "halfday", "fullday", "weekend"];
const AGES = ["", "18-24", "25-34", "35-44", "45-54", "55-64", "65plus"];
const MUST_HAVES = ["Moet buiten zijn", "Moet binnen kunnen", "Geen groepen", "Rolstoeltoegankelijk", "Geen alcohol"];

export interface TwoPageProfile extends SyntheticProfile {
  /** What the visitor saw and chose, for measuring (never part of the engine input). */
  trace: { leaning: Register | null; imagePicks: string[]; page2: string[]; exploreShown: string[]; picks: string[] };
}

export function syntheticTwoPageProfiles(n: number, seed: string): TwoPageProfile[] {
  const rnd = mulberry32(hashSeed(`two-${seed}`));
  const cards: RegisteredCard[] = ASSOCIATIONS.filter(hasOwnImage).map((c) => ({ id: c.id, family: c.family, round: c.round, tagWeights: c.tagWeights, axes: c.axes, register: registerOfCard(c) }));
  const all = getActivities();
  const concrete = (inMonth: number): ConcreteActivity[] =>
    all.filter((a) => inSeason(a, inMonth)).map((a) => ({ id: a.id, domain: a.domain, sub: a.sub, register: registerOfActivity(a), tags: a.tags, axes: activityAxes(a) }));
  const pools = new Map(Array.from({ length: 12 }, (_, m) => [m + 1, concrete(m + 1)] as const));
  const generic = new Set(TAGS.filter((t) => t.generic).map((t) => t.id));
  const leanings: (Register | null)[] = [...REGISTERS, null];
  const out: TwoPageProfile[] = [];

  for (let i = 0; i < n; i++) {
    const sid = `${seed}-${i}`;
    const leaning = leanings[i % leanings.length];
    const batch = sampleBalancedBatch(cards, { seed: sid });
    const preferred = leaning ? shuffled(batch.filter((c) => c.register === leaning), rnd) : [];
    const rest = shuffled(batch.filter((c) => !preferred.includes(c)), rnd);
    const nImages = MIN_IMAGE_PICKS + Math.floor(rnd() * (MAX_IMAGE_PICKS - MIN_IMAGE_PICKS + 1));
    // About eight in ten of the choices come from the register they lean to.
    const imagePicks = [...preferred.slice(0, Math.ceil(nImages * 0.8)), ...rest].slice(0, nImages);
    const ids = imagePicks.map((c) => c.id);
    const mix = registerMix(imagePicks);
    const month = (i % 12) + 1;
    const pool = pools.get(month)!;
    const slots = composeConcretePage(pool, { seed: sid, profile: tagProfile(cards, ids), axes: averageAxes(cards, ids), genericTags: generic, mix });

    // Page 2: they pick 3-6, mostly the matched ones from the register they lean to, sometimes an exploring slot.
    const nPicks = MIN_CONCRETE_PICKS + Math.floor(rnd() * (MAX_CONCRETE_PICKS - MIN_CONCRETE_PICKS + 1));
    const ownFirst = shuffled(slots.filter((s) => leaning && s.activity.register === leaning), rnd);
    const others = shuffled(slots.filter((s) => !ownFirst.includes(s)), rnd);
    const picks = [...ownFirst.slice(0, Math.ceil(nPicks * 0.7)), ...others].slice(0, nPicks).map((s) => s.activity.id);

    const socialRoll = rnd();
    const socialFormats = socialRoll < 0.45 ? [] : socialRoll < 0.8 ? shuffled([...SOCIAL_FORMATS], rnd).slice(0, 1 + Math.floor(rnd() * 2)) : ["any"];
    const budget = BUDGETS[Math.floor(rnd() * BUDGETS.length)];
    const timeAvailable = TIMES[Math.floor(rnd() * TIMES.length)];
    const ageCategory = AGES[Math.floor(rnd() * AGES.length)];
    const mustHaves = rnd() < 0.25 ? MUST_HAVES[Math.floor(rnd() * MUST_HAVES.length)] : "";
    const derived = associationsToEngineInput({
      associationIds: ids,
      interestDomains: [],
      explicitInterests: picks,
      constraints: { budget, timeAvailable, mustHaves, socialFormats, ageCategory },
      seed: sid,
      month,
    });
    out.push({
      id: `t${String(i + 1).padStart(3, "0")}`,
      archetype: "few",
      trace: { leaning, imagePicks: ids, page2: slots.map((s) => s.activity.id), exploreShown: slots.filter((s) => s.explore).map((s) => s.activity.id), picks },
      input: {
        interests: derived.interests,
        interestDomains: [...new Set(derived.interests.map((id) => pool.find((a) => a.id === id)?.domain).filter((d): d is string => !!d))],
        socialFormats,
        practicalToWild: derived.practicalToWild,
        budget,
        effort: effortForPicks(derived.effort, derived.interests, false),
        timeAvailable,
        ageCategory,
        mustHaves,
        history: [],
        seed: sid,
        month,
        explicitPicks: true,
      },
    });
  }
  return out;
}
