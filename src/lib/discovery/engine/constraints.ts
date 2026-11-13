import { SOCIAL_FORMATS, type Activity, type SocialFormat } from "@/lib/discovery/types";
import { inSeason } from "@/lib/discovery/season";
import { allowedForContext, normalizeSearchContext } from "@/lib/discovery/audience";
import {
  unsuitableForCalmPace,
  unsuitableForMeeting,
  unsuitableForQuiet,
  unsuitableForWheelchair,
  unsuitableForYoungKids,
  unsuitableWithoutAlcohol,
  unsuitableWithoutAnimals,
  unsuitableWithoutDutch,
  unsuitableWithoutHuntFish,
} from "@/lib/discovery/suitability";
import type { EngineInput, ResolvedConstraints } from "@/lib/discovery/engine/types";

// Hard filters. The rule that keeps them honest: an activity is only excluded on a
// KNOWN conflict. An unknown facet (null) never excludes; it becomes a "verify" flag
// for the research step instead.

// A cost class is a RANGE (0 free, 1 up to 15, 2 15-50, 3 over 50), so "up to 25" still fits class 2:
// a beginner workshop or trial class at 25 exists there. Only "free" (an old stored budget; the wizard no longer offers it) is exact. Where the range can
// reach past the budget the activity passes with a "cost_near_budget" flag, and the writer is told to
// say the price varies (a person's own pick is otherwise silently dropped: pottery is class 2).
// The per-person budget slider has six steps: 10, 25, 50, 100, 200 and "doesn't matter" (src/lib/budgetOptions.ts).
const COST_CAP: Record<string, 0 | 1 | 2 | 3> = { free: 0, "10": 1, "25": 2, "50": 2, "100": 3, "200": 3, allin: 3 };
// The class whose range can exceed the stated budget ("50" fits class 2 exactly: 15-50).
const NEAR_BUDGET: Record<string, number> = { "10": 1, "25": 2, "100": 3, "200": 3 };
const INTENSITY_CAP: Record<string, 0 | 1 | 2 | 3> = { minimal: 1, some: 2, committed: 3 };

/**
 * Reads the free-text "must-haves" for the few things that can be filtered reliably.
 * Deliberately narrow: everything else is left to the idea generator, which already
 * treats the text as hard constraints. Dutch and English.
 */
