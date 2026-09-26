import type { IdeaDoor } from "@/lib/claude/ideaBookTypes";
import type { Activity, Hybrid, SocialFormat, Tag } from "@/lib/discovery/types";
import { SOCIAL_FORMATS } from "@/lib/discovery/types";
import { hashSeed, mulberry32, shuffled } from "@/lib/discovery/rng";
import { BRIDGE_MIN, buildGraph } from "@/lib/discovery/engine/graph";
import { passesConstraints, resolveConstraints } from "@/lib/discovery/engine/constraints";
import type { Direction, EngineInput, EngineResult, Seed } from "@/lib/discovery/engine/types";

// The selection engine. Six regular seeds in four directions, plus one wildcard:
//   familiar x2   the pick itself, or a direct neighbour of it
//   adjacent x2   a related but new activity (a real bridge to a pick, not the same sub-domain)
//   unexpected x1 far from every pick, reached by a curated combination or a two-step chain
//   stretch x1    one facet the person did not fix is turned up (never the social form)
//   wildcard x1   a random prompt from a world they did not pick (random decides WHICH, not IF it fits)
// Every step respects the hard constraints (constraints.ts) and the diversity rules
// (at most 2 per domain, no two from one sub-domain, nothing shown recently).

export interface EngineLibrary {
  activities: readonly Activity[];
  tags: readonly Tag[];
  hybrids: readonly Hybrid[];
}

const DOOR: Record<Direction, IdeaDoor> = {
  familiar: "natural",
  adjacent: "discovery",
  unexpected: "unexpected",
  stretch: "stretch",
  wildcard: "wildcard",
  explore: "discovery", // replaced by a challenge-based door in explore mode
};
const DOOR_ORDER: IdeaDoor[] = ["natural", "discovery", "unexpected", "stretch"];

const WILDNESS: Record<string, number> = { grounded: 0, practical: 0, either: 1, unexpected: 2, wild: 3 };

/** How demanding an activity is for a beginner: used to hand out doors when nothing is known. */
export function challenge(a: Activity): number {
  return (a.level ?? 1) + (a.intensity ?? 1) * 0.7 + (a.safety.tier === 2 ? 1 : 0) + (a.cost ?? 1) / 3;
}

