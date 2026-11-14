import type { Seed } from "@/lib/discovery/engine/types";

/**
 * Pairs of ideas in one book that are the same idea twice: a curated combination ("letters with a fountain pen") next to its own pick ("fountain pens"), or
 * two combinations built on the same pick. They share their providers, so the reader meets one pen shop twice (the Laren book of 14 Nov 2026).
 * The selection never builds such a pair (select.ts); this is the check that says so when something else ever does (the pipeline notes it, the tests hold the engine to it).
 */
export function overlappingSeeds(seeds: readonly Pick<Seed, "activityId" | "hybrid">[]): [string, string][] {
  const out: [string, string][] = [];
  for (let i = 0; i < seeds.length; i++) {
    for (let j = i + 1; j < seeds.length; j++) {
      const a = seeds[i];
      const b = seeds[j];
      const pa = a.hybrid?.partnerId;
      const pb = b.hybrid?.partnerId;
      if (a.activityId === b.activityId || (pa && pa === b.activityId) || (pb && pb === a.activityId) || (pa && pa === pb)) out.push([a.activityId, b.activityId]);
    }
  }
  return out;
}
