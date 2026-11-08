// Brings the reference library (reference-library/data) into the app's discovery library (src/lib/discovery/data), step 1 of the
// "implement the reference library" plan. Pure: the script (scripts/reference-library/import-to-app.ts) reads and writes the files.
//
// What it does, and what it does not:
//   - an activity the app already has ("exact", "close", or one a human decided to merge) gets a source link back to its reference record;
//     a merge also adds the reference name as an alias. Nothing else about the app's activity changes.
//   - an activity the app does not have ("new") becomes a new app activity, but only with a hand-written crosswalk record
//     (reference-library/crosswalk/app-import.json): the domain, tags, intensity, photo scene and entry an app activity needs and the
//     reference library does not hold. A new activity starts as status "concept" and `image_pending`, so it stays invisible to visitors
//     and to the engine until its photo exists (npm run taxonomy:check --images says which).
//   - the app's own tags are never derived automatically from associations: the crosswalk names them.
// Idempotent: running it again changes nothing.

import { normalizeName } from "@/lib/discovery/names";
import type { Activity, Localized, SocialFormat } from "@/lib/discovery/types";
import { SOCIAL_FORMATS } from "@/lib/discovery/types";
import type { RefActivity } from "./types";

export const SOURCE_ID = "RL";

export interface CrosswalkActivity {
  domain: string;
  sub: string;
  tags: string[];
  intensity: 0 | 1 | 2 | 3;
  supply?: "regional" | "rare";
  months?: number[];
  register: "expressive" | "nurturing" | "technical" | "nature";
  scene: string;
  entry: Localized;
}

export interface CrosswalkMerge {
  action: "merge";
  app_id: string;
  alias?: { nl: string[]; en: string[] };
}

export interface Crosswalk {
  version: number;
  source_id: string;
  /** By reference slug: the app-specific fields of a reference activity that is written into the app as a new activity. */
  activities: Record<string, CrosswalkActivity>;
  /** By reference id (RA-nnn): a "new" reference record that a human decided the app already has. */
  decisions: Record<string, CrosswalkMerge>;
  /** By reference slug: the legal condition text for tier 2. */
  safety_notes: Record<string, Localized>;
}

export interface SourceLinkChange {
  appId: string;
  recordId: string;
}

export interface AliasChange {
  appId: string;
  nl: string[];
  en: string[];
}

export interface ImportPlan {
  create: Activity[];
  /** Reference slug -> register, for every activity in `create`. */
  registers: Record<string, string>;
  links: SourceLinkChange[];
  aliases: AliasChange[];
  /** Why a reference record was not written, or what a person must look at. Not errors: the library validator catches those. */
  notes: string[];
}

const FORMATS = new Set<string>(SOCIAL_FORMATS);

function formatsOf(ref: RefActivity): Activity["formats"] {
  const list = ref.facets.social_formats;
  if (!list) return null;
  return list.filter((f): f is SocialFormat => FORMATS.has(f));
}

/** Writes one reference record as an app activity. Throws on a missing crosswalk field so a half-filled record never reaches the library. */
export function buildActivity(ref: RefActivity, cw: CrosswalkActivity, safetyNote: Localized | undefined): Activity {
  const tier = ref.facets.safety_tier ?? 0;
  if (tier >= 2 && !safetyNote) throw new Error(`${ref.slug}: safety tier 2 needs a note in the crosswalk (safety_notes)`);
  const activity: Activity = {
    id: ref.slug,
    domain: cw.domain,
    sub: cw.sub,
    label: { nl: ref.nl, en: ref.en },
    tags: cw.tags,
    formats: formatsOf(ref),
    intensity: cw.intensity,
    level: ref.facets.level,
    cost: ref.facets.cost,
    duration: ref.facets.duration,
    setting: ref.facets.setting,
    ...(cw.months ? { months: cw.months } : {}),
    safety: tier >= 2 ? { tier: 2, note: safetyNote } : { tier: tier as 0 | 1 },
    ...(cw.supply ? { supply: cw.supply } : {}),
    entry: cw.entry,
    scene: cw.scene,
    status: "concept",
    image_pending: true,
    provenance: { source_id: SOURCE_ID, source_record_id: ref.id, method: "curated" },
  };
  return activity;
}

