import { hashSeed, mulberry32, shuffled } from "@/lib/discovery/rng";
import { AXES, ENOUGH_PER_SIDE, SIDE, pickVariant } from "@/lib/discovery/associationSampling";
import type { AssociationCardData } from "@/lib/discovery/associationProfile";
import { REGISTERS, countRegisters, emptyCounts, type Register, type RegisterCounts } from "@/lib/discovery/registerTypes";

// The two image pages of the image intake (docs/plan-twee-beeldpagina-s.md, docs/fase4-opzet.md):
//   page 1  associative: 18 images, mixed from places, moments and senses, balanced over the four style registers
//   page 2  concrete:    18 activities that follow from page 1, with a floor per register and three exploring slots
//
// Why balanced: whoever chooses from an offer that is itself lopsided shows mostly what the offer was. A page 1 that gives
// every register the same chance makes the way somebody chooses say something about them, and page 2 can then follow it.
// The register is a property of an image or activity, never of the person: no gender is asked or stored, nothing here is
// kept with an answer, and the interface never shows a register (see register.ts).
//
// Pure and deterministic for a seed, client-safe (no JSON import): a refresh of the browser shows the same pages, and the
// server and the browser can run exactly the same code. Choosing a card never moves another card on the same page; only an
// explicit "show others" builds a new page, from what was not shown yet.

export const IMAGES_PAGE_SIZE = 18;
export const MIN_IMAGE_PICKS = 5;
export const MAX_IMAGE_PICKS = 8;
/** "Andere beelden" / "Andere activiteiten": at most this many new pages after the first. */
export const MAX_REFRESHES = 3;

export const CONCRETE_PAGE_SIZE = 18;
export const MIN_CONCRETE_PICKS = 3;
export const MAX_CONCRETE_PICKS = 6;
/** Slots on page 2 for things outside what the images pointed at ("Misschien ook?"). */
export const EXPLORE_SLOTS = 3;
/** Every register gets at least this many of the 18 on page 2, however one-sided the choice on page 1 was. */
export const MIN_PER_REGISTER = 2;

// --- page 1 -----------------------------------------------------------------------------------------------------------------

export type RegisteredCard = AssociationCardData & { register: Register };

const familyOf = (c: AssociationCardData) => c.family ?? c.id;

export interface BatchOptions {
  /** One per session, kept in the draft. */
  seed: string;
  /** 0 for the first page, 1.. for "Andere beelden". */
  refresh?: number;
  size?: number;
  /** Card ids this browser saw before, oldest first: an unseen variant of a family is preferred. */
  seen?: readonly string[];
  /** Ids the visitor chose: they stay on the page, and count towards its balance. */
  keep?: readonly string[];
  /** Card ids shown on earlier pages: their families are not shown again (unless the pool has run out). */
  exclude?: readonly string[];
}

/** The lack of a list of families: how far it is from at least ENOUGH on each side of each axis, and from enough of every round. */
function makeLack(allFamilies: readonly string[], axesOf: (f: string) => AssociationCardData["axes"], roundOf: (f: string) => string, size: number) {
  const need = (axis: (typeof AXES)[number]) => (axis === "novelty" ? 1 : ENOUGH_PER_SIDE);
  const sides = AXES.flatMap((axis) => ([1, -1] as const).map((sign) => ({ axis, sign })));
  const count = (list: readonly string[], axis: (typeof AXES)[number], sign: 1 | -1) => list.filter((f) => axesOf(f)[axis] * sign >= SIDE).length;
  // Only demand what the pool itself can give.
  const wantSide = sides.map(({ axis, sign }) => Math.min(need(axis), count(allFamilies, axis, sign)));
  const rounds = [...new Set(allFamilies.map(roundOf))];
  const minPerRound = Math.max(1, Math.floor(size / 3) - 2); // 18 -> 4
  const wantRound = new Map(rounds.map((r) => [r, Math.min(minPerRound, allFamilies.filter((f) => roundOf(f) === r).length)]));
  return (list: readonly string[]) =>
    sides.reduce((sum, { axis, sign }, i) => sum + Math.max(0, wantSide[i] - count(list, axis, sign)), 0) +
    rounds.reduce((sum, r) => sum + Math.max(0, (wantRound.get(r) ?? 0) - list.filter((f) => roundOf(f) === r).length), 0);
}

/**
 * Page 1 (or a refresh of it): `size` images, one variant per family, in a mixed order.
 *  - at least size/4 of every register (4 of 18), the rest free, so the page keeps the pool's own proportions beyond that;
 *  - on every axis at least two feelings on each side (one for novelty), and every round (place, moment, sense) in it,
 *    as far as the pool can give it, repaired by swaps within the same register so the register floor never moves;
 *  - images the visitor chose stay and count towards the balance.
 */
