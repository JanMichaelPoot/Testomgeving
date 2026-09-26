import { hashSeed, mulberry32, shuffled } from "@/lib/discovery/rng";
import { SOCIAL_FORMATS } from "@/lib/discovery/types";
import type { EngineLibrary } from "@/lib/discovery/engine/select";
import type { EngineInput } from "@/lib/discovery/engine/types";

// Synthetic visitors for testing and tuning the engine without users or AI cost.
// They are deliberately varied, including the awkward ones (nothing picked, very
// tight constraints, a very narrow niche). Not a substitute for real people: the
// user tests in the test plan judge whether the results FEEL right; this only shows
// that the rules hold.

export type Archetype = "niche" | "broad" | "few" | "worlds_only" | "surprise" | "nothing" | "constrained";

export interface SyntheticProfile {
  id: string;
  archetype: Archetype;
  /** For "niche": the world they are deep into. */
  nicheDomain?: string;
  input: EngineInput;
}

const ARCHETYPES: [Archetype, number][] = [
  ["niche", 25],
  ["broad", 20],
  ["few", 20],
  ["worlds_only", 10],
  ["surprise", 10],
  ["nothing", 10],
  ["constrained", 5],
];

const BUDGETS: [string, number][] = [["free", 15], ["25", 35], ["100", 30], ["allin", 20]];
const EFFORTS: [string, number][] = [["minimal", 20], ["some", 55], ["committed", 25]];
const DIALS = ["grounded", "practical", "either", "unexpected", "wild"];
const TIMES = ["hour", "halfday", "fullday", "weekend"];
const AGES = ["under18", "18-24", "25-34", "35-44", "45-54", "55-64", "65plus"];
const MUST_HAVES = ["Moet buiten zijn", "Moet binnen kunnen", "Gratis", "Geen groepen", "Rolstoeltoegankelijk", "Moet met de hond kunnen", "Geen alcohol"];

function weighted<T>(rnd: () => number, items: [T, number][]): T {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let roll = rnd() * total;
  for (const [item, w] of items) {
    roll -= w;
    if (roll <= 0) return item;
  }
  return items[items.length - 1][0];
}

export function syntheticProfiles(n: number, seed: string, lib: EngineLibrary): SyntheticProfile[] {
  const rnd = mulberry32(hashSeed(seed));
  const live = lib.activities.filter((a) => a.status !== "retired");
  const domains = [...new Set(live.map((a) => a.domain))];
  const ofDomain = (d: string) => live.filter((a) => a.domain === d);
  const out: SyntheticProfile[] = [];

  for (let i = 0; i < n; i++) {
    const archetype = weighted(rnd, ARCHETYPES);
    let interests: string[] = [];
    let interestDomains: string[] = [];
    let nicheDomain: string | undefined;

    if (archetype === "niche") {
      nicheDomain = domains[Math.floor(rnd() * domains.length)];
      const own = shuffled(ofDomain(nicheDomain), rnd);
      interests = own.slice(0, 3 + Math.floor(rnd() * 4)).map((a) => a.id);
      interestDomains = [nicheDomain];
    } else if (archetype === "broad") {
      const worlds = shuffled(domains, rnd).slice(0, 5 + Math.floor(rnd() * 3));
      for (const d of worlds) interests.push(...shuffled(ofDomain(d), rnd).slice(0, 1 + Math.floor(rnd() * 2)).map((a) => a.id));
      interests = interests.slice(0, 8 + Math.floor(rnd() * 5));
      interestDomains = worlds;
    } else if (archetype === "few") {
      interests = shuffled(live, rnd).slice(0, 1 + Math.floor(rnd() * 2)).map((a) => a.id);
      interestDomains = [...new Set(interests.map((id) => live.find((a) => a.id === id)!.domain))];
    } else if (archetype === "worlds_only") {
      interestDomains = shuffled(domains, rnd).slice(0, 1 + Math.floor(rnd() * 3));
    }

    // Social: nothing stated, one or two specific forms, or an explicit "doesn't matter".
    const socialRoll = rnd();
    let socialFormats: string[] = [];
    if (archetype === "constrained") socialFormats = ["solo"];
    else if (socialRoll >= 0.45 && socialRoll < 0.8) socialFormats = shuffled([...SOCIAL_FORMATS], rnd).slice(0, 1 + Math.floor(rnd() * 2));
    else if (socialRoll >= 0.8) socialFormats = [rnd() < 0.5 ? "any" : "varies"];

    out.push({
      id: `p${String(i + 1).padStart(3, "0")}`,
      archetype,
      nicheDomain,
      input: {
        interests,
        interestDomains,
        surpriseMe: archetype === "surprise",
        socialFormats,
        practicalToWild: DIALS[Math.floor(rnd() * DIALS.length)],
        budget: archetype === "constrained" ? "free" : weighted(rnd, BUDGETS),
        effort: archetype === "constrained" ? "minimal" : weighted(rnd, EFFORTS),
        timeAvailable: TIMES[Math.floor(rnd() * TIMES.length)],
        ageCategory: AGES[Math.floor(rnd() * AGES.length)],
        mustHaves: rnd() < 0.3 ? MUST_HAVES[Math.floor(rnd() * MUST_HAVES.length)] : "",
        history: [],
        seed: `${seed}-${i}`,
      },
    });
  }
  return out;
}