/** Plans the import. `existing` are all app activities by id (including image_pending ones). */
export function planImport(refs: readonly RefActivity[], crosswalk: Crosswalk, existing: ReadonlyMap<string, Activity>): ImportPlan {
  const plan: ImportPlan = { create: [], registers: {}, links: [], aliases: [], notes: [] };
  const usedNames = new Set<string>();
  for (const a of existing.values()) {
    usedNames.add(normalizeName(a.label.nl));
    usedNames.add(normalizeName(a.label.en));
  }
  for (const ref of refs) {
    // A "new" reference record that a human decided the app already has: link it (and add its name as an alias).
    const decision = crosswalk.decisions[ref.id];
    if (decision) {
      if (!existing.has(decision.app_id)) {
        plan.notes.push(`${ref.id} ${ref.slug}: merge target ${decision.app_id} is not in the app`);
        continue;
      }
      plan.links.push({ appId: decision.app_id, recordId: ref.id });
      if (decision.alias) plan.aliases.push({ appId: decision.app_id, nl: decision.alias.nl, en: decision.alias.en });
      continue;
    }
    // A reference record with a crosswalk record is written into the app, under its own slug, once. After that the reference
    // record points at it like at any other activity of the app (match "exact").
    const cw = crosswalk.activities[ref.slug];
    if (cw) {
      const already = existing.get(ref.slug);
      if (already) {
        // Written by an earlier run: keep it (and whatever has been changed since), only note a different origin.
        if (already.provenance?.source_record_id !== ref.id) plan.notes.push(`${ref.id} ${ref.slug}: the app already has an activity with this id from somewhere else`);
        continue;
      }
      for (const name of [ref.nl, ref.en]) {
        if (usedNames.has(normalizeName(name))) plan.notes.push(`${ref.id} ${ref.slug}: the name "${name}" already belongs to an app activity`);
      }
      plan.create.push(buildActivity(ref, cw, crosswalk.safety_notes[ref.slug]));
      plan.registers[ref.slug] = cw.register;
      usedNames.add(normalizeName(ref.nl));
      usedNames.add(normalizeName(ref.en));
      continue;
    }
    if ((ref.match === "exact" || ref.match === "close") && ref.legacy_id) {
      const target = existing.get(ref.legacy_id);
      if (!target) plan.notes.push(`${ref.id} ${ref.slug}: points at ${ref.legacy_id}, which is not in the app`);
      // An activity this import wrote carries its origin in `provenance`; it needs no second link.
      else if (target.provenance?.source_record_id !== ref.id) plan.links.push({ appId: ref.legacy_id, recordId: ref.id });
      continue;
    }
    if (ref.match === "new") plan.notes.push(`${ref.id} ${ref.slug}: new in the app, but there is no crosswalk record yet`);
  }
  return plan;
}

/** Adds a source link to an activity unless it has it. Returns whether anything changed. */
export function addSourceLink(activity: Activity, recordId: string): boolean {
  const links = activity.source_links ?? [];
  if (links.some((l) => l.source_id === SOURCE_ID && l.source_record_id === recordId)) return false;
  activity.source_links = [...links, { source_id: SOURCE_ID, source_record_id: recordId }];
  return true;
}

/** Adds aliases (a name the activity or another one already has is skipped). Returns whether anything changed. */
export function addAliases(activity: Activity, nl: string[], en: string[], taken: ReadonlySet<string>): boolean {
  let changed = false;
  const aliases = { nl: [...(activity.aliases?.nl ?? [])], en: [...(activity.aliases?.en ?? [])] };
  const own = new Set([normalizeName(activity.label.nl), normalizeName(activity.label.en), ...aliases.nl.map(normalizeName), ...aliases.en.map(normalizeName)]);
  for (const [lang, list] of [["nl", nl], ["en", en]] as const) {
    for (const name of list) {
      const n = normalizeName(name);
      if (own.has(n) || taken.has(n)) continue;
      aliases[lang].push(name);
      own.add(n);
      changed = true;
    }
  }
  if (changed) activity.aliases = aliases;
  return changed;
}