export function sampleBalancedBatch<T extends RegisteredCard>(cards: readonly T[], opts: BatchOptions): T[] {
  const size = opts.size ?? IMAGES_PAGE_SIZE;
  const refresh = opts.refresh ?? 0;
  const families = new Map<string, T[]>();
  for (const c of cards) families.set(familyOf(c), [...(families.get(familyOf(c)) ?? []), c]);
  const first = (f: string) => (families.get(f) as T[])[0];
  const registerOf = (f: string) => first(f).register;
  const roundOf = (f: string) => first(f).round;
  const axesOf = (f: string) => first(f).axes;

  const rank = new Map((opts.seen ?? []).map((id, i) => [id, i]));
  const keepIds = new Set(opts.keep ?? []);
  const keptFamilies = [...new Set(cards.filter((c) => keepIds.has(c.id)).map(familyOf))];
  const kept = keptFamilies.map((f) => pickVariant(families.get(f) as T[], `${opts.seed}:img:${f}`, rank, keepIds));

  const shownBefore = new Set(cards.filter((c) => (opts.exclude ?? []).includes(c.id)).map(familyOf));
  const rnd = mulberry32(hashSeed(`${opts.seed}:img:${refresh}:order`));
  const fresh = shuffled([...families.keys()].filter((f) => !keptFamilies.includes(f) && !shownBefore.has(f)), rnd);
  // The pool has run out of unseen families: take back the ones shown longest ago, so a page is always full.
  const recycled = shuffled([...shownBefore].filter((f) => !keptFamilies.includes(f)), rnd);
  const order = [...fresh, ...recycled];

  const need = Math.max(0, Math.min(size - kept.length, order.length));
  const perRegister = Math.floor(size / REGISTERS.length);
  const keptCount = countRegisters(kept.map((c) => c.register));
  const picked: string[] = [];
  for (const r of REGISTERS) {
    const want = Math.max(0, perRegister - keptCount[r]);
    for (const f of order) {
      if (picked.filter((p) => registerOf(p) === r).length >= want || picked.length >= need) break;
      if (registerOf(f) === r) picked.push(f);
    }
  }
  for (const f of order) {
    if (picked.length >= need) break;
    if (!picked.includes(f)) picked.push(f);
  }

  // Repair the axes and the rounds by swaps within the same register.
  const lack = makeLack([...order, ...keptFamilies], axesOf, roundOf, size);
  let list = [...picked];
  for (let guard = 0; guard < size * 3; guard++) {
    const now = lack([...keptFamilies, ...list]);
    if (now === 0) break;
    const rest = order.filter((f) => !list.includes(f));
    let swapped = false;
    outer: for (const candidate of rest) {
      for (let i = list.length - 1; i >= 0; i--) {
        if (registerOf(list[i]) !== registerOf(candidate)) continue;
        const next = [...list];
        next[i] = candidate;
        if (lack([...keptFamilies, ...next]) < now) {
          list = next;
          swapped = true;
          break outer;
        }
      }
    }
    if (!swapped) break;
  }

  const chosen = list.map((f) => pickVariant(families.get(f) as T[], `${opts.seed}:img:${f}`, rank, keepIds));
  return shuffled([...kept, ...chosen], mulberry32(hashSeed(`${opts.seed}:img:${refresh}:final`)));
}

export interface RegisterMix {
  counts: RegisterCounts;
  total: number;
  /** The register chosen most; null when nothing was chosen or two registers tie for first. */
  dominant: Register | null;
}

/** How the chosen images divide over the registers. A number per register, never stored with an answer. */
export function registerMix(chosen: readonly { register: Register }[]): RegisterMix {
  const counts = countRegisters(chosen.map((c) => c.register));
  const total = chosen.length;
  const top = Math.max(0, ...REGISTERS.map((r) => counts[r]));
  const leaders = REGISTERS.filter((r) => counts[r] === top);
  return { counts, total, dominant: total > 0 && leaders.length === 1 ? leaders[0] : null };
}

// --- page 2 -----------------------------------------------------------------------------------------------------------------

export interface ConcreteActivity {
  id: string;
  domain: string;
  sub: string;
  register: Register;
  tags: readonly string[];
  /** Where the activity sits on the three axes we know facets for (see activityAxes in associations.ts). */
  axes: { social: number; energy: number; setting: number };
}

