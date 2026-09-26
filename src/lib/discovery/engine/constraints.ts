import { SOCIAL_FORMATS, type Activity, type SocialFormat } from "@/lib/discovery/types";
import type { EngineInput, ResolvedConstraints } from "@/lib/discovery/engine/types";

// Hard filters. The rule that keeps them honest: an activity is only excluded on a
// KNOWN conflict. An unknown facet (null) never excludes; it becomes a "verify" flag
// for the research step instead.

const COST_CAP: Record<string, 0 | 1 | 2 | 3> = { free: 0, "25": 1, "100": 2, allin: 3 };
const INTENSITY_CAP: Record<string, 0 | 1 | 2 | 3> = { minimal: 1, some: 2, committed: 3 };

/**
 * Reads the free-text "must-haves" for the few things that can be filtered reliably.
 * Deliberately narrow: everything else is left to the idea generator, which already
 * treats the text as hard constraints. Dutch and English.
 */
export function parseMustHaves(text: string): Pick<ResolvedConstraints, "setting" | "noGroups" | "verify"> & { free: boolean } {
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
  const free = /\b(gratis|kosteloos|free of charge|zero cost)\b/.test(t);

  // No accessibility or pet data in the library: cannot filter, must be checked.
  // No word boundary at the start: the wizard's own chip is the compound "Rolstoeltoegankelijk",
  // and "hondvriendelijk" is what the placeholder suggests.
  if (/(rolstoel|wheelchair|toegankelijk|accessible|slecht ter been|mobility)/.test(t)) verify.push("accessibility");
  if (/(hond(?!erd)|\bdogs?\b|huisdier|\bpets?\b)/.test(t)) verify.push("pet_friendly");
  if (/(allergie|allergy|allergic|dieet|\bdiet\b|vegetarisch|vegan|halal|koosjer|kosher)/.test(t)) verify.push("dietary");
  if (/alcohol/.test(t)) verify.push("alcohol");
  if (/(kinderen|\bkids\b|children|\bbaby)/.test(t)) verify.push("children");

  return { setting, noGroups, verify, free };
}

export function resolveConstraints(input: EngineInput): ResolvedConstraints {
  const must = parseMustHaves(input.mustHaves ?? "");

  const explicit = input.socialFormats.filter((f): f is SocialFormat => (SOCIAL_FORMATS as readonly string[]).includes(f));
  // "No preference" and "depends on the day" (or nothing chosen) impose nothing.
  const formats = explicit.length > 0 ? explicit : null;

  let costCap = COST_CAP[input.budget] ?? 2;
  if (must.free) costCap = 0;

  return {
    costCap,
    intensityCap: INTENSITY_CAP[input.effort] ?? 2,
    // Only offered to people who said they are open to something less predictable.
    hideSupervised: input.practicalToWild === "grounded" || input.practicalToWild === "practical",
    formats,
    noGroups: must.noGroups,
    setting: must.setting,
    verify: must.verify,
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

  if (a.cost === null) verify.push("cost_unknown");
  else if (a.cost > c.costCap) return no;

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
