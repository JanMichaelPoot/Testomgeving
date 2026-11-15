import { overlappingSeeds } from "@/lib/discovery/engine/overlap";
import type { Seed } from "@/lib/discovery/engine/types";

// Search Engine 2.0 (Stap 200), the planning and the choosing, in plain code. Where the old pipeline researched the five ideas of a book and then, one round at a
// time, replaced every idea without a real place (each replacement a new search round: $0.04-0.15), the new one researches a POOL in one go: the five ideas and a
// reserve that waits (a second selection of the same kind, excluding what is in the book). An idea without a real place is then swapped for the reserve idea of
// the same direction that does have one, which costs nothing more. Only what is still without a place afterwards goes to the rounds that already exist (broad,
// online, coverage): the targeted fallback.
//
// No model is asked to plan or to choose here, on purpose. The planner would be one extra call in front of a search call that already plans its own queries
// (it combines the activities into shared queries and reads the per-activity search terms), and the choice among verified candidates is made on facts the
// code has (a real option, its rating, the diversity rules the selection already applies), so a model would add cost and not information. Both can be tested
// against this version later; the measurement (scripts/compare-search.ts) is what decides.

/**
 * How many reserve selections wait next to the book (WINDOW_SEARCH_RESERVE, 1 to 3): every selection is one more idea per direction that can take the place of one without a real
 * place. More depth makes a swap more likely and the first search call a little dearer (every extra activity is more to read); the default is what the simulation
 * (generateFromSeeds.search2.test.ts) and the comparison (scripts/compare-search.ts) showed to be the cheapest for the same books.
 */
export const DEFAULT_RESERVE_DEPTH = 2;
export function reserveDepth(value: string | undefined = process.env.WINDOW_SEARCH_RESERVE): number {
  const n = Number((value ?? "").trim());
  return Number.isInteger(n) && n >= 1 && n <= 3 ? n : DEFAULT_RESERVE_DEPTH;
}

/** The ids a reserve selection must leave alone: everything in the book, and the other half of every combination in it. */
export function reserveExclusions(book: readonly Seed[]): string[] {
  return [...new Set(book.flatMap((s) => [s.activityId, s.hybrid?.partnerId ?? ""]).filter(Boolean))];
}

/** The reserve: what a second selection returned, minus whatever is in the book already (by activity or as the half of a combination). */
export function reserveFrom(book: readonly Seed[], selected: readonly Seed[]): Seed[] {
  const taken = new Set(reserveExclusions(book));
  return selected.filter((s) => !taken.has(s.activityId) && !taken.has(s.hybrid?.partnerId ?? ""));
}

export interface ReserveFillInput {
  /** The book as it is: the seeds in order, the wildcard last. */
  seeds: readonly Seed[];
  /** The researched reserve, in the order of preference of the selection. */
  reserve: readonly Seed[];
  /**
   * Whether a seed has a real option, judged inside the book it would be part of (one place, one idea): the book is the one the seed is evaluated in, so a place that an
   * earlier idea already has does not count for a later one.
   */
  hasOption: (seed: Seed, book: readonly Seed[]) => boolean;
  /** The activities the person chose themselves: an idea lacking one of these is first offered another choice of theirs. */
  ownPicks: ReadonlySet<string>;
  /** The world of an activity, for the rule of at most two ideas from one world. */
  domainOf: (activityId: string) => string | undefined;
  /** Optional: how good the option of a seed is (higher is better), to choose between several reserve ideas that qualify. */
  quality?: (seed: Seed) => number;
}

export interface ReserveFillResult {
  seeds: Seed[];
  swaps: { out: string; in: string }[];
}

/**
 * Swaps every idea without a real option for the reserve idea of the SAME direction (so the book keeps its shape: one familiar, one adjacent, one unexpected, one
 * stretch, one wildcard, and the "why it was chosen" of the new idea stays true) that has one. The new idea must keep the book varied: no repeated activity or combination
 * (overlappingSeeds), at most two ideas from one world, and a place that no other idea of the book has. A lacking choice of the person's own goes to another choice of
 * theirs first. Ideas without a qualifying reserve are left as they are for the later rounds.
 */
export function fillFromReserve(input: ReserveFillInput): ReserveFillResult {
  const { reserve, hasOption, ownPicks, domainOf } = input;
  let seeds = [...input.seeds];
  const used = new Set<Seed>();
  const swaps: { out: string; in: string }[] = [];
  // Own choices are repaired first: they have the narrowest set of acceptable replacements.
  const order = seeds.map((s, i) => ({ s, i })).sort((a, b) => Number(ownPicks.has(b.s.activityId)) - Number(ownPicks.has(a.s.activityId)) || a.i - b.i);
  for (const { s } of order) {
    const at = seeds.indexOf(s);
    if (at < 0 || hasOption(s, seeds)) continue;
    const candidates = reserve
      .filter((c) => !used.has(c) && c.direction === s.direction)
      .filter((c) => {
        const trial = seeds.map((x, i) => (i === at ? c : x));
        if (overlappingSeeds(trial).length > 0) return false;
        const worlds = new Map<string, number>();
        for (const x of trial) {
          const d = domainOf(x.activityId);
          if (d) worlds.set(d, (worlds.get(d) ?? 0) + 1);
        }
        if ([...worlds.values()].some((n) => n > 2)) return false;
        return hasOption(c, trial);
      });
    if (candidates.length === 0) continue;
    const wantsPick = ownPicks.has(s.activityId);
    const best = [...candidates]
      .map((c, i) => ({ c, i }))
      .sort((a, b) => (wantsPick ? Number(ownPicks.has(b.c.activityId)) - Number(ownPicks.has(a.c.activityId)) : 0) || (input.quality?.(b.c) ?? 0) - (input.quality?.(a.c) ?? 0) || a.i - b.i)[0].c;
    used.add(best);
    swaps.push({ out: s.activityId, in: best.activityId });
    seeds = seeds.map((x, i) => (i === at ? { ...best, ...(s.level !== undefined ? { level: s.level } : {}) } : x));
  }
  return { seeds, swaps };
}