export interface ConcreteOptions {
  seed: string;
  /** 0 for the first page, 1.. for "Andere activiteiten". */
  refresh?: number;
  size?: number;
  explore?: number;
  /** The tag profile of the chosen images (tagProfile). */
  profile: Record<string, number>;
  /** The average axes of the chosen images; leave out for no preference. */
  axes?: { social: number; energy: number; setting: number };
  /** Tags that are only a mood: they count half (the `generic` tags of the vocabulary). */
  genericTags?: ReadonlySet<string>;
  /** How the chosen images divide over the registers (registerMix). */
  mix: RegisterMix;
  /** Activity ids the visitor chose: they stay and count towards the floor. */
  keep?: readonly string[];
  /** Activity ids shown on earlier pages. */
  exclude?: readonly string[];
}

export interface ConcreteSlot<A extends ConcreteActivity = ConcreteActivity> {
  activity: A;
  /** From outside what the images pointed at: shown as "Misschien ook?". */
  explore: boolean;
}

const JITTER = 0.5;

/**
 * Page 2 (or a refresh of it): `size` concrete activities that follow from the chosen images.
 *  - most of them lie close to the images (shared tags), with a seeded spread so a refresh and another visitor see other ones;
 *  - every register gets at least MIN_PER_REGISTER, however one-sided page 1 was (this also guarantees a third of the page
 *    outside the most chosen register); beyond that the split follows the mix of page 1 (six of eight images in one register
 *    give that register about half of the page);
 *  - at most one activity per sub-domain and three per domain;
 *  - `explore` slots hold activities from other domains and from other registers than the mix leans to; they count towards
 *    those registers' share, so exploring does not cost the chosen register any room.
 * `pool` is already filtered for the month, the status and the pending photos by the caller.
 */
