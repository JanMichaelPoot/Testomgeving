import {
  SETTINGS,
  SOCIAL_FORMATS,
  STATUSES,
  type Activity,
  type Hybrid,
  type Vocabulary,
} from "@/lib/discovery/types";

// Pure validation of the whole library. Used by the vitest suite (so a bad edit
// fails `npm test`) and by scripts/taxonomy-check.ts (readable output while
// authoring). Errors block; warnings are advice while the library grows.

export interface LibraryInput {
  vocabulary: Vocabulary;
  activities: Activity[];
  hybrids: Hybrid[];
}

export interface Issues {
  errors: string[];
  warnings: string[];
}

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const ID = /^[a-z0-9]+([_-][a-z0-9]+)*$/;
const HEX = /^#[0-9a-fA-F]{6}$/;
// Photos in this product never show people (see the card-photo style prompt);
// a scene that asks for them would be silently ignored or produce faces.
const PEOPLE_WORDS = /\b(person|people|man|men|woman|women|child|children|kid|boy|girl|face|faces|portrait|crowd|couple|group of)\b/i;

const inRange = (v: number | null, lo: number, hi: number) => v === null || (Number.isInteger(v) && v >= lo && v <= hi);
const filled = (s: unknown) => typeof s === "string" && s.trim().length > 0;

