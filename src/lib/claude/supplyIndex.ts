import { RESEARCH_CACHE_EPOCH, placeKey } from "@/lib/claude/localResearch";

// What the research of earlier books already says about the supply near a place (Stap 195, R1 of docs/kostenonderzoek-boekgeneratie.md).
//
// The selection engine picks seven activities and only afterwards the research finds out whether anybody offers them near the person. When
// not, a broad round, an online round or a replacement round follows: the money of a book goes there (78-88% of it is research, and most
// of that is the repair of a selection that did not know). Every answer of every book is already kept in `local_research_cache`, also the
// empty ones and also once they have expired, so the knowledge is there for nothing: an activity for which two separate searches near this
// place found nothing is "quiet" here. The engine gives such an activity a soft penalty (weights.supply.quiet) unless the person picked it
// themselves. It is a nudge, never a ban: a quiet activity can still be chosen when nothing else fits, and the research still looks for it then.
//
// What counts as evidence (kept deliberately cautious, because one empty answer is often only a search that was too thin):
//   - two or more different cached answers (another pass, another radius, another need) that are empty, and none at all that found something
//     for this activity at this place, at any radius: found options of a wider radius mean the supply exists, only not as near;
//   - the empty answers come from the current research version (older ones answered a stricter question) and are at most SILENT_MAX_AGE_DAYS old;
//   - an empty answer for a radius counts for the requested radius only when it was asked at least as wide (nothing within 25 km means nothing within 5);
//   - rows younger than SETTLING_MS are ignored: the warm-up (prewarmResearch.ts) runs the same selection a minute before the real generation and
//     writes its answers in between; if those counted, the second selection would differ from the first and the warmed answers would be wasted.
// Pure functions, plus one loader that fails soft (no table, no key, an error: no quiet activities, the book is made as before).

export const SILENT_MIN_OBSERVATIONS = 2;
export const SILENT_MAX_AGE_DAYS = 120;
/** A cached answer younger than this does not count (see above: the warm-up and the real generation must see the same index). */
export const SETTLING_MS = 2 * 3_600_000;
const DAY = 86_400_000;
/** At most this many cached rows are read for one place. */
const ROW_LIMIT = 5000;

export interface CacheEvidenceRow {
  activity_id: string;
  place_key: string;
  searched_at: string;
  options: unknown;
}

export interface ParsedCacheKey {
  place: string;
  radiusKm: number;
  epoch: string;
}

/** "city" and "region" are the older three-way classes of the distance (see distanceClassFor): what they meant, in kilometres. */
const LEGACY_RADIUS_KM: Record<string, number> = { city: 15, region: 75 };

/**
 * A cache key of a physical search (`utrecht|25km|v6|broad`, also the older `utrecht|city|2026-10|v6`) as its parts, or null for what is no
 * evidence about a place: the online answers (a place hardly matters there) and the whole-country key.
 */
export function parseCacheKey(key: string): ParsedCacheKey | null {
  const parts = key.split("|");
  if (parts.length < 3) return null;
  const [place, radius] = parts;
  if (!place || place === "nl" || place.startsWith("online")) return null;
  const rest = parts.slice(2);
  if (/^\d{4}-\d{2}$/.test(rest[0] ?? "")) rest.shift(); // the older keys carried the month
  const epoch = rest[0] ?? "";
  if (!/^v\d+$/.test(epoch) || rest.includes("online")) return null;
  const km = /^(\d+)km$/.exec(radius);
  const radiusKm = km ? Number(km[1]) : LEGACY_RADIUS_KM[radius];
  if (radiusKm === undefined || !Number.isFinite(radiusKm)) return null;
  return { place, radiusKm, epoch };
}

/** The place part and the radius in kilometres of a research request, or null when it is not about a place (the whole country). */
export function requestedPlace(location: string, searchDistance: string, searchDistanceKm: number | undefined, country: string | null | undefined): { place: string; radiusKm: number } | null {
  const foreign = country && country.toUpperCase() !== "NL" ? `${country.toLowerCase()}:` : "";
  const parsed = parseCacheKey(`${foreign}${placeKey(location, searchDistance, searchDistanceKm)}|${RESEARCH_CACHE_EPOCH}`);
  return parsed ? { place: parsed.place, radiusKm: parsed.radiusKm } : null;
}

const hasOptions = (options: unknown) => Array.isArray(options) && options.length > 0;

/**
 * The activities for which earlier research near this place found nothing, twice (see the evidence rules above). Rows of other places are ignored,
 * so the caller may hand over whatever it read.
 */
export function quietActivities(rows: readonly CacheEvidenceRow[], req: { place: string; radiusKm: number }, now: number): string[] {
  const empties = new Map<string, Set<string>>(); // activity -> the distinct answers (keys) that were empty
  const found = new Set<string>();
  for (const row of rows) {
    const key = parseCacheKey(row.place_key);
    if (!key || key.place !== req.place) continue;
    const age = now - Date.parse(row.searched_at);
    if (!Number.isFinite(age) || age < SETTLING_MS) continue;
    if (hasOptions(row.options)) {
      found.add(row.activity_id);
      continue;
    }
    if (key.epoch !== RESEARCH_CACHE_EPOCH || age > SILENT_MAX_AGE_DAYS * DAY || key.radiusKm < req.radiusKm) continue;
    const set = empties.get(row.activity_id) ?? new Set<string>();
    set.add(row.place_key);
    empties.set(row.activity_id, set);
  }
  return [...empties.entries()].filter(([id, keys]) => keys.size >= SILENT_MIN_OBSERVATIONS && !found.has(id)).map(([id]) => id).sort();
}

/** Off with WINDOW_SUPPLY_INDEX=0 (also the setting of the older tests): the selection then ignores what earlier research found. */
export function supplyIndexEnabled(env: Record<string, string | undefined> = process.env): boolean {
  const v = (env.WINDOW_SUPPLY_INDEX ?? "").trim().toLowerCase();
  return v !== "0" && v !== "false" && v !== "off" && v !== "no";
}

let warned = false;

/**
 * The quiet activities near this place, from the shared research cache. Fails soft: an unreachable table or a missing key give an empty list.
 * One query, rows of this place only, whatever their radius, month, pass or language.
 */
export async function loadQuietSupply(
  where: { location: string; searchDistance: string; searchDistanceKm?: number; country?: string | null },
  now: number = Date.now(),
): Promise<string[]> {
  if (!supplyIndexEnabled()) return [];
  const req = requestedPlace(where.location, where.searchDistance, where.searchDistanceKm, where.country);
  if (!req) return [];
  try {
    const { createServiceRoleClient } = await import("@/lib/supabase/server");
    const { data, error } = await createServiceRoleClient()
      .from("local_research_cache")
      .select("activity_id, place_key, searched_at, options")
      .like("place_key", `${req.place}|%`)
      .order("searched_at", { ascending: false })
      .limit(ROW_LIMIT);
    if (error) throw new Error(error.message);
    return quietActivities((data ?? []) as CacheEvidenceRow[], req, now);
  } catch (err) {
    if (!warned) {
      warned = true;
      console.warn(`WindowInto: supply index unavailable, selecting without it: ${err instanceof Error ? err.message : String(err)}`);
    }
    return [];
  }
}
