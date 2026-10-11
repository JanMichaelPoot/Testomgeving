import { hashSeed, mulberry32, shuffled } from "@/lib/discovery/rng";
import type { AssociationCardData, AssociationRound } from "@/lib/discovery/associationProfile";

// Which images of a round one visitor sees. A round has nine FAMILIES (one feeling each, with
// the same tags and axes) and every family has several variants (other images of that
// feeling). A visitor sees exactly one variant per family, so:
//   - what we read from a choice never depends on which variant happened to be shown,
//   - every round still covers the same ground (all families, hence all axes),
//   - a second session shows other images, and so does a second gift for someone else.
// Pure and deterministic for a seed (a refresh shows the same cards), no randomness of its own.
// Client-safe: no JSON import.

export const SEEN_CAP = 150;

export interface SampleOptions {
  /** Makes the result reproducible; one per session, kept in the draft. */
  seed: string;
  /** Card ids this browser saw before, oldest first. Unseen variants are preferred. */
  seen?: readonly string[];
  /** Ids that must stay (the visitor already chose them); their family shows that variant. */
  keep?: readonly string[];
}

const familyOf = (c: AssociationCardData) => c.family ?? c.id;

export function sampleRoundCards<T extends AssociationCardData>(cards: readonly T[], round: AssociationRound, opts: SampleOptions): T[] {
  const inRound = cards.filter((c) => c.round === round);
  const families = new Map<string, T[]>();
  for (const c of inRound) families.set(familyOf(c), [...(families.get(familyOf(c)) ?? []), c]);

  const rank = new Map((opts.seen ?? []).map((id, i) => [id, i]));
  const keep = new Set(opts.keep ?? []);

  // The order depends on the seed and the round only; every family settles its own tie with a
  // generator of its own, so choosing a card (which changes nothing but that family) never moves
  // the other cards.
  const order = shuffled([...families.keys()], mulberry32(hashSeed(`${opts.seed}:${round}:order`)));
  return order.map((family) => {
    const members = families.get(family) as T[];
    const kept = members.find((m) => keep.has(m.id));
    if (kept) return kept;
    // Unseen first, then the one seen longest ago; a tie is settled by the seed.
    const score = (m: T) => rank.get(m.id) ?? -1;
    const best = Math.min(...members.map(score));
    const pool = members.filter((m) => score(m) === best);
    return pool[Math.floor(mulberry32(hashSeed(`${opts.seed}:${round}:${family}`))() * pool.length)];
  });
}

/** The seen list after showing `shown`: those ids move to the end (most recent), the list stays short. */
export function mergeSeen(seen: readonly string[], shown: readonly string[], cap: number = SEEN_CAP): string[] {
  const shownSet = new Set(shown);
  return [...seen.filter((id) => !shownSet.has(id)), ...shown].slice(-cap);
}