export function parseMustHaves(text: string): Pick<ResolvedConstraints, "setting" | "noGroups" | "verify" | "wheelchair" | "youngKids" | "calmPace" | "noAlcohol" | "quiet" | "meetPeople" | "withOne" | "withGroup" | "noDutch" | "noHuntFish" | "noAnimals"> {
  const t = ` ${text.toLowerCase()} `;
  const verify: string[] = [];
  let setting: "indoor" | "outdoor" | null = null;

  // Compounds count too ("buitenactiviteit", "binnensport"), but not "buitenland" or "binnenkort".
  const wantsOutdoor =
    /\b(buiten(?!land)\w*|outdoors?|outside|in de open lucht)\b/.test(t) &&
    !/\b(niet|geen|not|no)\s+(per se\s+)?(buiten\w*|outdoors?|outside)\b/.test(t);
  const wantsIndoor =
    /\b(binnen(shuis|activiteit\w*|sport)?|indoors?|inside)\b/.test(t) &&
    !/\b(niet|geen|not|no)\s+(per se\s+)?(binnen(shuis|activiteit\w*|sport)?|indoors?|inside)\b/.test(t);
  // "buiten en binnen" says nothing: only a single, unambiguous wish counts.
  if (wantsOutdoor && !wantsIndoor) setting = "outdoor";
  if (wantsIndoor && !wantsOutdoor) setting = "indoor";

  const noGroups = /\b(geen groepen?|niet in (een )?groep|no groups?|not in (a )?group|zonder groep)\b/.test(t);
  // "Gratis" is deliberately not read here (Fase 3): free is not something to filter on, only a fact about an
  // activity's price. The text still reaches the writer as a stated wish; the budget sets the cost limit.

  // No accessibility or pet data in the library: cannot filter, must be checked.
  // No word boundary at the start: the wizard's own chip is the compound "Rolstoeltoegankelijk",
  // and "hondvriendelijk" is what the placeholder suggests.
  // The wheelchair itself is a filter on the activities that are known to be impossible from one (suitability.ts); the rest is checked.
  const wheelchair = /(rolstoel|wheelchair)/.test(t);
  if (/(rolstoel|wheelchair|toegankelijk|accessible|slecht ter been|mobility)/.test(t)) verify.push("accessibility");
  if (/(hond(?!erd)|\bdogs?\b|huisdier|\bpets?\b)/.test(t)) verify.push("pet_friendly");
  // "Geen vis of schaaldieren" is one of the image intake's chips: a dietary limit too.
  if (/(allergie|allergy|allergic|dieet|\bdiet\b|vegetarisch|vegan|halal|koosjer|kosher|\bvis\b|\bfish\b|schaaldier|shellfish)/.test(t)) verify.push("dietary");
  if (/alcohol/.test(t)) verify.push("alcohol");
  // "Without alcohol" is a filter on what is about drinking (suitability.ts) and a writing rule; any other mention of alcohol is only checked.
  const noAlcohol = /(zonder alcohol|geen alcohol|alcoholvrij|alcohol-?free|no alcohol|without alcohol)/.test(t);
  if (noAlcohol) verify.push("no_alcohol");
  if (/(kinderen|\bkids\b|children|\bbaby)/.test(t)) verify.push("children");
  // Young children (a toddler or pre-schooler): a stricter list than "with children", and a hint to the writer.
  const youngKids = /(jonge kinderen|kleine kinderen|kleuter|peuter|young children|small children|little kids|toddler|pre-?school)/.test(t);
  if (youngKids) verify.push("young_children");
  // A calm pace: only gentle, unsupervised, non-advanced activities (suitability.ts), and the writer is told not to rush.
  const calmPace = /(rustig tempo|rustig aan|calm pace|slow pace)/.test(t);
  if (calmPace) verify.push("calm_pace");
  // Few stimuli: no loud, crowded or unpredictable activity (suitability.ts), and the writer keeps it calm and clear.
  const quiet = /(rustig en voorspelbaar|weinig prikkels|quiet and predictable|few stimuli)/.test(t);
  if (quiet) verify.push("quiet");
  // How they want to take part. "Meet people" is a filter (a way to meet others) and a strong nudge; one other / a group are filters on the forms.
  const meetPeople = /(mensen ontmoeten|nieuwe mensen|meet people|meet new people)/.test(t);
  if (meetPeople) verify.push("meet_people");
  // No Dutch: a filter on what is done in Dutch (suitability.ts), a nudge towards what welcomes newcomers, and a writing rule.
  const noDutch = /(zonder nederlands|geen nederlands|no dutch|without dutch|engels is genoeg|english is enough)/.test(t);
  if (noDutch) verify.push("no_dutch");
  // Hunting and fishing out ("Zonder jagen of vissen"), or every activity with animals out ("Zonder dieren"); the second includes the first.
  const noAnimals = /(zonder dieren|geen dieren|no animals|without animals)/.test(t);
  const noHuntFish = /(zonder jagen|geen jacht|zonder jacht|no hunting|without hunting)/.test(t);
  if (noHuntFish) verify.push("no_hunt_fish");
  if (noAnimals) verify.push("no_animals");
  const withOne = /(met (één|een|1) ander|with one other)/.test(t);
  const withGroup = /(met een groep|with a group)/.test(t);
  if (withOne) verify.push("with_one");
  if (withGroup) verify.push("with_group");
  // Practical wishes of the start page: how to get there and when. No data in the library either, so they are checked, not filtered.
  if (/(zonder auto|geen auto|openbaar vervoer|\bov\b|without a car|no car|public transport|by train)/.test(t)) verify.push("transport");
  if (/weekend/.test(t)) verify.push("weekend");
  if (/(avond|evening)/.test(t)) verify.push("evening");

  return { setting, noGroups, verify, ...(wheelchair ? { wheelchair } : {}), ...(youngKids ? { youngKids } : {}), ...(calmPace ? { calmPace } : {}),
    ...(noAlcohol ? { noAlcohol } : {}),
    ...(quiet ? { quiet } : {}),
    ...(meetPeople ? { meetPeople } : {}),
    ...(withOne ? { withOne } : {}),
    ...(withGroup ? { withGroup } : {}),
    ...(noDutch ? { noDutch } : {}),
    ...(noHuntFish ? { noHuntFish } : {}),
    ...(noAnimals ? { noAnimals } : {}),
  };
}

export interface ResolveOptions {
  /** B4 (weights.strictFreeCost): an activity with an unknown cost does not pass a "free" budget. */
  strictFreeCost?: boolean;
}