export function selectSeeds(input: EngineInput, lib: EngineLibrary): EngineResult {
  const rnd = mulberry32(hashSeed(input.seed));
  const notes: string[] = [];
  const all = lib.activities.filter((a) => a.status !== "retired");
  const byId = new Map(all.map((a) => [a.id, a]));
  const graph = buildGraph(all, lib.tags);
  const constraints = resolveConstraints(input);
  const history = new Set(input.history ?? []);

  const pickedIds = [...new Set(input.interests)].filter((id) => byId.has(id));
  const pickSet = new Set(pickedIds);

  // --- the pool: what may be suggested at all ------------------------------------
  const verifyOf = new Map<string, string[]>();
  const pool: Activity[] = [];
  for (const a of all) {
    const r = passesConstraints(a, constraints);
    if (!r.ok) continue;
    if (history.has(a.id) && !pickSet.has(a.id)) continue; // not repeated across sessions
    verifyOf.set(a.id, [...new Set([...r.verify, ...constraints.verify])]);
    pool.push(a);
  }
  if (pool.length < 12) notes.push("pool_small");

  // --- what we reason from ---------------------------------------------------------
  const refs: Activity[] = pickedIds.map((id) => byId.get(id)!);
  const pickedDomains = new Set(refs.map((a) => a.domain));
  const chosenWorlds = new Set(input.interestDomains);
  if (refs.length === 0 && chosenWorlds.size > 0) {
    // Worlds but no cards: two random activities per chosen world stand in as the taste.
    for (const d of shuffled([...chosenWorlds], rnd).slice(0, 3)) {
      refs.push(...shuffled(pool.filter((a) => a.domain === d), rnd).slice(0, 2));
    }
    refs.forEach((a) => pickedDomains.add(a.domain));
    notes.push("worlds_only");
  }
  const explore = refs.length === 0;
  if (explore) notes.push(input.surpriseMe ? "surprise_me" : "no_picks");

  const rel = (a: Activity) => refs.reduce((m, r) => Math.max(m, graph.sim(a, r)), 0);
  const bestBridgeTo = (a: Activity) => refs.reduce((m, r) => Math.max(m, graph.bridge(a, r)), 0);
  const nearestRef = (a: Activity) => refs.reduce<Activity | null>((best, r) => (!best || graph.bridge(a, r) > graph.bridge(a, best) ? r : best), null);

  // --- bookkeeping -----------------------------------------------------------------
  const seeds: Seed[] = [];
  const used = new Set<string>();
  const domainCount = new Map<string, number>();
  const subUsed = new Set<string>();

  const canUse = (a: Activity, relax: 0 | 1 | 2) => {
    if (used.has(a.id)) return false;
    if ((domainCount.get(a.domain) ?? 0) >= (relax === 2 ? 3 : 2)) return false;
    if (relax === 0 && subUsed.has(a.sub)) return false;
    return true;
  };

  // Themes should not pile up: an idea that shares its connections with ideas already
  // chosen (four walks in a row) scores lower, so the set stays varied in feel, not
  // just in world.
  const redundancy = (a: Activity) => {
    let sum = 0;
    for (const u of seeds) sum += graph.bridge(a, byId.get(u.activityId)!);
    return sum * 0.05;
  };

  const formatsFor = (a: Activity): { lead: SocialFormat | null; also: SocialFormat[] } => {
    if (!a.formats) return { lead: null, also: [] };
    const wanted = constraints.formats ?? [];
    const lead = wanted.find((f) => a.formats!.includes(f)) ?? null;
    const also = a.formats.filter((f) => f !== lead);
    return { lead, also };
  };

  function commit(a: Activity, direction: Direction, extra: Partial<Pick<Seed, "chain" | "via" | "hybrid">> = {}, door?: IdeaDoor) {
    const { lead, also } = formatsFor(a);
    seeds.push({
      activityId: a.id,
      direction,
      door: door ?? DOOR[direction],
      chain: extra.chain ?? [a.id],
      via: extra.via ?? [],
      ...(extra.hybrid ? { hybrid: extra.hybrid } : {}),
      lead,
      alsoFormats: also,
      verify: verifyOf.get(a.id) ?? [],
    });
    used.add(a.id);
    domainCount.set(a.domain, (domainCount.get(a.domain) ?? 0) + 1);
    subUsed.add(a.sub);
  }

  type Cand<T = object> = { a: Activity; score: number } & T;

  /** Highest score that fits the diversity rules, loosening them one step at a time. */
  function best<T>(cands: Cand<T>[]): Cand<T> | null {
    for (const relax of [0, 1, 2] as const) {
      let top: Cand<T> | null = null;
      for (const c of cands) if (canUse(c.a, relax) && (!top || c.score > top.score)) top = c;
      if (top) return top;
    }
    return null;
  }

  /**
   * Tries several candidate sets (best-fitting first) and only gives up a diversity rule
   * (a third idea from one world) after every set failed to fit within the rules: it is
   * better to settle for a weaker connection than to pile ideas into one world.
   * Returns which set the winner came from (0 = the preferred one).
   */
  function firstFit<T>(builders: (() => Cand<T>[])[]): { top: Cand<T>; set: number } | null {
    const sets = builders.map((b) => b());
    for (const maxRelax of [1, 2] as const) {
      for (let i = 0; i < sets.length; i++) {
        let top: Cand<T> | null = null;
        for (const c of sets[i]) {
          const fits = ([0, 1, 2] as const).filter((r) => r <= maxRelax).some((r) => canUse(c.a, r));
          if (fits && (!top || c.score > top.score)) top = c;
        }
        if (top) return { top, set: i };
      }
    }
    return null;
  }

  // --- explore: nothing to go on -----------------------------------------------------
  if (explore) {
    const domains = shuffled([...new Set(pool.map((a) => a.domain))], rnd);
    const chosen: Activity[] = [];
    for (const d of domains) {
      if (chosen.length === 6) break;
      const inDomain = pool.filter((a) => a.domain === d && a.entry);
      const pickOne = shuffled(inDomain.length ? inDomain : pool.filter((a) => a.domain === d), rnd)[0];
      if (pickOne) chosen.push(pickOne);
    }
    // Doors by how demanding it is: the gentlest first.
    const ranked = [...chosen].sort((x, y) => challenge(x) - challenge(y));
    const doors: IdeaDoor[] = ["natural", "natural", "discovery", "discovery", "unexpected", "stretch"];
    ranked.forEach((a, i) => commit(a, "explore", {}, doors[i] ?? "discovery"));
    // A world not used yet if there is one; with a very tight pool, any unused activity.
    const rest = domains.filter((d) => !domainCount.has(d));
    const wild =
      shuffled(pool.filter((a) => rest.includes(a.domain) && canUse(a, 1)), rnd)[0] ??
      shuffled(pool.filter((a) => canUse(a, 2)), rnd)[0];
    if (wild) commit(wild, "wildcard");
    return finish();
  }

  // --- familiar x2 ---------------------------------------------------------------------
  for (let i = 0; i < 2; i++) {
    const cands: Cand[] = [];
    for (const a of pool) {
      const picked = pickSet.has(a.id);
      const near = pickedDomains.has(a.domain) && rel(a) >= 0.4;
      if (!picked && !near) continue;
      // A second familiar idea prefers another world when the person picked from several.
      const spread = 0.35 * (domainCount.get(a.domain) ?? 0);
      cands.push({ a, score: (picked ? 2 : rel(a)) + rnd() * 0.3 - spread });
    }
    const top = best(cands);
    if (!top) {
      notes.push("direction_relaxed:familiar");
      break;
    }
    commit(top.a, "familiar");
  }

  // --- unexpected x1: curated combination first, then a two-step chain (before adjacent, so the partner of a curated combination is not used up as a plain neighbour) -------------------
  {
    type Path = { chain: string[]; via: string[]; hybrid?: Seed["hybrid"] };
    // (a) a curated combination of a pick with something from another world, and
    // (b) pick -> middle -> far activity, every step with a real bridge
    const strong = (): Cand<Path>[] => {
      const cands: Cand<Path>[] = [];
      for (const h of lib.hybrids) {
        for (const [p, q] of [[h.a, h.b], [h.b, h.a]] as const) {
          const from = byId.get(p);
          const to = byId.get(q);
          if (!from || !to || !pickSet.has(p) || !pool.includes(to) || to.domain === from.domain) continue;
          cands.push({
            a: to,
            score: 2.5 + graph.bridge(from, to) * 0.15 + rnd() * 0.3 - redundancy(to),
            chain: [p, q],
            via: graph.shared(from, to).slice(0, 2),
            hybrid: { partnerId: p, label: h.label },
          });
        }
      }
      for (const x of pool) {
        if (pickedDomains.has(x.domain) || rel(x) >= 0.3) continue;
        let top: Cand<Path> | null = null;
        for (const p of refs) {
          for (const m of all) {
            if (m.id === p.id || m.id === x.id) continue;
            const b1 = graph.bridge(p, m);
            if (b1 < BRIDGE_MIN) continue;
            if (graph.bridge(m, x) < BRIDGE_MIN) continue;
            const score = Math.min(graph.sim(p, m), graph.sim(m, x)) + rnd() * 0.05 - redundancy(x);
            if (!top || score > top.score) top = { a: x, score, chain: [p.id, m.id, x.id], via: graph.shared(m, x).slice(0, 2) };
          }
        }
        if (top) cands.push(top);
      }
      return cands;
    };
    // (c) one step with a real bridge
    const oneStep = (): Cand<Path>[] =>
      pool
        .filter((x) => !pickedDomains.has(x.domain) && rel(x) < 0.3 && bestBridgeTo(x) >= BRIDGE_MIN)
        .map((x) => {
          const p = nearestRef(x)!;
          return { a: x, score: bestBridgeTo(x) * 0.1 + rnd() * 0.05 - redundancy(x), chain: [p.id, x.id], via: graph.shared(p, x).slice(0, 2) };
        });
    // (d) anything from a world they did not pick
    const anyFar = (): Cand<Path>[] =>
      pool.filter((a) => !pickedDomains.has(a.domain)).map((x) => ({ a: x, score: rnd(), chain: [x.id], via: [] }));

    const found = firstFit<Path>([strong, oneStep, anyFar]);
    if (found) {
      if (found.set > 0) notes.push(`direction_relaxed:unexpected${found.set === 2 ? ":random" : ""}`);
      commit(found.top.a, "unexpected", { chain: found.top.chain, via: found.top.via, hybrid: found.top.hybrid });
    } else notes.push("direction_missing:unexpected");
  }

  // --- adjacent x2 ---------------------------------------------------------------------
  for (let i = 0; i < 2; i++) {
    const set = (lo: number, hi: number, minBridge: number) => () =>
      pool
        .filter((a) => !pickSet.has(a.id) && rel(a) >= lo && rel(a) < hi && bestBridgeTo(a) >= minBridge)
        .map<Cand>((a) => {
          const r = rel(a);
          const novelty = pickedDomains.has(a.domain) ? 0 : 0.15;
          return { a, score: r * (1 - Math.abs(r - 0.38)) + novelty + rnd() * 0.05 - redundancy(a) };
        });
    const found = firstFit([set(0.2, 0.6, BRIDGE_MIN), set(0.1, 0.75, 1.2)]);
    if (!found) {
      notes.push("direction_relaxed:adjacent");
      break;
    }
    if (found.set > 0) notes.push("direction_relaxed:adjacent");
    const from = nearestRef(found.top.a);
    commit(found.top.a, "adjacent", from ? { chain: [from.id, found.top.a.id], via: graph.shared(from, found.top.a).slice(0, 2) } : {});
  }

  // --- stretch x1: turn up one facet they did not fix ------------------------------------
  {
    const scale = WILDNESS[input.practicalToWild] ?? 1;
    // The reference is the most physically demanding pick, so "more" means more than that.
    const p0 = [...refs].sort((x, y) => (y.intensity ?? 0) - (x.intensity ?? 0) || rnd() - 0.5)[0];
    const fixedForm = constraints.formats !== null;
    const magnitude = (x: Activity) => {
      const settingFlip = x.setting && p0.setting && x.setting !== "both" && p0.setting !== "both" && x.setting !== p0.setting ? 1 : 0;
      const intensityUp = Math.max(0, (x.intensity ?? p0.intensity ?? 0) - (p0.intensity ?? 0));
      const levelUp = Math.max(0, (x.level ?? 0) - (p0.level ?? 0));
      const durationUp = x.duration !== null && p0.duration !== null && x.duration > p0.duration ? 0.5 : 0;
      // A way of taking part none of the picks offers. Never counts when they fixed a form themselves.
      const newForm =
        !fixedForm && x.formats && x.formats.some((f) => !refs.some((r) => r.formats?.includes(f))) ? 0.7 : 0;
      const otherWorld = x.domain !== p0.domain ? 0.5 : 0;
      return {
        total: settingFlip + intensityUp + levelUp * 0.5 + durationUp + newForm + otherWorld,
        down: x.intensity !== null && p0.intensity !== null && x.intensity < p0.intensity,
      };
    };
    // How much "more" is fitting for this person: gentle for the cautious, bigger for the adventurous.
    const target = [1, 1.2, 2, 2.8][scale] ?? 1.2;
    const set = (minBridge: number, minTotal: number, strict: boolean) => () =>
      pool
        .filter((a) => !pickSet.has(a.id) && graph.bridge(a, p0) >= minBridge)
        .map((a) => ({ a, m: magnitude(a) }))
        .filter(({ m }) => m.total >= minTotal && (!m.down || minBridge === 0) && (!strict || m.total <= target + 1))
        .map<Cand>(({ a, m }) => ({ a, score: 2 - Math.abs(m.total - target) + graph.bridge(a, p0) * 0.15 + rnd() * 0.2 - redundancy(a) }));
    const found = firstFit([set(1.5, 1, true), set(0.8, 1, true), set(0.8, 0.7, false), set(0, 0.5, false)]);
    if (found) {
      if (found.set > 1) notes.push("direction_relaxed:stretch");
      commit(found.top.a, "stretch", { chain: [p0.id, found.top.a.id], via: graph.shared(p0, found.top.a).slice(0, 2) });
    } else {
      notes.push("direction_missing:stretch");
    }
  }

  // --- fill: never fewer than six regular seeds when the pool allows it -------------------
  while (seeds.length < 6) {
    const top = best(pool.filter((a) => !pickSet.has(a.id) && rel(a) > 0.05).map<Cand>((a) => ({ a, score: rel(a) + rnd() * 0.05 })))
      ?? best(pool.map<Cand>((a) => ({ a, score: rnd() })));
    if (!top) break;
    notes.push("filled");
    const from = nearestRef(top.a);
    commit(top.a, "adjacent", from ? { chain: [from.id, top.a.id], via: graph.shared(from, top.a).slice(0, 2) } : {});
  }

  // --- wildcard: a random prompt from a world nobody picked -------------------------------
  {
    const historyDomains = new Set([...history].map((id) => byId.get(id)?.domain).filter(Boolean) as string[]);
    const cands = pool.filter((a) => !pickedDomains.has(a.domain) && canUse(a, 1));
    const weightOf = (a: Activity) => (1 + 2 * bestBridgeTo(a) + (historyDomains.has(a.domain) ? 0 : 2)) / (1 + redundancy(a) * 4);
    const total = cands.reduce((s, a) => s + weightOf(a), 0);
    let roll = rnd() * total;
    let chosen: Activity | undefined;
    for (const a of cands) {
      roll -= weightOf(a);
      if (roll <= 0) {
        chosen = a;
        break;
      }
    }
    chosen ??= cands[0] ?? pool.find((a) => canUse(a, 2));
    if (chosen) {
      const from = bestBridgeTo(chosen) >= 1 ? nearestRef(chosen) : null;
      commit(chosen, "wildcard", from ? { chain: [from.id, chosen.id], via: graph.shared(from, chosen).slice(0, 2) } : {});
    } else notes.push("direction_missing:wildcard");
  }

  return finish();

  function finish(): EngineResult {
    // Regular seeds by door (as in the Idea Book), the wildcard last; stable within a door.
    const regular = seeds.filter((s) => s.direction !== "wildcard");
    const wildcard = seeds.filter((s) => s.direction === "wildcard");
    const ordered = [...regular].sort((a, b) => DOOR_ORDER.indexOf(a.door) - DOOR_ORDER.indexOf(b.door));
    return { seeds: [...ordered, ...wildcard], constraints, notes };
  }
}

/** Exposed for tests and the evaluation script. */
export const ALL_SOCIAL_FORMATS = SOCIAL_FORMATS;
