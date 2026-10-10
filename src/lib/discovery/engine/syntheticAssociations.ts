import { hashSeed, mulberry32, shuffled } from "@/lib/discovery/rng";
import { SOCIAL_FORMATS } from "@/lib/discovery/types";
import { ASSOCIATIONS, associationsToEngineInput } from "@/lib/discovery/associations";
import type { SyntheticProfile } from "@/lib/discovery/engine/synthetic";

// Synthetic visitors of the image intake ("Het venster"): they choose images instead of
// activities, the way the wizard lets them (1-5 per round, the senses round sometimes
// skipped, sometimes a world or two, sometimes "verras me"), and go through the same
// translation as a real visitor (associationsToEngineInput) before the engine runs.
// Used by the vitest regression and by scripts/discovery-shadow.ts --profile associations.

const BUDGETS = ["free", "25", "100", "allin"];
const TIMES = ["hour", "halfday", "fullday", "weekend"];
const AGES = ["", "18-24", "25-34", "35-44", "45-54", "55-64", "65plus"];
const MUST_HAVES = ["Moet buiten zijn", "Moet binnen kunnen", "Gratis", "Geen groepen", "Rolstoeltoegankelijk", "Geen alcohol"];

export function syntheticAssociationProfiles(n: number, seed: string, opts: { ageCategory?: string } = {}): SyntheticProfile[] {
  const rnd = mulberry32(hashSeed(`assoc-${seed}`));
  const domains = [...new Set(["movement", "creative", "nature", "history", "games", "collecting", "tech", "solo_explore", "together", "restful"])];
  const out: SyntheticProfile[] = [];
  for (let i = 0; i < n; i++) {
    const surprise = rnd() < 0.08;
    const chosen: string[] = [];
    for (const round of ["places", "moments", "senses"] as const) {
      if (round === "senses" && rnd() < 0.35) continue;
      const cards = shuffled(ASSOCIATIONS.filter((c) => c.round === round), rnd);
      chosen.push(...cards.slice(0, 1 + Math.floor(rnd() * 4)).map((c) => c.id));
    }
    const interestDomains = surprise ? [] : shuffled(domains, rnd).slice(0, Math.floor(rnd() * 3));
    const socialRoll = rnd();
    const socialFormats =
      socialRoll < 0.45 ? [] : socialRoll < 0.8 ? shuffled([...SOCIAL_FORMATS], rnd).slice(0, 1 + Math.floor(rnd() * 2)) : ["any"];
    const budget = BUDGETS[Math.floor(rnd() * BUDGETS.length)];
    const timeAvailable = TIMES[Math.floor(rnd() * TIMES.length)];
    const ageCategory = opts.ageCategory ?? AGES[Math.floor(rnd() * AGES.length)];
    const mustHaves = rnd() < 0.25 ? MUST_HAVES[Math.floor(rnd() * MUST_HAVES.length)] : "";
    const derived = associationsToEngineInput({
      associationIds: surprise ? [] : chosen,
      interestDomains,
      surpriseMe: surprise,
      constraints: { budget, timeAvailable, mustHaves, socialFormats, ageCategory },
      seed: `${seed}-${i}`,
    });
    out.push({
      id: `a${String(i + 1).padStart(3, "0")}`,
      archetype: surprise ? "surprise" : interestDomains.length ? "broad" : "few",
      input: {
        interests: derived.interests,
        interestDomains: derived.interestDomains,
        surpriseMe: surprise,
        socialFormats,
        practicalToWild: derived.practicalToWild,
        budget,
        effort: derived.effort,
        timeAvailable,
        ageCategory,
        mustHaves,
        history: [],
        seed: `${seed}-${i}`,
      },
    });
  }
  return out;
}
