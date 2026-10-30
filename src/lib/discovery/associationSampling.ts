import { hashSeed, mulberry32, shuffled } from "@/lib/discovery/rng";
import type { AssociationCardData, AssociationRound } from "@/lib/discovery/associationProfile";

// Which images of a round one visitor sees. A round has a score of FAMILIES (one feeling each, with
// the same tags and axes) and every family has several variants (other images of that
// feeling). A visitor sees nine of those families and exactly one variant per family, so:
//   - what we read from a choice never depends on which variant happened to be shown,
//   - every round still covers the same ground: whichever nine are shown, each axis has at least
//     two feelings on both sides (see ENOUGH_PER_SIDE), so nobody gets a one-sided round,
//   - a second session shows other families and other images, and so does a second gift.
// Pure and deterministic for a seed (a refresh shows the same cards), no randomness of its own.
// Client-safe: no JSON import.

export const SEEN_CAP = 150;

/** How many cards a visitor sees in one round (a 3 x 3 grid). A round may have more families than this. */
export const ROUND_SIZE = 9;

/** Whichever families are shown, each axis keeps at least this many on its positive and on its negative side. */
export const ENOUGH_PER_SIDE = 2;
/** An axis value counts as a side from this far from zero. */
export const SIDE = 0.3;
export const AXES = ["social", "energy", "setting", "novelty"] as const;

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
  const shown = chooseFamilies(order, families, ROUND_SIZE);
  return shown.map((family) => pickVariant(families.get(family) as T[], `${opts.seed}:${round}:${family}`, rank, keep));
}

/**
 * The one variant of a family a visitor sees: the one they already chose, else an unseen one, else the one seen
 * longest ago; a tie is settled by the seed text, so a refresh shows the same variant.
 */
export function pickVariant<T extends { id: string }>(members: readonly T[], seedText: string, rank: ReadonlyMap<string, number>, keep: ReadonlySet<string>): T {
  const kept = members.find((m) => keep.has(m.id));
  if (kept) return kept;
  const score = (m: T) => rank.get(m.id) ?? -1;
  const best = Math.min(...members.map(score));
  const pool = members.filter((m) => score(m) === best);
  return pool[Math.floor(mulberry32(hashSeed(seedText))() * pool.length)];
}

/**
 * The few examples a direction card shows ("kleiduifschieten · bouldering · via ferrata"): one per
 * sub-domain first, so they do not all come from the same corner, then whatever is left. Another seed
 * shows other examples, the same seed always the same ones (a refresh changes nothing).
 */
export function sampleWorldExamples(
  examples: readonly { label: string; sub: string }[],
  seed: string,
  world: string,
  count = 3,
): string[] {
  if (examples.length === 0) return [];
  const rnd = mulberry32(hashSeed(`${seed}:world:${world}`));
  const order = shuffled([...examples], rnd);
  const picked: { label: string; sub: string }[] = [];
  const subs = new Set<string>();
  for (const e of order) {
    if (picked.length === count) break;
    if (subs.has(e.sub)) continue;
    subs.add(e.sub);
    picked.push(e);
  }
  for (const e of order) {
    if (picked.length === count) break;
    if (!picked.includes(e)) picked.push(e);
  }
  return picked.map((e) => e.label);
}

/** How many directions (worlds) one visitor sees at a time. The library has more; "show other directions" rotates. */
export const DIRECTIONS_SHOWN = 10;

/** The directions in a fixed, seed-dependent order; the first screen shows the first ten, a rotation walks on. */
export function directionOrder(ids: readonly string[], seed: string): string[] {
  return shuffled([...ids], mulberry32(hashSeed(`${seed}:directions`)));
}

/**
 * The directions on the first screen: the first ten of the order, plus any the visitor already chose
 * (a restored draft) in place of the last unchosen ones. Never depends on choosing, so choosing a tile
 * moves no other tile.
 */
export function initialDirections(order: readonly string[], chosen: readonly string[], size = DIRECTIONS_SHOWN): string[] {
  if (order.length <= size) return [...order];
  const window = order.slice(0, size);
  const extras = chosen.filter((id) => order.includes(id) && !window.includes(id));
  if (extras.length === 0) return window;
  const keep = window.filter((id) => chosen.includes(id));
  const rest = window.filter((id) => !chosen.includes(id)).slice(0, Math.max(0, size - keep.length - extras.length));
  return [...keep, ...extras, ...rest];
}

