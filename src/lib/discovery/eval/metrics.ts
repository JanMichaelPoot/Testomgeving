import type { IdeaBookEntry } from "@/lib/claude/ideaBookTypes";
import { getActivity, TAGS } from "@/lib/discovery/library";
import { evaluate, type EvaluateOptions, type Run } from "@/lib/discovery/engine/evaluate";
import type { EngineLibrary } from "@/lib/discovery/engine/select";
import { photoCategoryFor } from "@/lib/discovery/engine/photo";
import { scoresForSeed } from "@/lib/discovery/engine/scores";
import { pickOneThingIndex } from "@/lib/possibilityMap";
import { activityKindFor } from "@/lib/pdf/ideaContent";

// The measures of the baseline (docs/knowledge-engine-audit.md, section 3): the engine's own acceptance
// criteria plus the diversity and reliability measures the audit added. Pure and deterministic.

export interface Metrics {
  profiles: number;
  seeds: number;
  /** Number of violations of the hard rules (must be 0). */
  violations: { E1: number; E3: number; E4: number; E5: number; E6: number };
  /** Share of profiles (0..1) meeting the softer criteria of engine/evaluate.ts. */
  rates: Record<string, number>;
  notes: Record<string, number>;
  worldsPerBook: number;
  subsPerBook: number;
  photoCategoriesPerBook: number;
  kindsPerBook: number;
  /** Share of books with two ideas that share two or more non-generic tags. */
  pairBooks: number;
  /** Share of books with two ideas in one sub-domain. */
  sameSubBooks: number;
  /** Share of books in which a direction had to be relaxed. */
  relaxedBooks: number;
  verifySeeds: number;
  tier2Seeds: number;
  costUnknownSeeds: number;
  freeBudgetBooks: number;
  freeBudgetWithUnknownCost: number;
  socialKindShare: number;
  /** Which door "Als je er maar één kiest" picks, as a share of books. */
  oneThingByDoor: Record<string, number>;
  activitiesUsed: number;
  topActivity: { id: string; share: number };
  top10Share: number;
}

const GENERIC = new Set(TAGS.filter((t) => t.generic).map((t) => t.id));
const share = (n: number, d: number) => (d === 0 ? 0 : n / d);

export function computeMetrics(runs: readonly Run[], lib: EngineLibrary, opts: EvaluateOptions = {}): Metrics {
  const report = evaluate(runs, lib, opts);
  let worlds = 0, subs = 0, cats = 0, kinds = 0, pairBooks = 0, sameSubBooks = 0, relaxed = 0;
  let verify = 0, tier2 = 0, costUnknown = 0, seedTotal = 0, social = 0, freeBooks = 0, freeUnknown = 0;
  const oneThing = new Map<string, number>();
  const perActivity = new Map<string, number>();
  const slots = new Map<string, number>();

  for (const run of runs) {
    const as = run.result.seeds.map((s) => getActivity(s.activityId)!);
    worlds += new Set(as.map((a) => a.domain)).size;
    subs += new Set(as.map((a) => a.sub)).size;
    cats += new Set(as.map((a) => photoCategoryFor(a))).size;
    const kindOf = (a: (typeof as)[number]) => activityKindFor({ photo_category: photoCategoryFor(a) });
    kinds += new Set(as.map(kindOf)).size;
    let pair = false;
    for (let i = 0; i < as.length && !pair; i++) {
      for (let j = i + 1; j < as.length; j++) {
        if (as[i].tags.filter((t) => !GENERIC.has(t) && as[j].tags.includes(t)).length >= 2) {
          pair = true;
          break;
        }
      }
    }
    if (pair) pairBooks++;
    if (new Set(as.map((a) => a.sub)).size < as.length) sameSubBooks++;
    if (run.result.notes.some((n) => n.startsWith("direction_relaxed"))) relaxed++;
    for (const id of new Set(as.map((a) => a.id))) perActivity.set(id, (perActivity.get(id) ?? 0) + 1);

    for (const s of run.result.seeds) {
      const a = getActivity(s.activityId)!;
      seedTotal++;
      slots.set(a.id, (slots.get(a.id) ?? 0) + 1);
      if (s.verify.length) verify++;
      if (a.safety.tier === 2) tier2++;
      if (a.cost === null) costUnknown++;
      if (kindOf(a) === "social") social++;
    }
    if (run.profile.input.budget === "free") {
      freeBooks++;
      if (as.some((a) => a.cost === null)) freeUnknown++;
    }

    // "If you only pick one": the real pick function on the real scores, the six regular ideas only.
    const regular = run.result.seeds.filter((s) => s.direction !== "wildcard");
    const entries = regular.map((s) => ({ door: s.door, scores: scoresForSeed(s, getActivity(s.activityId)!), ...(s.fit !== undefined ? { fit: Math.round(s.fit * 100) } : {}) }) as unknown as IdeaBookEntry);
    const pick = pickOneThingIndex(entries);
    if (pick !== null) oneThing.set(regular[pick].door, (oneThing.get(regular[pick].door) ?? 0) + 1);
  }

  const n = runs.length;
  const ranked = [...perActivity.entries()].sort((a, b) => b[1] - a[1]);
  const topSlots = [...slots.values()].sort((a, b) => b - a).slice(0, 10).reduce((s, v) => s + v, 0);
  const v = report.violations;
  return {
    profiles: n,
    seeds: seedTotal,
    violations: { E1: v.E1.length, E3: v.E3.length, E4: v.E4.length, E5: v.E5.length, E6: v.E6.length },
    rates: { ...report.rates },
    notes: report.notes,
    worldsPerBook: share(worlds, n),
    subsPerBook: share(subs, n),
    photoCategoriesPerBook: share(cats, n),
    kindsPerBook: share(kinds, n),
    pairBooks: share(pairBooks, n),
    sameSubBooks: share(sameSubBooks, n),
    relaxedBooks: share(relaxed, n),
    verifySeeds: share(verify, seedTotal),
    tier2Seeds: share(tier2, seedTotal),
    costUnknownSeeds: share(costUnknown, seedTotal),
    freeBudgetBooks: freeBooks,
    freeBudgetWithUnknownCost: freeUnknown,
    socialKindShare: share(social, seedTotal),
    oneThingByDoor: Object.fromEntries([...oneThing.entries()].map(([door, c]) => [door, share(c, n)])),
    activitiesUsed: perActivity.size,
    topActivity: ranked.length ? { id: ranked[0][0], share: share(ranked[0][1], n) } : { id: "", share: 0 },
    top10Share: share(topSlots, seedTotal),
  };
}