export function resolveConstraints(input: EngineInput, opts: ResolveOptions = {}): ResolvedConstraints {
  const must = parseMustHaves(input.mustHaves ?? "");

  const explicit = input.socialFormats.filter((f): f is SocialFormat => (SOCIAL_FORMATS as readonly string[]).includes(f));
  // The start page chips "with one other" and "with a group" add their forms to what was stated explicitly.
  const fromChips: SocialFormat[] = [...(must.withOne ? (["duo"] as const) : []), ...(must.withGroup ? (["small_group", "large_group"] as const) : [])];
  const wanted = [...new Set([...explicit, ...fromChips])];
  // "No preference" and "depends on the day" (or nothing chosen) impose nothing.
  const formats = wanted.length > 0 ? wanted : null;

  const costCap = COST_CAP[input.budget] ?? 2;

  return {
    costCap,
    nearBudgetCost: NEAR_BUDGET[input.budget] ?? null,
    // A calm pace never allows more than light movement, whatever the effort dial says.
    intensityCap: must.calmPace ? (Math.min(INTENSITY_CAP[input.effort] ?? 2, 1) as 0 | 1 | 2 | 3) : INTENSITY_CAP[input.effort] ?? 2,
    // Only offered to people who said they are open to something less predictable.
    hideSupervised: input.practicalToWild === "grounded" || input.practicalToWild === "practical",
    formats,
    noGroups: must.noGroups,
    setting: must.setting,
    verify: must.verify,
    month: input.month ?? null,
    ...(normalizeSearchContext(input.searchContext) === "child" ? { minorSafe: true } : {}),
    ...(must.verify.includes("children") ? { withKids: true } : {}),
    ...(must.youngKids ? { youngKids: true } : {}),
    ...(must.wheelchair ? { wheelchair: true } : {}),
    ...(must.calmPace ? { calmPace: true } : {}),
    ...(must.noAlcohol ? { noAlcohol: true } : {}),
    ...(must.quiet ? { quiet: true } : {}),
    ...(must.meetPeople ? { meetPeople: true } : {}),
    ...(must.noDutch ? { noDutch: true } : {}),
    ...(must.noHuntFish ? { noHuntFish: true } : {}),
    ...(must.noAnimals ? { noAnimals: true } : {}),
    ...(opts.strictFreeCost ? { strictFreeCost: true } : {}),
  };
}

const GROUP_ONLY: readonly SocialFormat[] = ["small_group", "large_group"];

export interface FilterResult {
  ok: boolean;
  /** Unknown facets that were let through; for the research step. */
  verify: string[];
}

export function passesConstraints(a: Activity, c: ResolvedConstraints): FilterResult {
  const verify: string[] = [];
  const no = { ok: false, verify };

  // Out of season is a known conflict, however well the activity matches the person.
  if (!inSeason(a, c.month)) return no;
  // A search for a child or young person: nothing with alcohol, gambling, weapons or heavy tools.
  if (c.minorSafe && !allowedForContext(a, "child")) return no;
  // They go with children: the same short list (alcohol, gambling, weapons, heavy tools, adult-only forms) stays out of the book.
  if (c.withKids && !allowedForContext(a, "child")) return no;
  // The people the book is for set what cannot be in it at all (suitability.ts): young children, a wheelchair, a calm pace.
  if (c.youngKids && unsuitableForYoungKids(a)) return no;
  if (c.wheelchair && unsuitableForWheelchair(a)) return no;
  if (c.calmPace && unsuitableForCalmPace(a)) return no;
  if (c.noAlcohol && unsuitableWithoutAlcohol(a)) return no;
  if (c.quiet && unsuitableForQuiet(a)) return no;
  if (c.meetPeople && unsuitableForMeeting(a)) return no;
  if (c.noDutch && unsuitableWithoutDutch(a)) return no;
  if ((c.noHuntFish || c.noAnimals) && unsuitableWithoutHuntFish(a)) return no;
  if (c.noAnimals && unsuitableWithoutAnimals(a)) return no;

  if (a.cost === null) {
    // Unknown is not "free": with the strict rule nobody who asked for free is offered something we cannot vouch for.
    if (c.strictFreeCost && c.costCap === 0) return no;
    verify.push("cost_unknown");
  } else if (a.cost > c.costCap) return no;
  else if (c.nearBudgetCost !== null && a.cost === c.nearBudgetCost) verify.push("cost_near_budget");

  if (a.intensity !== null && a.intensity > c.intensityCap) return no;
  if (a.safety.tier === 2 && c.hideSupervised) return no;

  if (c.setting && a.setting !== null && a.setting !== "both" && a.setting !== c.setting) return no;
  if (c.setting && a.setting === null) verify.push("setting_unknown");

  if (a.formats === null) {
    if (c.formats || c.noGroups) verify.push("formats_unknown");
  } else {
    if (c.formats && !a.formats.some((f) => c.formats!.includes(f))) return no;
    if (c.noGroups && a.formats.every((f) => GROUP_ONLY.includes(f))) return no;
  }
  return { ok: true, verify };
}
