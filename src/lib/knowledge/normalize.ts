import { normalizeName } from "@/lib/discovery/names";
import type { NormalizedRecord, RawRecord } from "@/lib/knowledge/types";

export function normalizeRecord(r: RawRecord): NormalizedRecord {
  const nl = r.labels.nl ? normalizeName(r.labels.nl) : "";
  const en = r.labels.en ? normalizeName(r.labels.en) : "";
  return { ...r, names: { ...(nl ? { nl } : {}), ...(en ? { en } : {}) } };
}

// --- word level, only for FINDING candidates to show a human (never for merging) -----------------------
const STOP = new Set(["de", "het", "een", "the", "and", "of", "en", "voor", "met", "van", "in", "op", "to", "for", "an"]);
// Words so common in hobby names that sharing one says nothing ("board game" / "card game").
const GENERIC = new Set([
  "game", "games", "spel", "spellen", "spelletje", "sport", "collecting", "collection", "collector", "verzamelen",
  "hobby", "art", "kunst", "club", "training", "workshop", "making", "maken", "recreation", "culture", "tourism",
]);

/** A light stem so "dammen" and "dam", "puzzles" and "puzzle" meet. Good enough to suggest, too crude to decide. */
export function stemToken(w: string): string {
  if (w.length > 5 && w.endsWith("ies")) return `${w.slice(0, -3)}y`;
  if (w.length > 4 && w.endsWith("en")) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

export function nameTokens(normalized: string): string[] {
  return normalized
    .split(" ")
    .filter((w) => w.length > 2 && !STOP.has(w))
    .map(stemToken);
}

/** Tokens that carry meaning: not a stop word and not one of the hobby-name fillers. */
export function meaningfulTokens(normalized: string): string[] {
  return nameTokens(normalized).filter((t) => !GENERIC.has(t));
}