export function validateLibrary({ vocabulary, activities, hybrids }: LibraryInput): Issues {
  const errors: string[] = [];
  const warnings: string[] = [];
  const err = (m: string) => errors.push(m);
  const warn = (m: string) => warnings.push(m);

  // --- vocabulary ---------------------------------------------------------
  const domainIds = new Set<string>();
  for (const d of vocabulary.domains) {
    if (!ID.test(d.id)) err(`domain "${d.id}": id must be lowercase letters/digits/underscore`);
    if (domainIds.has(d.id)) err(`domain "${d.id}": duplicate id`);
    domainIds.add(d.id);
    if (!filled(d.label?.nl) || !filled(d.label?.en)) err(`domain "${d.id}": label needs nl and en`);
    if (!filled(d.short?.nl) || !filled(d.short?.en)) err(`domain "${d.id}": short label needs nl and en`);
    if (!HEX.test(d.color)) err(`domain "${d.id}": color must be a #RRGGBB hex`);
    if (!filled(d.colorName)) err(`domain "${d.id}": colorName is needed for the image prompt`);
    if (!filled(d.scene)) err(`domain "${d.id}": scene is needed for the domain card photo`);
  }
  const subById = new Map(vocabulary.subs.map((s) => [s.id, s]));
  if (subById.size !== vocabulary.subs.length) err("sub-domains: duplicate ids");
  for (const s of vocabulary.subs) {
    if (!domainIds.has(s.domain)) err(`sub "${s.id}": unknown domain "${s.domain}"`);
    if (!filled(s.label?.nl) || !filled(s.label?.en)) err(`sub "${s.id}": label needs nl and en`);
  }
  const tagById = new Map(vocabulary.tags.map((t) => [t.id, t]));
  if (tagById.size !== vocabulary.tags.length) err("tags: duplicate ids");
  for (const t of vocabulary.tags) {
    if (!ID.test(t.id)) err(`tag "${t.id}": id must be lowercase letters/digits/underscore`);
    if (!filled(t.label?.nl) || !filled(t.label?.en)) err(`tag "${t.id}": label needs nl and en`);
  }

  // --- activities ---------------------------------------------------------
  const ids = new Set<string>();
  const labelSeen = new Map<string, string>();
  const tagUse = new Map<string, number>();
  const subUse = new Map<string, number>();

  for (const a of activities) {
    const at = `activity "${a.id}"`;
    if (!SLUG.test(a.id)) err(`${at}: id must be a lowercase slug (letters, digits, hyphens)`);
    if (ids.has(a.id)) err(`${at}: duplicate id`);
    ids.add(a.id);

    if (!domainIds.has(a.domain)) err(`${at}: unknown domain "${a.domain}"`);
    const sub = subById.get(a.sub);
    if (!sub) err(`${at}: unknown sub-domain "${a.sub}"`);
    else if (sub.domain !== a.domain) err(`${at}: sub "${a.sub}" belongs to "${sub.domain}", not "${a.domain}"`);
    subUse.set(a.sub, (subUse.get(a.sub) ?? 0) + 1);

    if (!filled(a.label?.nl) || !filled(a.label?.en)) err(`${at}: label needs nl and en`);
    for (const lang of ["nl", "en"] as const) {
      const key = `${lang}:${a.label?.[lang]?.trim().toLowerCase()}`;
      const other = labelSeen.get(key);
      if (other && other !== a.id) warn(`${at}: same ${lang} label as "${other}"`);
      labelSeen.set(key, a.id);
    }

    if (!Array.isArray(a.tags) || a.tags.length < 2 || a.tags.length > 5) err(`${at}: needs 2-5 tags`);
    else {
      if (new Set(a.tags).size !== a.tags.length) err(`${at}: duplicate tags`);
      let bridging = 0;
      for (const t of a.tags) {
        const tag = tagById.get(t);
        if (!tag) err(`${at}: unknown tag "${t}" (add it to vocabulary.json first)`);
        else if (!tag.generic) bridging++;
        tagUse.set(t, (tagUse.get(t) ?? 0) + 1);
      }
      if (bridging === 0) err(`${at}: needs at least one non-generic tag, otherwise it cannot connect to anything`);
    }

    if (a.formats !== null) {
      if (!Array.isArray(a.formats) || a.formats.length === 0) err(`${at}: formats must be null (unknown) or a non-empty list`);
      else for (const f of a.formats) if (!SOCIAL_FORMATS.includes(f)) err(`${at}: unknown social format "${f}"`);
    }
    if (!inRange(a.intensity, 0, 3)) err(`${at}: intensity must be 0-3 or null`);
    if (!inRange(a.level, 0, 2)) err(`${at}: level must be 0-2 or null`);
    if (!inRange(a.cost, 0, 3)) err(`${at}: cost must be 0-3 or null`);
    if (!inRange(a.duration, 1, 4)) err(`${at}: duration must be 1-4 or null`);
    if (a.setting !== null && !SETTINGS.includes(a.setting)) err(`${at}: setting must be indoor, outdoor, both or null`);

    if (![0, 1, 2].includes(a.safety?.tier)) err(`${at}: safety.tier must be 0, 1 or 2`);
    if (a.safety?.tier === 2 && (!filled(a.safety.note?.nl) || !filled(a.safety.note?.en))) {
      err(`${at}: tier 2 needs safety.note (nl and en): the qualified, legal way in`);
    }
    if (a.entry !== null && (!filled(a.entry?.nl) || !filled(a.entry?.en))) err(`${at}: entry needs nl and en (or null)`);
    if (a.entry === null) warn(`${at}: no entry variant yet`);

    if (!filled(a.scene) || a.scene.trim().length < 20) err(`${at}: scene (image art direction) is missing or too short`);
    else if (PEOPLE_WORDS.test(a.scene)) err(`${at}: scene mentions people/faces; photos never show people`);
    if (!STATUSES.includes(a.status)) err(`${at}: status must be one of ${STATUSES.join(", ")}`);

    if (a.status !== "retired") {
      const unknown = [a.formats, a.intensity, a.level, a.cost, a.duration, a.setting].filter((v) => v === null).length;
      if (unknown >= 3) warn(`${at}: ${unknown} facets unknown; consider verifying`);
    }
  }

  // --- hybrids ------------------------------------------------------------
  const pairSeen = new Set<string>();
  for (const h of hybrids) {
    const at = `hybrid "${h.a}" + "${h.b}"`;
    if (!ids.has(h.a) || !ids.has(h.b)) err(`${at}: references an unknown activity`);
    if (h.a === h.b) err(`${at}: an activity cannot be combined with itself`);
    const key = [h.a, h.b].sort().join("|");
    if (pairSeen.has(key)) err(`${at}: duplicate pair`);
    pairSeen.add(key);
    if (!filled(h.label?.nl) || !filled(h.label?.en)) err(`${at}: label needs nl and en`);
  }

  // --- balance (advice only, so growing unevenly never blocks work) --------
  const live = activities.filter((a) => a.status !== "retired");
  for (const d of vocabulary.domains) {
    const n = live.filter((a) => a.domain === d.id).length;
    if (n < 10) warn(`domain "${d.id}": only ${n} activities; below 10 the cards feel thin`);
    if (live.length > 0 && n / live.length > 0.15) warn(`domain "${d.id}": ${n} of ${live.length} activities (over 15%); the library leans on it`);
  }
  for (const s of vocabulary.subs) {
    if ((subUse.get(s.id) ?? 0) === 0) warn(`sub "${s.id}": no activities`);
  }
  for (const t of vocabulary.tags) {
    if ((tagUse.get(t.id) ?? 0) < 2 && !t.generic) warn(`tag "${t.id}": used by fewer than 2 activities, so it cannot bridge anything`);
  }

  return { errors, warnings };
}
