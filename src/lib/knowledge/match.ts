import { normalizeName } from "@/lib/discovery/names";
import type { Activity } from "@/lib/discovery/types";
import { meaningfulTokens } from "@/lib/knowledge/normalize";
import type { NameTier, NormalizedRecord } from "@/lib/knowledge/types";

// Matching, strictest first (rule 1 and 2 of B3):
//   1. already linked  the library carries this source record's id
//   2. exact           the normalised label equals an activity's label, in the SAME language
//   3. alias           ... or one of its aliases
//   4. candidates      the words overlap: only ever shown to a human, never merged
// Names are never compared across languages (the same word can mean different things in nl and en), and a
// shared word never merges: "bouldering" is not "outdoor climbing", "chess" is not "correspondence chess".

export interface LibraryIndex {
  activities: Activity[];
  byId: Map<string, Activity>;
  /** `${lang}:${normalised name}` -> who answers to it. */
  names: Map<string, { activityId: string; tier: NameTier }[]>;
  /** `${source_id}:${source_record_id}` -> activity id. */
  links: Map<string, string>;
}

export function buildIndex(activities: Activity[]): LibraryIndex {
  const names: LibraryIndex["names"] = new Map();
  const links: LibraryIndex["links"] = new Map();
  const add = (lang: "nl" | "en", raw: string | undefined, activityId: string, tier: NameTier) => {
    const n = normalizeName(raw);
    if (!n) return;
    const key = `${lang}:${n}`;
    const list = names.get(key) ?? [];
    if (!list.some((x) => x.activityId === activityId && x.tier === tier)) list.push({ activityId, tier });
    names.set(key, list);
  };
  for (const a of activities) {
    for (const lang of ["nl", "en"] as const) {
      add(lang, a.label?.[lang], a.id, "label");
      for (const alias of a.aliases?.[lang] ?? []) add(lang, alias, a.id, "alias");
    }
    for (const l of a.source_links ?? []) links.set(`${l.source_id}:${l.source_record_id}`, a.id);
  }
  return { activities, byId: new Map(activities.map((a) => [a.id, a])), names, links };
}

export type MatchResult =
  | { kind: "linked"; activityId: string; tier: "exact" | "alias"; lang?: "nl" | "en" }
  | { kind: "merge"; activityId: string; tier: "exact" | "alias"; lang: "nl" | "en" }
  | { kind: "ambiguous"; candidates: string[] }
  | { kind: "similar"; candidates: string[] }
  | { kind: "none" };

/** Activities sharing meaningful words with the record, best first; at most `limit`. Suggestions only. */
export function similarActivities(rec: NormalizedRecord, index: LibraryIndex, limit = 3): string[] {
  const scored: { id: string; score: number }[] = [];
  for (const a of index.activities) {
    if (a.status === "retired") continue;
    let best = 0;
    for (const lang of ["nl", "en"] as const) {
      const mine = rec.names[lang];
      if (!mine) continue;
      for (const theirs of [a.label?.[lang], ...(a.aliases?.[lang] ?? [])]) {
        const t = new Set(meaningfulTokens(normalizeName(theirs)));
        const m = new Set(meaningfulTokens(mine));
        if (t.size === 0 || m.size === 0) continue;
        const shared = [...m].filter((x) => t.has(x));
        // One name's meaningful words must all occur in the other: "schaken" in "correspondentieschaak" does not
        // count (different words), "pottery" in "pottery wheel" does.
        if (shared.length === 0 || (shared.length !== m.size && shared.length !== t.size)) continue;
        const score = shared.length / new Set([...m, ...t]).size;
        best = Math.max(best, score);
      }
    }
    if (best > 0) scored.push({ id: a.id, score: best });
  }
  return scored.sort((x, y) => y.score - x.score || x.id.localeCompare(y.id)).slice(0, limit).map((x) => x.id);
}

export function matchRecord(rec: NormalizedRecord, index: LibraryIndex): MatchResult {
  const hits: { activityId: string; tier: NameTier; lang: "nl" | "en" }[] = [];
  for (const lang of ["nl", "en"] as const) {
    const n = rec.names[lang];
    if (!n) continue;
    for (const h of index.names.get(`${lang}:${n}`) ?? []) hits.push({ ...h, lang });
  }
  // A record the library already carries stays linked. The name match is still worked out, so a second run
  // reports the same "how" as the first (an import is idempotent, its report too).
  const linked = index.links.get(`${rec.source_id}:${rec.source_record_id}`);
  if (linked) {
    const own = hits.filter((h) => h.activityId === linked);
    const best = own.find((h) => h.tier === "label") ?? own[0];
    return { kind: "linked", activityId: linked, tier: best?.tier === "alias" ? "alias" : "exact", ...(best ? { lang: best.lang } : {}) };
  }
  const ids = [...new Set(hits.map((h) => h.activityId))];
  if (ids.length > 1) return { kind: "ambiguous", candidates: ids.sort() };
  if (ids.length === 1) {
    const best = hits.find((h) => h.tier === "label") ?? hits[0];
    return { kind: "merge", activityId: ids[0], tier: best.tier === "label" ? "exact" : "alias", lang: best.lang };
  }
  const similar = similarActivities(rec, index);
  return similar.length ? { kind: "similar", candidates: similar } : { kind: "none" };
}

/**
 * The names of a matched record that the activity (and every other activity) does not answer to yet. Adding one
 * of those as an alias can never collide with anything in the library.
 */
export function newAliasesFor(rec: NormalizedRecord, index: LibraryIndex): { nl: string[]; en: string[] } {
  const out: { nl: string[]; en: string[] } = { nl: [], en: [] };
  for (const lang of ["nl", "en"] as const) {
    const raw = rec.labels[lang];
    const n = rec.names[lang];
    if (!raw || !n) continue;
    const owners = index.names.get(`${lang}:${n}`) ?? [];
    if (owners.length === 0) out[lang].push(raw.trim());
    // Equal to a name of this very activity, or (a conflict) another one's: nothing to add.
  }
  return out;
}
