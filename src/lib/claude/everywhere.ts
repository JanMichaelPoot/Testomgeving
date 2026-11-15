import type { Activity } from "@/lib/discovery/types";
import { getActivity } from "@/lib/discovery/library";
import { passesConstraints } from "@/lib/discovery/engine/constraints";
import type { ResolvedConstraints } from "@/lib/discovery/engine/types";
import { inSeason } from "@/lib/discovery/season";

// Activities that exist in almost every town (a bowling alley, a swimming pool, a museum, a walking group ...). When the research cannot find a real place
// for the ideas of a book (Wernigerode, 15 Nov 2026: 15 activities researched in a small German town, 3 with a place, so the book had four ideas instead
// of five), the coverage stage may reach for these as its last candidates: the idea is then a neighbour of what it replaces, not a related one, but
// it has a place. Chosen from what the research found most often in earlier books (110 activities seen at 3 or more places) and from what a town of
// a few thousand people usually has. Order matters a little: the first fitting ones are tried first.
export const EVERYWHERE_IDS = [
  "wandelgroep",
  "stadswandeling",
  "musea",
  "zwemmen",
  "bowlen",
  "minigolf",
  "pubquiz",
  "bordspellen",
  "film-theater",
  "tennis-proefles",
  "yoga",
  "dansen",
  "kook-club",
  "schilderen",
  "instrument",
  "hardlopen",
  "dierentuin",
  "kinderboerderij",
  "fotowandeling",
  "natuurbeheer",
  "high-tea",
  "escape-room",
  "klimpark",
  "sauna",
] as const;

/**
 * The "everywhere" activities that may be tried for an idea without a place: in season, passing the person's limits, not in the book yet and not tried yet,
 * not known to be quiet near them, and at most one per sub-domain so the candidates differ. `max` of them.
 */
export function everywhereCandidates(opts: { constraints: ResolvedConstraints; month: number; exclude: ReadonlySet<string>; quiet?: ReadonlySet<string>; max: number }): Activity[] {
  const out: Activity[] = [];
  const subs = new Set<string>();
  for (const id of EVERYWHERE_IDS) {
    if (out.length >= opts.max) break;
    const a = getActivity(id);
    if (!a || opts.exclude.has(id) || opts.quiet?.has(id) || subs.has(a.sub)) continue;
    if (!inSeason(a, opts.month) || !passesConstraints(a, opts.constraints).ok) continue;
    subs.add(a.sub);
    out.push(a);
  }
  return out;
}