export function composeConcretePage<A extends ConcreteActivity>(pool: readonly A[], opts: ConcreteOptions): ConcreteSlot<A>[] {
  const size = opts.size ?? CONCRETE_PAGE_SIZE;
  const exploreN = Math.min(opts.explore ?? EXPLORE_SLOTS, Math.max(0, size - REGISTERS.length * MIN_PER_REGISTER));
  const refresh = opts.refresh ?? 0;
  const generic = opts.genericTags ?? new Set<string>();
  const keepIds = new Set(opts.keep ?? []);
  const excluded = new Set(opts.exclude ?? []);
  const rnd = (id: string) => mulberry32(hashSeed(`${opts.seed}:concrete:${refresh}:${id}`))();

  const closeness = (a: A) => a.tags.reduce((s, t) => s + (opts.profile[t] ?? 0) * (generic.has(t) ? 0.5 : 1), 0) / Math.sqrt(Math.max(1, a.tags.length));
  const maxClose = Math.max(0.0001, ...pool.map(closeness));
  const fit = (a: A) =>
    opts.axes ? 1 - (Math.abs(a.axes.social - opts.axes.social) + Math.abs(a.axes.energy - opts.axes.energy) + Math.abs(a.axes.setting - opts.axes.setting)) / 6 : 0.5;
  const score = new Map(pool.map((a) => [a.id, closeness(a) / maxClose + 0.25 * fit(a) + JITTER * rnd(a.id)]));

  const keptList = pool.filter((a) => keepIds.has(a.id));
  const fresh = pool.filter((a) => !keepIds.has(a.id) && !excluded.has(a.id));
  // The pool has run out of unseen activities: take back the ones shown before, so a page is always full.
  const candidates = [...fresh].sort((a, b) => (score.get(b.id) ?? 0) - (score.get(a.id) ?? 0) || a.id.localeCompare(b.id));
  const recycled = pool.filter((a) => !keepIds.has(a.id) && excluded.has(a.id)).sort((a, b) => (score.get(b.id) ?? 0) - (score.get(a.id) ?? 0) || a.id.localeCompare(b.id));

  // Register targets over the whole page: the floor for each, the rest in proportion to the mix of page 1 (equal when
  // nothing was chosen). The exploring slots are part of this: they come from registers other than the mix leans to, so
  // they fill the floors of those registers instead of taking room from the matched slots of the register that was chosen.
  const target = emptyCounts();
  for (const r of REGISTERS) target[r] = MIN_PER_REGISTER;
  const extra = size - REGISTERS.length * MIN_PER_REGISTER;
  const weights = REGISTERS.map((r) => (opts.mix.total > 0 ? opts.mix.counts[r] : 1));
  const wSum = weights.reduce((s, w) => s + w, 0) || 1;
  const exact = weights.map((w) => (extra * w) / wSum);
  const floors = exact.map(Math.floor);
  let left = extra - floors.reduce((s, n) => s + n, 0);
  const byRemainder = exact.map((x, i) => ({ i, rem: x - floors[i] })).sort((a, b) => b.rem - a.rem || weights[b.i] - weights[a.i] || a.i - b.i);
  for (const { i } of byRemainder) {
    if (left <= 0) break;
    floors[i] += 1;
    left -= 1;
  }
  REGISTERS.forEach((r, i) => (target[r] += floors[i]));

  // Which registers hold the exploring slots: the ones the mix does not lean to, the biggest remaining target first.
  const lean = opts.mix.dominant;
  const exploreRegisters: Register[] = [];
  const reservable = REGISTERS.filter((r) => r !== lean);
  for (let i = 0; i < exploreN; i++) {
    const open = [...reservable].sort((x, y) => target[y] - exploreRegisters.filter((e) => e === y).length - (target[x] - exploreRegisters.filter((e) => e === x).length) || REGISTERS.indexOf(x) - REGISTERS.indexOf(y));
    exploreRegisters.push(open[0]);
  }
  const matchedTarget = emptyCounts();
  for (const r of REGISTERS) matchedTarget[r] = Math.max(0, target[r] - exploreRegisters.filter((e) => e === r).length);
  const matchedSlots = size - exploreN;

  const chosen: A[] = [...keptList];
  const subs = new Set(chosen.map((a) => a.sub));
  const perDomain = new Map<string, number>();
  for (const a of chosen) perDomain.set(a.domain, (perDomain.get(a.domain) ?? 0) + 1);
  const have = (r: Register) => chosen.filter((a) => a.register === r).length;
  const take = (a: A) => {
    chosen.push(a);
    subs.add(a.sub);
    perDomain.set(a.domain, (perDomain.get(a.domain) ?? 0) + 1);
  };
  const allowed = (a: A, strict: boolean) => !chosen.includes(a) && (!strict || (!subs.has(a.sub) && (perDomain.get(a.domain) ?? 0) < 3));

  for (const pass of [candidates, recycled]) {
    // Strict first (one per sub-domain, three per domain); a register that cannot be filled that way is filled loosely.
    for (const strict of [true, false]) {
      for (const r of REGISTERS) {
        for (const a of pass) {
          if (have(r) >= matchedTarget[r] || chosen.length >= matchedSlots) break;
          if (a.register === r && allowed(a, strict)) take(a);
        }
      }
    }
  }
  // Still room (a register had too few): the best of what is left, whatever its register.
  for (const pass of [candidates, recycled]) {
    for (const strict of [true, false]) {
      for (const a of pass) {
        if (chosen.length >= matchedSlots) break;
        if (allowed(a, strict)) take(a);
      }
    }
  }

  // The exploring slots: other domains than the page has so far, little in common with the images, in the reserved registers.
  const matched = [...chosen];
  const usedDomains = new Set(matched.map((a) => a.domain));
  const exploreFrom = [...candidates, ...recycled].filter((a) => !chosen.includes(a));
  const median = [...exploreFrom.map(closeness)].sort((x, y) => x - y)[Math.floor(exploreFrom.length / 2)] ?? 0;
  const farther = exploreFrom.filter((a) => closeness(a) <= median);
  const shuffleExplore = (list: A[]) => shuffled(list, mulberry32(hashSeed(`${opts.seed}:concrete:${refresh}:explore`)));
  const exploring: A[] = [];
  const exploreOk = (a: A, newDomain: boolean) =>
    !exploring.includes(a) && !chosen.includes(a) && (!newDomain || (!usedDomains.has(a.domain) && !exploring.some((e) => e.domain === a.domain)));
  for (const r of exploreRegisters) {
    // The reserved register, a new domain, far from the images; then relax each in turn.
    const tiers: [A[], boolean][] = [[farther, true], [exploreFrom, true], [farther, false], [exploreFrom, false]];
    let found: A | undefined;
    for (const [list, newDomain] of tiers) {
      found = shuffleExplore(list).find((a) => a.register === r && exploreOk(a, newDomain));
      if (found) break;
    }
    if (found) exploring.push(found);
  }
  // A reserved register had nothing left: any remaining activity from a new domain.
  for (const newDomain of [true, false]) {
    for (const a of shuffleExplore(farther.length ? farther : exploreFrom)) {
      if (exploring.length >= exploreN) break;
      if (exploreOk(a, newDomain)) exploring.push(a);
    }
  }

  const slots: ConcreteSlot<A>[] = [...matched.map((activity) => ({ activity, explore: false })), ...exploring.map((activity) => ({ activity, explore: true }))];
  return shuffled(slots, mulberry32(hashSeed(`${opts.seed}:concrete:${refresh}:final`)));
}

/** Counts per register of a page, for the events and the tests. */
export function pageRegisters(items: readonly { register: Register }[]): RegisterCounts {
  return countRegisters(items.map((i) => i.register));
}
