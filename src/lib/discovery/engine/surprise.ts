import type { Activity } from "@/lib/discovery/types";
import type { Graph } from "@/lib/discovery/engine/graph";
import surpriseJson from "@/lib/discovery/engine/surprise.json";

// B4 (docs/plan-activiteitenselectie.md): the "surprise" of an activity, how far it is from what most people choose, as data. The reference
// ("De activiteiten-engine", 4.2) lists it as a field of every activity; here it is derived, like the practical side (levels.ts), so the library needs no
// second pass and a new activity gets a level by itself. Four levels:
//   0 everyday    what most people already do or have done (a walk, a museum, a coffee)
//   1 known       a familiar leisure activity, one most people know somebody does
//   2 unusual     something most people have not tried
//   3 striking    something hardly anyone thinks of (a duck decoy, a decoy-hunting horn, a fierljep pole)
// The derivation sees only the library: the rarity of an activity's tags, how few other activities it is strongly connected to (hubness) and how hard it is to
// find a provider (supply). It never sees how many people really do something, so surprise.json holds a hand-made correction for the activities where the
// tags and the world disagree (a pleasure park has rare tags; a walk has common ones). Pure.

export type SurpriseLevel = 0 | 1 | 2 | 3;

interface Corrections {
  everyday: string[];
  known: string[];
  unusual: string[];
  striking: string[];
}
const CORRECTIONS = surpriseJson as unknown as Corrections;
const EVERYDAY = new Set(CORRECTIONS.everyday);
const KNOWN = new Set(CORRECTIONS.known);
const UNUSUAL = new Set(CORRECTIONS.unusual);
const STRIKING = new Set(CORRECTIONS.striking);

/** Every id on the correction lists (for the tests). */
export const SURPRISE_LISTED: readonly string[] = [...EVERYDAY, ...KNOWN, ...UNUSUAL, ...STRIKING];

/** Where the derived score (0..1) turns into level 1, 2 and 3: about the 13th, 50th and 82nd percentile of the library. */
const CUTS = [0.3, 0.42, 0.52] as const;

/** The derived score, 0..1, before the corrections: rarer tags, fewer strong connections and scarcer supply all raise it. */
export function derivedSurprise(a: Activity, graph: Graph): number {
  const supply = a.supply === "rare" ? 1 : a.supply === "regional" ? 0.5 : 0;
  return 0.5 * graph.rarity(a) + 0.3 * (1 - graph.hubness(a)) + 0.2 * supply;
}

/** The surprise level of one activity: derived, then corrected by hand where the library cannot know (surprise.json). */
export function surpriseLevel(a: Activity, graph: Graph): SurpriseLevel {
  if (STRIKING.has(a.id)) return 3;
  const s = derivedSurprise(a, graph);
  let level: SurpriseLevel = s >= CUTS[2] ? 3 : s >= CUTS[1] ? 2 : s >= CUTS[0] ? 1 : 0;
  if (EVERYDAY.has(a.id)) level = 0;
  else if (KNOWN.has(a.id)) level = Math.min(level, 1) as SurpriseLevel;
  else if (UNUSUAL.has(a.id)) level = Math.max(level, 2) as SurpriseLevel;
  return level;
}

const cache = new WeakMap<Graph, Map<string, SurpriseLevel>>();

/** The same, remembered per graph (the selection asks for many candidates a book). */
export function surpriseOf(a: Activity, graph: Graph): SurpriseLevel {
  let map = cache.get(graph);
  if (!map) cache.set(graph, (map = new Map()));
  let level = map.get(a.id);
  if (level === undefined) map.set(a.id, (level = surpriseLevel(a, graph)));
  return level;
}

/** -1 (everyday) .. +1 (striking) around the middle of the scale, for a nudge that rewards the surprising and discounts the everyday. */
export function surpriseCentered(level: SurpriseLevel): number {
  return (level - 1.5) / 1.5;
}

/** 0..100 for the internal idea scores (scores.ts). */
export const SURPRISE_SCORE: Record<SurpriseLevel, number> = { 0: 12, 1: 35, 2: 65, 3: 90 };
