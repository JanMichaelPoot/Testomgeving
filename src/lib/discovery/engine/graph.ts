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
  /**
   * 0..1: how far an activity sits out of the common run (1 = built from rare tags, 0 = built from the most
   * used ones). Hubs like a long walk or creative writing score low; escape rooms or glass blowing high.
   * The engine uses it to lift the long tail, so the same few activities do not lead every book.
   */
  rarity(a: Activity): number;
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

  // Every pair is asked for again and again (the unexpected step walks pick x middle x far), so the
  // real tags are computed once per activity and each pair's bridge and similarity once per pair.
  const index = new Map<string, number>();
  activities.forEach((a, i) => index.set(a.id, i));
  const n = activities.length;
  const realTags = activities.map((a) => a.tags.filter((t) => !generic.has(t)));
  const realOf = (a: Activity) => {
    const i = index.get(a.id);
    return i === undefined ? a.tags.filter((t) => !generic.has(t)) : realTags[i];
  };
  const real = realOf;
  const shared = (a: Activity, b: Activity) =>
    real(a)
      .filter((t) => b.tags.includes(t))
      .sort((x, y) => weight(y) - weight(x));
  const bridgeCache = new Float32Array(n * n).fill(-1);
  const simCache = new Float32Array(n * n).fill(-1);
  const pairKey = (a: Activity, b: Activity) => {
    const i = index.get(a.id);
    const j = index.get(b.id);
    return i === undefined || j === undefined ? -1 : i * n + j;
  };
  const bridge = (a: Activity, b: Activity) => {
    const k = pairKey(a, b);
    if (k >= 0 && bridgeCache[k] >= 0) return bridgeCache[k];
    let sum = 0;
    for (const t of real(a)) if (b.tags.includes(t)) sum += weight(t);
    if (k >= 0) bridgeCache[k] = sum;
    return sum;
  };

  const sim = (a: Activity, b: Activity) => {
    const k = pairKey(a, b);
    if (k >= 0 && simCache[k] >= 0) return simCache[k];
    const ta = new Set(real(a));
    const tb = new Set(real(b));
    let value = 0;
    if (ta.size > 0 && tb.size > 0) {
      let inter = 0;
      let union = 0;
      for (const t of new Set([...ta, ...tb])) {
        const w = weight(t);
        union += w;
        if (ta.has(t) && tb.has(t)) inter += w;
      }
      value = 0.6 * (union ? inter / union : 0) + (a.domain === b.domain ? 0.25 : 0) + (a.sub === b.sub ? 0.15 : 0);
    }
    if (k >= 0) simCache[k] = value;
    return value;
  };

  // Mean tag weight per activity, stretched over the whole library to 0..1.
  const rawRarity = new Map<string, number>();
  for (const a of activities) {
    const r = real(a);
    rawRarity.set(a.id, r.length ? r.reduce((sum, t) => sum + weight(t), 0) / r.length : 0);
  }
  const values = [...rawRarity.values()];
  const lo = values.length ? Math.min(...values) : 0;
  const hi = values.length ? Math.max(...values) : 1;
  const rarity = (a: Activity) => (hi > lo ? ((rawRarity.get(a.id) ?? lo) - lo) / (hi - lo) : 0.5);

  const graph: Graph = { bridge, shared, sim, rarity };
  cache.set(activities, graph);
  return graph;
}
