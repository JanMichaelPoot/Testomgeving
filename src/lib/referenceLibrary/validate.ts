// Rules for the reference library. Errors block (`npm run reflib:check` exits 1); warnings are for a human to read.
// Pure: the caller hands in the data and, to reconcile with the app, the app's activity ids and names.

import { normalizeName } from "@/lib/discovery/names";
import {
  ACTIVITY_TYPES,
  MATCHES,
  RELATIONS,
  RELATION_DOMAINS,
  STATUSES,
  type Issue,
  type Library,
  type ParsedLink,
  type Relation,
} from "./types";

export const MIN_LINKS = 12;
export const MAX_LINKS = 20;
/** Lowered from 2 to 1 in review round 3: a missing bridge is better than a weak one (see review/REVIEW.md). */
export const MIN_DISCOVERY_LINKS = 1;
export const MIN_DISTINCT_DOMAINS = 3;
export const MIN_WHY_LENGTH = 30;
/** An association on more than this share of the activities hardly tells them apart. */
export const MAX_ASSOCIATION_SHARE = 0.5;
/** The three most used discovery associations should not carry more than this share of all discovery links. */
export const MAX_DISCOVERY_TOP3_SHARE = 0.3;

export interface AppView {
  /** Activity id -> its names, for the crosswalk and the duplicate check. */
  activities: { id: string; nl: string; en: string; aliases: string[] }[];
}

export function parseLink(s: string): ParsedLink | null {
  const m = /^([a-z0-9-]+):([1-5]):([A-Z])$/.exec(s);
  if (!m || !(RELATIONS as readonly string[]).includes(m[3])) return null;
  return { association: m[1], score: Number(m[2]), relation: m[3] as Relation };
}

