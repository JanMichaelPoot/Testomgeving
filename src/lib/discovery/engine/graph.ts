import type { Activity, Tag } from "@/lib/discovery/types";

// Relatedness between activities, from the bridge tags. Two ideas:
//   - a rare tag is a stronger connection than a common one (weight = ln(N / uses)),
//   - "mood" tags (focus, togetherness, ...) describe a feel, not a connection, so
//     they never count: two activities do not become related because both are calm.

export interface Graph {
  /** Summed weight of the non-generic tags two activities share. */
  bridge(a: Activity, b: Activity): number;
  /** The shared non-generic tags, strongest first. */
  shared(a: Activity, b: Activity): string[];
  /** 0..1: weighted tag overlap plus a bonus for the same domain / sub-domain. */
  sim(a: Activity, b: Activity): number;
}

/** A bridge at least this strong counts as a real connection (roughly: one tag used by fewer than ~27 of 200 activities). */
export const BRIDGE_MIN = 2.0;

const cache = new WeakMap<readonly Activity[], Graph>();

export function buildGraph(activities: readonly Activity[], tags: readonly Tag[]): Graph {
  const hit = cache.get(activities);
  if (hit) return hit;

  const generic = new Set(tags.filter((t) => t.generic).map((t) => t.id));
  const uses = new Map<string, number>();
  for (const a of activities) for (const t of a.tags) uses.set(t, (uses.get(t) ?? 0) + 1);
  const weight = (t: string) => Math.log(activities.length / (uses.get(t) ?? 1));

  const real = (a: Activity) => a.tags.filter((t) => !generic.has(t));
  const shared = (a: Activity, b: Activity) =>
    real(a)
      .filter((t) => b.tags.includes(t))
      .sort((x, y) => weight(y) - weight(x));
  const bridge = (a: Activity, b: Activity) => shared(a, b).reduce((sum, t) => sum + weight(t), 0);

  const sim = (a: Activity, b: Activity) => {
    const ta = new Set(real(a));
    const tb = new Set(real(b));
    if (ta.size === 0 || tb.size === 0) return 0;
    let inter = 0;
    let union = 0;
    for (const t of new Set([...ta, ...tb])) {
      const w = weight(t);
      union += w;
      if (ta.has(t) && tb.has(t)) inter += w;
    }
    return 0.6 * (union ? inter / union : 0) + (a.domain === b.domain ? 0.25 : 0) + (a.sub === b.sub ? 0.15 : 0);
  };

  const graph: Graph = { bridge, shared, sim };
  cache.set(activities, graph);
  return graph;
}
