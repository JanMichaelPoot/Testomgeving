import type { RawRecord } from "@/lib/knowledge/types";

// Wikidata SPARQL JSON (S3): one binding per row with item, en, nl, den (English description), dnl (Dutch).
// The same item can come back in several rows, so rows are folded into one record per Q-number. When a field
// differs between rows the alphabetically first value wins, so the result never depends on the row order.

interface Cell {
  value?: string;
}
export interface SparqlBinding {
  item?: Cell;
  en?: Cell;
  nl?: Cell;
  den?: Cell;
  dnl?: Cell;
}
export interface SparqlResult {
  results?: { bindings?: SparqlBinding[] };
}

const Q_ID = /^Q\d+$/;

export function parseWikidata(json: SparqlResult, source_id = "S3"): RawRecord[] {
  const byId = new Map<string, { en: string[]; nl: string[]; den: string[]; dnl: string[] }>();
  for (const row of json.results?.bindings ?? []) {
    const url = row.item?.value ?? "";
    const id = url.slice(url.lastIndexOf("/") + 1);
    if (!Q_ID.test(id)) continue;
    const slot = byId.get(id) ?? { en: [], nl: [], den: [], dnl: [] };
    byId.set(id, slot);
    for (const k of ["en", "nl", "den", "dnl"] as const) {
      const v = row[k]?.value?.trim();
      // Wikidata hands back the Q-number itself when an item has no label in that language.
      // ... and some items carry the literal text "undefined" as a label.
      if (v && !Q_ID.test(v) && v.toLowerCase() !== "undefined" && !slot[k].includes(v)) slot[k].push(v);
    }
  }
  const first = (list: string[]) => [...list].sort()[0];
  return [...byId.entries()]
    .sort((a, b) => Number(a[0].slice(1)) - Number(b[0].slice(1)))
    .map(([id, s]) => ({
      source_id,
      source_record_id: id,
      labels: { ...(s.nl.length ? { nl: first(s.nl) } : {}), ...(s.en.length ? { en: first(s.en) } : {}) },
      descriptions: { ...(s.dnl.length ? { nl: first(s.dnl) } : {}), ...(s.den.length ? { en: first(s.den) } : {}) },
    }));
}