/**
 * "Show other directions": what the visitor chose stays, the rest is replaced by directions not shown yet
 * (and, when those run out, by the ones shown longest ago). Deterministic for the same order and input.
 */
export function rotateDirections(order: readonly string[], current: readonly string[], chosen: readonly string[], size = DIRECTIONS_SHOWN): string[] {
  if (order.length <= size) return [...order];
  const kept = current.filter((id) => chosen.includes(id));
  const taken = new Set(kept);
  const fresh = order.filter((id) => !current.includes(id) && !taken.has(id));
  const recycled = order.filter((id) => current.includes(id) && !taken.has(id));
  return [...kept, ...fresh, ...recycled].slice(0, size);
}

/** The seen list after showing `shown`: those ids move to the end (most recent), the list stays short. */
export function mergeSeen(seen: readonly string[], shown: readonly string[], cap: number = SEEN_CAP): string[] {
  const shownSet = new Set(shown);
  return [...seen.filter((id) => !shownSet.has(id)), ...shown].slice(-cap);
}

/**
 * Which `size` families of the (shuffled) order to show. The default is the first `size`; but when
 * that leaves an axis one-sided (fewer than `need` families on a side the pool can fill), the
 * omissions are moved: of all ways to leave out the surplus, the first one (preferring to leave out
 * families late in the order) that lacks nothing is used, otherwise the one that lacks least.
 * Depends only on the order and the families, never on what the visitor has chosen, so choosing a
 * card moves no other card.
 */
export function chooseFamilies<T extends AssociationCardData>(order: readonly string[], families: ReadonlyMap<string, T[]>, size: number): string[] {
  const surplus = order.length - size;
  if (surplus <= 0) return [...order];
  const axesOf = (family: string) => (families.get(family) as T[])[0].axes;
  const need = (axis: (typeof AXES)[number]) => (axis === "novelty" ? 1 : ENOUGH_PER_SIDE);
  const sides = AXES.flatMap((axis) => ([1, -1] as const).map((sign) => ({ axis, sign })));
  const count = (list: readonly string[], axis: (typeof AXES)[number], sign: 1 | -1) => list.filter((f) => axesOf(f)[axis] * sign >= SIDE).length;
  // Only demand what the whole pool can give.
  const want = sides.map(({ axis, sign }) => Math.min(need(axis), count(order, axis, sign)));
  const lack = (list: readonly string[]) => sides.reduce((sum, { axis, sign }, i) => sum + Math.max(0, want[i] - count(list, axis, sign)), 0);

  // All ways to leave out `surplus` positions, those omitting later positions first.
  const combos: number[][] = [];
  const walk = (start: number, chosen: number[]) => {
    if (chosen.length === surplus) return void combos.push([...chosen]);
    for (let i = start; i < order.length; i++) walk(i + 1, [...chosen, i]);
  };
  // With a handful of omissions every way is tried. With many (a round of twenty families shows nine) that is
  // far too many, so the first nine are repaired by swapping in later families (see below).
  const exhaustive = surplus <= 4 && order.length <= 20;
  if (exhaustive) walk(0, []);
  else combos.push(Array.from({ length: surplus }, (_, i) => size + i));
  combos.sort((a, b) => b.reduce((x, y) => x + y, 0) - a.reduce((x, y) => x + y, 0));

  let best = { list: order.slice(0, size), lacking: Infinity };
  for (const omit of combos) {
    const list = order.filter((_, i) => !omit.includes(i));
    const lacking = lack(list);
    if (lacking < best.lacking) best = { list, lacking };
    if (lacking === 0) break;
  }
  if (exhaustive || best.lacking === 0) return best.list;

  // Repair: while a side is short, swap the latest shown family for the earliest unshown one that improves it.
  let list = [...best.list];
  for (let guard = 0; guard < size * 3 && lack(list) > 0; guard++) {
    const now = lack(list);
    const rest = order.filter((f) => !list.includes(f));
    let swapped = false;
    outer: for (const candidate of rest) {
      for (let i = list.length - 1; i >= 0; i--) {
        const next = [...list];
        next[i] = candidate;
        if (lack(next) < now) {
          list = next;
          swapped = true;
          break outer;
        }
      }
    }
    if (!swapped) break;
  }
  // Keep the order of the shuffle, so the grid does not depend on which swaps happened.
  return order.filter((f) => list.includes(f));
}