export function validateLibrary(lib: Library, app?: AppView): Issue[] {
  const issues: Issue[] = [];
  const err = (where: string, message: string) => issues.push({ level: "error", where, message });
  const warn = (where: string, message: string) => issues.push({ level: "warning", where, message });

  // --- categories, domains, associations -------------------------------------------------------------------
  const catIds = new Set<string>();
  for (const c of lib.categories) {
    if (catIds.has(c.id)) err(c.id, "duplicate category id");
    catIds.add(c.id);
    if (!c.nl || !c.en) err(c.id, "category needs nl and en names");
    if (!c.scope?.nl || !c.scope?.en) err(c.id, "category needs a scope in nl and en");
  }
  const domainSlugs = new Set(lib.domains.map((d) => d.slug));
  const assoc = new Map<string, (typeof lib.associations)[number]>();
  const assocIds = new Set<string>();
  const assocNames = new Map<string, string>();
  for (const a of lib.associations) {
    if (assoc.has(a.slug)) err(a.id, `duplicate association slug "${a.slug}"`);
    assoc.set(a.slug, a);
    if (assocIds.has(a.id)) err(a.id, "duplicate association id");
    assocIds.add(a.id);
    if (!domainSlugs.has(a.domain)) err(a.id, `unknown association domain "${a.domain}"`);
    if (!a.nl || !a.en) err(a.id, "association needs nl and en names");
    if (!a.def?.nl || !a.def?.en) err(a.id, "association needs a definition in nl and en");
    if (a.scope && (!a.scope.nl || !a.scope.en)) err(a.id, "association scope needs nl and en");
    for (const lang of ["nl", "en"] as const) {
      const key = lang + ":" + normalizeName(a[lang]);
      const prev = assocNames.get(key);
      if (prev) err(a.id, `${lang} name "${a[lang]}" is also the name of ${prev}`);
      else assocNames.set(key, a.id);
    }
  }

  // --- activities ------------------------------------------------------------------------------------------
  const ids = new Set<string>();
  const slugs = new Set<string>();
  const names = new Map<string, string>();
  const appIds = new Set(app?.activities.map((x) => x.id));
  const appNames = new Map<string, string>();
  for (const x of app?.activities ?? []) {
    for (const n of [x.nl, x.en, ...x.aliases]) appNames.set(normalizeName(n), x.id);
  }
  const legacyUsed = new Map<string, string>();

  for (const a of lib.activities) {
    const w = `${a.id} ${a.slug}`;
    if (ids.has(a.id)) err(w, "duplicate id");
    ids.add(a.id);
    if (slugs.has(a.slug)) err(w, "duplicate slug");
    slugs.add(a.slug);
    if (!/^RA-\d{3,}$/.test(a.id)) err(w, "id must look like RA-001");
    if (!catIds.has(a.category)) err(w, `unknown category "${a.category}"`);
    if (!a.nl || !a.en) err(w, "needs a name in nl and en");
    if (!a.desc?.nl || !a.desc?.en) err(w, "needs a description in nl and en");
    if (a.desc && (a.desc.nl.length < 25 || a.desc.en.length < 25)) warn(w, "description is very short");
    if (!a.sub?.nl || !a.sub?.en) err(w, "needs a subcategory in nl and en");
    if (!a.types?.length) err(w, "needs at least one activity type");
    for (const t of a.types ?? []) if (!(ACTIVITY_TYPES as readonly string[]).includes(t)) err(w, `unknown activity type "${t}"`);
    if (!(STATUSES as readonly string[]).includes(a.status)) err(w, `unknown status "${a.status}"`);
    if (!(MATCHES as readonly string[]).includes(a.match)) err(w, `unknown match "${a.match}"`);
    if (a.qa) {
      if (!Number.isInteger(a.qa.round) || a.qa.round < 1) err(w, "qa.round must be a positive integer");
      if (a.qa.result !== "checked" && a.qa.result !== "adjusted") err(w, `unknown qa.result "${a.qa.result}"`);
    }
    for (const n of a.qa_notes ?? []) if (typeof n !== "string" || n.length < 10) err(w, "qa_notes must be sentences");

    for (const lang of ["nl", "en"] as const) {
      const key = lang + ":" + normalizeName(a[lang]);
      const prev = names.get(key);
      if (prev) err(w, `${lang} name "${a[lang]}" is also the name of ${prev}`);
      else names.set(key, a.id);
    }

    // Crosswalk to the app.
    if (a.match === "new") {
      if (a.legacy_id) err(w, "a new activity must not have a legacy_id");
      if (app) {
        for (const n of [a.nl, a.en]) {
          const hit = appNames.get(normalizeName(n));
          if (hit) err(w, `marked new but "${n}" is the name or alias of the app activity "${hit}"`);
        }
      }
    } else {
      if (!a.legacy_id) err(w, `match "${a.match}" needs a legacy_id`);
      else {
        if (app && !appIds.has(a.legacy_id)) err(w, `legacy_id "${a.legacy_id}" is not an app activity`);
        if (a.match === "exact" && a.slug !== a.legacy_id) err(w, `an exact match must use the app id "${a.legacy_id}" as slug`);
        const prev = legacyUsed.get(a.legacy_id);
        if (prev && a.match === "exact") err(w, `app activity "${a.legacy_id}" is already matched exactly by ${prev}`);
        if (a.match === "exact") legacyUsed.set(a.legacy_id, a.id);
      }
    }

    // Facets: a known facet is in its scale; unknown is null, never invented.
    const f = a.facets;
    if (!f) err(w, "needs facets");
    else {
      if (f.setting !== null && !["indoor", "outdoor", "both"].includes(f.setting)) err(w, "facets.setting out of range");
      if (f.level !== null && ![0, 1, 2].includes(f.level)) err(w, "facets.level out of range");
      if (f.duration !== null && ![1, 2, 3, 4].includes(f.duration)) err(w, "facets.duration out of range");
      if (f.cost !== null && ![0, 1, 2, 3].includes(f.cost)) err(w, "facets.cost out of range");
      if (f.safety_tier !== null && ![0, 1, 2].includes(f.safety_tier)) err(w, "facets.safety_tier out of range");
      if (f.social_formats !== null && f.social_formats.length === 0) err(w, "facets.social_formats is empty (use null for unknown)");
      if (a.match === "new" && f.source !== "authored") err(w, "a new activity cannot take its facets from the app");
      if (f.safety_tier === 2 && a.status !== "Concept") warn(w, "supervised activity: check the safety wording before approving");
    }

    // Links.
    const parsed: ParsedLink[] = [];
    const seen = new Set<string>();
    for (const s of a.links ?? []) {
      const p = parseLink(s);
      if (!p) {
        err(w, `link "${s}" is not "association:score:relation" (score 1-5, relation one of ${RELATIONS.join("")})`);
        continue;
      }
      const target = assoc.get(p.association);
      if (!target) {
        err(w, `link to unknown association "${p.association}"`);
        continue;
      }
      if (seen.has(p.association)) err(w, `association "${p.association}" is linked twice`);
      seen.add(p.association);
      if (p.relation !== "O") {
        const allowed = RELATION_DOMAINS[p.relation];
        if (!allowed.includes(target.domain)) {
          err(w, `${p.relation} link to "${p.association}" (domain ${target.domain}) - ${p.relation} may only point at ${allowed.join(", ")}`);
        }
      }
      parsed.push(p);
    }
    if (parsed.length < MIN_LINKS || parsed.length > MAX_LINKS) {
      err(w, `has ${parsed.length} links; it needs ${MIN_LINKS} to ${MAX_LINKS}`);
    }
    const discovery = parsed.filter((p) => p.relation === "O");
    if (discovery.length < MIN_DISCOVERY_LINKS) err(w, `has ${discovery.length} discovery links; it needs at least ${MIN_DISCOVERY_LINKS}`);
    if (!parsed.some((p) => p.score >= 4)) err(w, "has no strong link (score 4 or 5)");
    if (parsed.length >= MIN_LINKS && !parsed.some((p) => p.relation !== "O" && p.score === 5)) warn(w, "no core (score 5) link outside discovery");
    const domains = new Set(parsed.map((p) => assoc.get(p.association)?.domain));
    if (domains.size < MIN_DISTINCT_DOMAINS) err(w, `links reach only ${domains.size} association domains; it needs at least ${MIN_DISTINCT_DOMAINS}`);
    const strongDiscovery = discovery.filter((p) => p.score >= 4);
    if (strongDiscovery.length > 0) warn(w, "a discovery link with score 4-5 is hardly 'indirect': check the score");

    // Every discovery link carries a reason, and no reason is left without a discovery link.
    for (const p of discovery) {
      const why = a.why?.[p.association];
      if (!why || !why.nl || !why.en) err(w, `discovery link "${p.association}" needs a reason in nl and en`);
      else if (why.nl.length < MIN_WHY_LENGTH || why.en.length < MIN_WHY_LENGTH) err(w, `reason for "${p.association}" is too short to be a reason`);
    }
    for (const k of Object.keys(a.why ?? {})) {
      if (!discovery.some((p) => p.association === k)) err(w, `reason given for "${k}" which is not a discovery link`);
    }
    // Identical boilerplate across records is a sign of copy-paste.
  }

  const reasons = new Map<string, string>();
  for (const a of lib.activities) {
    for (const [k, v] of Object.entries(a.why ?? {})) {
      const key = normalizeName(v.nl);
      const prev = reasons.get(key);
      if (prev) warn(`${a.id} ${a.slug}`, `the reason for "${k}" is identical to one on ${prev}`);
      else reasons.set(key, a.id);
    }
  }

  // Associations nobody uses are fine in a young library but worth knowing about.
  const used = new Set<string>();
  for (const a of lib.activities) for (const s of a.links ?? []) used.add(s.split(":")[0]);
  const unused = lib.associations.filter((x) => !used.has(x.slug)).map((x) => x.slug);
  if (unused.length) warn("associations", `${unused.length} associations have no activity yet: ${unused.join(", ")}`);

  // Spread: an association on most activities says little, and discovery bridges that all run through the same
  // few broad themes do not open many new directions. Only meaningful once the library has some size.
  if (lib.activities.length >= 50) {
    const use = new Map<string, number>();
    const disc = new Map<string, number>();
    let discTotal = 0;
    for (const a of lib.activities) {
      for (const s of a.links ?? []) {
        const p = parseLink(s);
        if (!p) continue;
        use.set(p.association, (use.get(p.association) ?? 0) + 1);
        if (p.relation === "O") {
          disc.set(p.association, (disc.get(p.association) ?? 0) + 1);
          discTotal += 1;
        }
      }
    }
    for (const [slug, n] of use) {
      const share = n / lib.activities.length;
      if (share > MAX_ASSOCIATION_SHARE) warn("spread", `association "${slug}" is on ${Math.round(share * 100)}% of the activities: it hardly discriminates`);
    }
    const top3 = [...disc.entries()].sort((x, y) => y[1] - x[1]).slice(0, 3);
    const top3Share = discTotal ? top3.reduce((t, [, n]) => t + n, 0) / discTotal : 0;
    if (top3Share > MAX_DISCOVERY_TOP3_SHARE) {
      warn("spread", `discovery links concentrate: ${top3.map(([k]) => k).join(", ")} carry ${Math.round(top3Share * 100)}% of them`);
    }
  }

  // Category coverage against the targets.
  const perCat = new Map<string, number>();
  for (const a of lib.activities) perCat.set(a.category, (perCat.get(a.category) ?? 0) + 1);
  for (const c of lib.categories) {
    const n = perCat.get(c.id) ?? 0;
    if (n === 0) warn(c.id, `category "${c.nl}" has no activities yet (target ${c.target})`);
  }
  return issues;
}
