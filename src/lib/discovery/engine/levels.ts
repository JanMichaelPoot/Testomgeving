import type { Activity } from "@/lib/discovery/types";
import type { DiscoveryLevel } from "@/lib/discoveryLevels";
import type { Direction } from "@/lib/discovery/engine/types";

// Fase 3: the practical side of an activity ("uitvoerbaarheid") and the assignment of the seven levels.
// Both are derived from facets the library already has (cost, duration, level, safety, supply, social forms, entry):
// nothing is stored per activity, so the library does not need a second pass.

/**
 * How easy it is to start tomorrow, 0..1 (1 = very easy). Unknown facets count as a middling value, never a good one:
 * a cost nobody established must not make an idea look practical.
 */
export function practicality(a: Activity): number {
  const cost = a.cost === null ? 0.4 : [1, 0.85, 0.55, 0.25][a.cost];
  const duration = a.duration === null ? 0.5 : [1, 0.9, 0.6, 0.35][a.duration - 1];
  const level = a.level === null ? 0.5 : [1, 0.7, 0.3][a.level];
  const safety = [1, 0.8, 0.3][a.safety.tier];
  const supply = a.supply === "rare" ? 0.1 : a.supply === "regional" ? 0.5 : 1;
  const alone = a.formats && (a.formats.includes("solo") || a.formats.includes("drop_in_alone")) ? 1 : 0.6;
  const entry = a.entry ? 1 : 0.4;
  return (cost * 2 + duration + level + safety + supply * 1.5 + alone * 0.5 + entry * 0.5) / 7.5;
}

interface LevelSeed {
  activityId: string;
  direction: Direction;
  /** Relevance to the person (0..1), when the selection measured it. */
  fit?: number;
}

/**
 * The seven levels, one per seed. The seven seeds are built as two familiar, two adjacent, one unexpected, one stretch
 * and one wildcard, so the levels follow the directions:
 *   familiar    the more practical of the two is level 2 (Praktisch), the other level 1 (Vertrouwd)
 *   adjacent    the closer to the person's picks is level 3 (Verwant), the further level 4 (Inspirerend)
 *   unexpected  5 · stretch 6 · wildcard 7
 * A group that has fewer seeds than levels (the pool was tight) leaves its higher level empty rather than moving a seed
 * into a level it does not belong to; a group with more (the fill step adds adjacent seeds) puts the extras on its
 * highest level. In explore mode (no picks) the seeds are ranked by how demanding they are and take the levels 1..6.
 */
export function assignLevels(seeds: readonly LevelSeed[], activities: ReadonlyMap<string, Activity>): Map<string, DiscoveryLevel> {
  const out = new Map<string, DiscoveryLevel>();
  const practical = (s: LevelSeed) => {
    const a = activities.get(s.activityId);
    return a ? practicality(a) : 0.5;
  };

  if (seeds.some((s) => s.direction === "explore")) {
    const ranked = seeds.filter((s) => s.direction === "explore");
    ranked.forEach((s, i) => out.set(s.activityId, Math.min(6, i + 1) as DiscoveryLevel));
    for (const s of seeds) if (s.direction === "wildcard") out.set(s.activityId, 7);
    return out;
  }

  const familiar = seeds.filter((s) => s.direction === "familiar");
  if (familiar.length === 1) out.set(familiar[0].activityId, 1);
  else if (familiar.length >= 2) {
    // Stable: on a tie the one chosen second is the practical one (it was picked for that, see weights.familiar.practicalBonus).
    const order = [...familiar].sort((x, y) => practical(x) - practical(y) || 0);
    order.forEach((s, i) => out.set(s.activityId, i === order.length - 1 ? 2 : 1));
  }

  const adjacent = seeds.filter((s) => s.direction === "adjacent");
  const byFit = [...adjacent].sort((x, y) => (y.fit ?? 0.5) - (x.fit ?? 0.5));
  byFit.forEach((s, i) => out.set(s.activityId, i === 0 ? 3 : 4));

  for (const s of seeds) {
    if (s.direction === "unexpected") out.set(s.activityId, 5);
    if (s.direction === "stretch") out.set(s.activityId, 6);
    if (s.direction === "wildcard") out.set(s.activityId, 7);
  }
  return out;
}
