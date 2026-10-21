import type { Activity } from "@/lib/discovery/types";
import { BRIDGE_MIN, buildGraph } from "@/lib/discovery/engine/graph";
import { passesConstraints } from "@/lib/discovery/engine/constraints";
import type { EngineLibrary } from "@/lib/discovery/engine/select";
import type { ResolvedConstraints } from "@/lib/discovery/engine/types";

// "Also in this direction" (R2.3): up to three other activities that sit next to a door's
// activity in the relation graph. Pure and deterministic, no AI call. It only reads the graph
// (graph.ts) and applies the same hard filters as the selection (constraints.ts), so it can
// never suggest something the person ruled out. It does not touch the selection itself.

/**
 * @param excludeIds  activities that must not appear: the doors of the book, and what earlier
 *                    doors already listed, so one activity is not shown twice.
 */
export function relatedActivitiesIn(
  lib: EngineLibrary,
  activityId: string,
  constraints: ResolvedConstraints,
  excludeIds: ReadonlySet<string> | readonly string[] = [],
  max = 3,
): Activity[] {
  const self = lib.activities.find((a) => a.id === activityId);
  if (!self) return [];
  const exclude = new Set(excludeIds);
  exclude.add(activityId);
  const graph = buildGraph(lib.activities, lib.tags);

  const candidates = lib.activities
    .filter((a) => !exclude.has(a.id) && passesConstraints(a, constraints).ok && graph.bridge(self, a) >= BRIDGE_MIN)
    .map((a) => ({ a, sim: graph.sim(self, a) }))
    .sort((x, y) => y.sim - x.sim || (x.a.id < y.a.id ? -1 : 1));

  // Variety first: at most one per sub-domain; only when that leaves fewer than `max`, fill up.
  const picked: Activity[] = [];
  const subs = new Set<string>();
  for (const { a } of candidates) {
    if (picked.length === max) break;
    if (subs.has(a.sub)) continue;
    subs.add(a.sub);
    picked.push(a);
  }
  for (const { a } of candidates) {
    if (picked.length === max) break;
    if (!picked.includes(a)) picked.push(a);
  }
  return picked;
}
