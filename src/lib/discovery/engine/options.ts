import type { Activity } from "@/lib/discovery/types";
import { kindOfActivity } from "@/lib/discovery/activityKind";
import { clusterOf } from "@/lib/discovery/clusters";
import type { Graph } from "@/lib/discovery/engine/graph";
import { practicality } from "@/lib/discovery/engine/levels";
import type { Seed, SeedOption } from "@/lib/discovery/engine/types";
import type { Weights } from "@/lib/discovery/engine/weights";

// Options (docs/plan-activiteitenselectie.md, R1, A1 to A3): every idea of the book is the head of an option, a direction with three
// activities: the idea itself plus two companions from the library. The direction is the chosen theme the idea belongs to (or the two
// themes of a combination); the companions are the best-suited other activities in that direction. Pure and deterministic given the
// context: the selection (select.ts) decides the ideas, this decides what stands next to them.

/** A chosen theme and how close an activity's tags are to it (0..1, themeFit.ts). */
export interface OptionTheme {
  id: string;
  rel: (tags: readonly string[]) => number;
}

export interface OptionContext {
  /** The seeds of the book, regular ones first and the wildcard last: the earlier an idea comes, the earlier it picks its companions. */
  seeds: readonly Seed[];
  pool: readonly Activity[];
  byId: ReadonlyMap<string, Activity>;
  graph: Graph;
  themes: readonly OptionTheme[];
  /** The soft profile terms the selection already uses: age, audience, meeting, hub (higher = less likely), supply (higher = less likely), rarity lift. */
  age: (a: Activity) => number;
  supplyCost: (a: Activity) => number;
  rare: (a: Activity) => number;
  rnd: () => number;
  W: Weights["option"];
}

/** Overlap of two activities' tags (0..1). Two activities above the limit read as variations of one thing. */
export function tagOverlap(x: readonly string[], y: readonly string[]): number {
  const a = new Set(x);
  const shared = y.filter((t) => a.has(t)).length;
  return shared / Math.sqrt(Math.max(1, x.length) * Math.max(1, y.length));
}

/** The direction of each idea: its chosen theme, one that no other idea of the book uses when the idea fits more than one; a combination keeps both of its themes. */
function directionsOf(ctx: OptionContext): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const used = new Set<string>();
  for (const s of ctx.seeds) {
    if (s.themeCombo) {
      out.set(s.activityId, [...s.themeCombo]);
      s.themeCombo.forEach((t) => used.add(t));
      continue;
    }
    const a = ctx.byId.get(s.activityId);
    if (!a) continue;
    const fits = ctx.themes
      .map((t) => ({ id: t.id, rel: t.rel(a.tags) }))
      .filter((t) => t.rel >= ctx.W.minThemeRel)
      .sort((x, y) => y.rel - x.rel);
    const pick = fits.find((t) => !used.has(t.id)) ?? fits[0];
    if (pick) {
      out.set(s.activityId, [pick.id]);
      used.add(pick.id);
    } else out.set(s.activityId, []);
  }
  return out;
}

/** One option per seed: the direction (theme ids, empty when the idea fits none of the chosen themes) and two companion activities. */
export function buildOptions(ctx: OptionContext): Map<string, SeedOption> {
  const { W } = ctx;
  const directions = directionsOf(ctx);
  const taken = new Set(ctx.seeds.map((s) => s.activityId));
  const out = new Map<string, SeedOption>();
  const themeById = new Map(ctx.themes.map((t) => [t.id, t] as const));

  for (const seed of ctx.seeds) {
    const lead = ctx.byId.get(seed.activityId);
    if (!lead) continue;
    const themes = directions.get(seed.activityId) ?? [];
    const companions: Activity[] = [];

    for (let i = 0; i < 2; i++) {
      // A combination's two companions lean to one theme each, so both of its themes are in the option.
      const target = themes.length ? themeById.get(themes[i % themes.length]) : undefined;
      const chosenSubs = new Set([lead.sub, ...companions.map((c) => c.sub)]);
      const others = [lead, ...companions];
      const kinds = new Set(others.map((o) => kindOfActivity(o)));
      const clusters = new Set(others.map((o) => clusterOf(o.id)).filter(Boolean));
      const domainCount = (d: string) => others.filter((o) => o.domain === d).length;

      // Theme fit is asked at four levels, the strictest first: a weaker connection is better than a missing companion, and an option never
      // takes a companion that has nothing to do with its theme (the last level leans on the idea itself instead).
      const anyTheme = (tags: readonly string[]) => Math.max(0, ...themes.map((t) => themeById.get(t)?.rel(tags) ?? 0));
      const levels: { fit: ((tags: readonly string[]) => number) | null; floor: number }[] = target
        ? [
            { fit: target.rel, floor: W.minThemeRel },
            { fit: target.rel, floor: W.relaxedRel },
            { fit: anyTheme, floor: W.relaxedRel },
            { fit: null, floor: 0 },
          ]
        : [{ fit: null, floor: 0 }];
      for (const level of levels) {
        let top: { a: Activity; score: number } | null = null;
        for (const c of ctx.pool) {
          if (taken.has(c.id) || chosenSubs.has(c.sub)) continue;
          if (others.some((o) => tagOverlap(o.tags, c.tags) >= W.maxTagOverlap)) continue;
          const fit = level.fit ? level.fit(c.tags) : 0;
          if (level.fit && fit < level.floor) continue;
          const sim = ctx.graph.sim(lead, c);
          // Without a theme to lean on, the companion must at least be related to the idea itself.
          if (!level.fit && sim < 0.1) continue;
          const kind = kindOfActivity(c);
          const score =
            (level.fit ? W.theme * fit : 0) +
            W.sim * sim * (level.fit ? 1 : 2) +
            W.practical * practicality(c) +
            W.rare * ctx.rare(c) +
            ctx.rnd() * W.noise +
            (kinds.has(kind) ? 0 : W.otherKind) -
            (clusters.has(clusterOf(c.id)) && clusterOf(c.id) ? W.clusterPenalty : 0) -
            (domainCount(c.domain) >= 2 ? W.clusterPenalty : 0) -
            ctx.age(c) -
            ctx.supplyCost(c);
          if (!top || score > top.score) top = { a: c, score };
        }
        if (top) {
          companions.push(top.a);
          taken.add(top.a.id);
          break;
        }
      }
    }
    out.set(seed.activityId, { for: seed.activityId, themes, companions: companions.map((c) => c.id) });
  }
  return out;
}
