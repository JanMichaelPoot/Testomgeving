// Values that are derived from the links instead of being written twice: the skills and experiences an activity
// builds, the relations it uses, and library-wide coverage figures.

import { parseLink } from "./validate";
import type { Library, ParsedLink, RefActivity, Relation } from "./types";

export interface ResolvedLink extends ParsedLink {
  domain: string;
  nl: string;
  en: string;
}

export function resolveLinks(lib: Library, a: RefActivity): ResolvedLink[] {
  const bySlug = new Map(lib.associations.map((x) => [x.slug, x]));
  const out: ResolvedLink[] = [];
  for (const s of a.links) {
    const p = parseLink(s);
    const t = p && bySlug.get(p.association);
    if (p && t) out.push({ ...p, domain: t.domain, nl: t.nl, en: t.en });
  }
  return out.sort((x, y) => y.score - x.score || x.association.localeCompare(y.association));
}

/** The strongest linked associations in one domain, as names. Skills and experiences are derived, never typed. */
export function strongestIn(links: ResolvedLink[], domains: string[], lang: "nl" | "en", limit = 4): string[] {
  return links
    .filter((l) => domains.includes(l.domain) && l.score >= 3)
    .slice(0, limit)
    .map((l) => l[lang]);
}

export interface Coverage {
  activities: number;
  links: number;
  linksPerActivity: number;
  discoveryLinks: number;
  byCategory: Record<string, number>;
  byRelation: Record<Relation, number>;
  byMatch: Record<string, number>;
  byDomain: Record<string, number>;
  associationsUsed: number;
  associationsTotal: number;
}

export function coverage(lib: Library): Coverage {
  const byCategory: Record<string, number> = {};
  const byRelation = { D: 0, T: 0, E: 0, V: 0, M: 0, O: 0 } as Record<Relation, number>;
  const byMatch: Record<string, number> = {};
  const byDomain: Record<string, number> = {};
  const used = new Set<string>();
  let links = 0;
  for (const a of lib.activities) {
    byCategory[a.category] = (byCategory[a.category] ?? 0) + 1;
    byMatch[a.match] = (byMatch[a.match] ?? 0) + 1;
    for (const l of resolveLinks(lib, a)) {
      links += 1;
      byRelation[l.relation] += 1;
      byDomain[l.domain] = (byDomain[l.domain] ?? 0) + 1;
      used.add(l.association);
    }
  }
  return {
    activities: lib.activities.length,
    links,
    linksPerActivity: lib.activities.length ? links / lib.activities.length : 0,
    discoveryLinks: byRelation.O,
    byCategory,
    byRelation,
    byMatch,
    byDomain,
    associationsUsed: used.size,
    associationsTotal: lib.associations.length,
  };
}

export interface Neighbour {
  activity: RefActivity;
  score: number;
  /** Association slugs that connect the two. For discovery: the discovery association first. */
  via: string[];
}

/**
 * Recognition: activities that share the same non-discovery associations (what someone already knows they like).
 * Score = sum of the weaker of the two scores per shared association, so only shared strong links count.
 */
export function recognitionNeighbours(lib: Library, a: RefActivity, limit = 5): Neighbour[] {
  const mine = new Map(resolveLinks(lib, a).filter((l) => l.relation !== "O").map((l) => [l.association, l.score]));
  const out: Neighbour[] = [];
  for (const b of lib.activities) {
    if (b.id === a.id) continue;
    let score = 0;
    const via: { slug: string; w: number }[] = [];
    for (const l of resolveLinks(lib, b)) {
      const s = mine.get(l.association);
      if (s !== undefined && l.relation !== "O") {
        const w = Math.min(s, l.score);
        score += w;
        via.push({ slug: l.association, w });
      }
    }
    if (score > 0) out.push({ activity: b, score, via: via.sort((x, y) => y.w - x.w).map((v) => v.slug) });
  }
  return out.sort((x, y) => y.score - x.score || x.activity.id.localeCompare(y.activity.id)).slice(0, limit);
}

/**
 * Discovery: activities from OTHER categories that are strongly tied (score 3+, not discovery) to an association
 * this activity reaches only through a discovery link. They are not alike on the surface, but the written reason
 * explains the bridge. Activities already in the recognition list are left out.
 */
export function discoveryNeighbours(lib: Library, a: RefActivity, limit = 5): Neighbour[] {
  const mineO = resolveLinks(lib, a).filter((l) => l.relation === "O");
  const known = new Set(recognitionNeighbours(lib, a, 10).map((n) => n.activity.id));
  // A bridge through a very common association (history, science) joins almost anything, so rarer bridges count more.
  const df = new Map<string, number>();
  for (const b of lib.activities) {
    for (const l of resolveLinks(lib, b)) if (l.relation !== "O" && l.score >= 3) df.set(l.association, (df.get(l.association) ?? 0) + 1);
  }
  const idf = (slug: string) => Math.log((lib.activities.length + 1) / ((df.get(slug) ?? 0) + 1)) + 1;
  const best = new Map<string, Neighbour>();
  for (const o of mineO) {
    for (const b of lib.activities) {
      if (b.id === a.id || b.category === a.category || known.has(b.id)) continue;
      const hit = resolveLinks(lib, b).find((l) => l.association === o.association && l.relation !== "O" && l.score >= 3);
      if (!hit) continue;
      const score = Math.round(o.score * hit.score * idf(o.association) * 10) / 10;
      const prev = best.get(b.id);
      if (!prev || score > prev.score) best.set(b.id, { activity: b, score, via: [o.association] });
    }
  }
  return [...best.values()].sort((x, y) => y.score - x.score || x.activity.id.localeCompare(y.activity.id)).slice(0, limit);
}
