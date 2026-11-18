import gracefulJson from "@/lib/discovery/gracefulFamilies.json";
import { hashSeed, mulberry32, shuffled } from "@/lib/discovery/rng";
import { AXES, ENOUGH_PER_SIDE, SIDE, pickVariant } from "@/lib/discovery/associationSampling";
import type { AssociationCardData } from "@/lib/discovery/associationProfile";
import { assocCloseness, type ActivityVector } from "@/lib/discovery/associationLayer";
import { REGISTERS, countRegisters, emptyCounts, type Register, type RegisterCounts } from "@/lib/discovery/registerTypes";
import type { UnfitFlag } from "@/lib/discovery/suitability";

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
export const MAX_CONCRETE_PICKS = 8;
/** Slots on page 2 for things outside what the images pointed at ("Misschien ook?"). */
export const EXPLORE_SLOTS = 3;
/** Every register gets at least this many of the 18 on page 2, however one-sided the choice on page 1 was. */
export const MIN_PER_REGISTER = 2;

// --- page 1 -----------------------------------------------------------------------------------------------------------------

export type RegisteredCard = AssociationCardData & { register: Register };

const familyOf = (c: AssociationCardData) => c.family ?? c.id;

/**
 * The graceful, decorative world (dance, theatre, dolls and miniatures, jewellery, clothing, beauty, flowers, tea) has a floor of its own on
 * page 1: at least GRACEFUL_MIN of the 18 images, as far as the pool has unseen families of it, so a taste for it can always be expressed
 * on the first set (five is also the fewest images a person must choose). The register floors stay; these families count towards them.
 */
export const GRACEFUL_FAMILIES: ReadonlySet<string> = new Set(gracefulJson.families);
export const GRACEFUL_MIN = 5;

/**
 * Tastes that are easy to miss on a first set of 18 because few images carry them: history, speed, strategy and puzzles, technique and
 * collecting. Every theme has a floor of its own (NICHE_MIN image families, as far as the pool has unseen ones), so somebody who loves
 * puzzles or old maps can show it on the first set without pressing "Andere beelden" three times. A family belongs to a theme when it carries one
 * of the tags strongly (NICHE_WEIGHT); the register floors and the axis repair still apply, so the page stays balanced.
 */
export const NICHE_THEMES: readonly { id: string; tags: readonly string[] }[] = [
  { id: "history", tags: ["history"] },
  { id: "speed", tags: ["speed"] },
  { id: "strategy", tags: ["strategy", "puzzling"] },
  { id: "technique", tags: ["technique", "collecting", "miniature"] },
];
export const NICHE_MIN = 1;
/**
 * A page holds the floor of only this many niche tastes, a different pair per visitor and per page ("Andere beelden" rotates them): four floors on
 * every page took four of the 18 places from the broad tastes (measured: it helped the niche tastes and hurt the rest to the same extent).
 */
export const NICHE_PER_PAGE = 2;
export const NICHE_WEIGHT = 0.6;

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
  /**
   * 0..1 preference per card (higher first), for the search context and, on a refresh, what was chosen so far (audience.ts imagePreference).
   * It orders the candidates (every other place to the best-liked, the rest left to the seeded order); the register floors and the axis repair still apply, so it can lean a
   * page but never make it one-sided. `index` is the card's position in the seeded order.
   */
  prefer?: (card: AssociationCardData, index: number) => number;
  /** The graceful-theme floor; `null` switches it off (the default is GRACEFUL_FAMILIES with GRACEFUL_MIN). */
  theme?: { families: ReadonlySet<string>; min: number } | null;
  /** The niche-taste floors (NICHE_THEMES); `null` switches them off. */
  niche?: readonly { id: string; tags: readonly string[] }[] | null;
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
  let freshOrdered = fresh;
  if (opts.prefer) {
    // Every other place goes to the best-liked families; the places in between keep the seeded random order, so the page can lean but is
    // never only what the context (or the choices so far) point at.
    const prefer = opts.prefer;
    const chance = mulberry32(hashSeed(`${opts.seed}:img:${refresh}:prefer`));
    const liked = fresh
      .map((f, i) => ({ f, s: 0.7 * prefer(first(f), i) + 0.3 * chance() }))
      .sort((x, y) => y.s - x.s || x.f.localeCompare(y.f))
      .map((x) => x.f);
    const used = new Set<string>();
    const merged: string[] = [];
    let l = 0;
    let p = 0;
    while (merged.length < fresh.length) {
      const fromPlain = merged.length % 2 === 1;
      if (fromPlain) {
        while (p < fresh.length && used.has(fresh[p])) p++;
        if (p < fresh.length) {
          used.add(fresh[p]);
          merged.push(fresh[p]);
          continue;
        }
      }
      while (l < liked.length && used.has(liked[l])) l++;
      if (l < liked.length) {
        used.add(liked[l]);
        merged.push(liked[l]);
      } else {
        while (p < fresh.length && used.has(fresh[p])) p++;
        used.add(fresh[p]);
        merged.push(fresh[p]);
      }
    }
    freshOrdered = merged;
  }
  const theme = opts.theme === undefined ? { families: GRACEFUL_FAMILIES, min: GRACEFUL_MIN } : opts.theme;
  // Every floor (the graceful theme and each niche taste) is a set of families and a minimum.
  const niche = opts.niche === undefined ? NICHE_THEMES : opts.niche;
  const floors: { families: ReadonlySet<string>; min: number }[] = [
    ...(theme ? [theme] : []),
    ...shuffled([...(niche ?? [])], mulberry32(hashSeed(`${opts.seed}:img:${refresh}:niche`))).slice(0, NICHE_PER_PAGE).map((t) => ({
      families: new Set([...families.keys()].filter((f) => t.tags.some((tag) => (first(f).tagWeights[tag] ?? 0) >= NICHE_WEIGHT))),
      min: NICHE_MIN,
    })),
  ].filter((f) => f.families.size > 0);
  const keptIn = (floor: { families: ReadonlySet<string> }) => keptFamilies.filter((f) => floor.families.has(f)).length;
  // The floor: the first (min - kept) unseen families of each floor go to the front of the order, so they are picked before anything else of their register.
  const front: string[] = [];
  for (const floor of floors) {
    const have = keptIn(floor) + front.filter((f) => floor.families.has(f)).length;
    const add = [...freshOrdered, ...recycled].filter((f) => floor.families.has(f) && !front.includes(f)).slice(0, Math.max(0, floor.min - have));
    front.push(...add);
  }
  const order = [...front, ...[...freshOrdered, ...recycled].filter((f) => !front.includes(f))];

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
    // Families shown on an earlier page only come back when the pool has run out of unseen ones: a repair never brings one back by itself.
    const poolRanOut = freshOrdered.length + kept.length < size;
    const rest = order.filter((f) => !list.includes(f) && (poolRanOut || !recycled.includes(f)));
    // How many families each floor has on the page now (counted once per round of swaps, not per candidate).
    const floorHave = floors.map((fl) => keptIn(fl) + list.filter((f) => fl.families.has(f)).length);
    let swapped = false;
    outer: for (const candidate of rest) {
      for (let i = list.length - 1; i >= 0; i--) {
        if (registerOf(list[i]) !== registerOf(candidate)) continue;
        // A repair never takes the page below any floor (graceful theme or niche taste).
        if (floors.some((fl, k) => fl.families.has(list[i]) && !fl.families.has(candidate) && floorHave[k] <= fl.min)) continue;
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

// --- page 1 as theme tiles ------------------------------------------------------------------------------------------------

/** The theme tiles of the image intake: a visitor picks this many of the 30 (docs/voorstel-themabeelden.md). */
export const MIN_THEME_PICKS = 3;
export const MAX_THEME_PICKS = 8;
/** The groups of the tiles, in the order the page shows them (themes.json `group`). */
export const THEME_GROUP_ORDER = ["nature", "move", "culture", "mind", "people", "out"] as const;

export interface ThemeTileOptions {
  /** One per session, kept in the draft. */
  seed: string;
  /** Card ids this browser saw before, oldest first: an image of a theme not seen yet is preferred, so a returning visitor sees other images. */
  seen?: readonly string[];
  /** Ids the visitor chose: their theme keeps showing that image. */
  keep?: readonly string[];
}

/**
 * Page 1 as theme tiles: ALL themes, one image per theme (a family of 2 or 3 images), grouped by theme group in the fixed group order, with
 * the tiles inside a group in a seeded order (so no tile always sits first). Deterministic for a seed; choosing a tile moves nothing,
 * and a later visit (another seed, the images seen before) shows the other image of a theme. There is no balancing and no refresh: the page
 * is the whole spectrum, so nobody has to ask for "other" images to find a taste.
 */
export function sampleThemeTiles<T extends AssociationCardData>(cards: readonly T[], opts: ThemeTileOptions): T[] {
  const families = new Map<string, T[]>();
  for (const c of cards) families.set(familyOf(c), [...(families.get(familyOf(c)) ?? []), c]);
  const rank = new Map((opts.seen ?? []).map((id, i) => [id, i]));
  const keep = new Set(opts.keep ?? []);
  const rnd = mulberry32(hashSeed(`${opts.seed}:themes:order`));
  const groups = new Map<string, string[]>();
  for (const [family, members] of families) {
    const g = members[0].group ?? "";
    groups.set(g, [...(groups.get(g) ?? []), family]);
  }
  const rest = [...groups.keys()].filter((g) => !(THEME_GROUP_ORDER as readonly string[]).includes(g)).sort();
  const out: T[] = [];
  for (const g of [...THEME_GROUP_ORDER, ...rest]) {
    for (const family of shuffled(groups.get(g) ?? [], rnd)) out.push(pickVariant(families.get(family) as T[], `${opts.seed}:themes:${family}`, rank, keep));
  }
  return out;
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
  /** The association layer's vector of the activity (idf-weighted), when the layer is on and the activity has one. */
  assoc?: ActivityVector;
  /** How broadly the activity lies close to images in general, relative to the average (1 = average; concretePool.ts). */
  assocHub?: number;
  /** The needs this activity is known not to suit (suitability.ts): the browser has no safety or intensity data, so the server says it here. */
  unfit?: readonly UnfitFlag[];
}

export interface ConcreteOptions<A extends ConcreteActivity = ConcreteActivity> {
  seed: string;
  /** 0 for the first page, 1.. for "Andere activiteiten". */
  refresh?: number;
  size?: number;
  explore?: number;
  /** The tag profile of the chosen images (tagProfile). */
  profile: Record<string, number>;
  /** The association layer: what the chosen images evoke (assocProfile). Leave out for the tags-only behaviour. */
  assocProfile?: Record<string, number>;
  /** Override of ASSOC_WEIGHT (the measuring script tries several). */
  assocWeight?: number;
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
  /** 0..1 lean of an activity for the search context (audience.ts); a small addition to its score, never a filter. */
  prefer?: (a: A) => number;
  /**
   * The themes the visitor chose on page 1 (theme tiles, Step 211). Then page 2 covers every chosen theme (COVER_MIN plekken each), reserves
   * COMBO_SLOTS for activities that fit TWO of the chosen themes at once, and draws its "Misschien ook?" slots from nearby themes that were not
   * chosen. Left out (the old image intake, the tests), page 2 behaves exactly as before.
   */
  themes?: readonly ThemeProfile[];
  /** Every theme on page 1, so the exploring slots can come from one that was not chosen. Needs `themes`. */
  allThemes?: readonly ThemeProfile[];
}

/** A theme as page 2 sees it: its id and the tag weights of its tile. */
export interface ThemeProfile {
  id: string;
  weights: Record<string, number>;
}

export interface ConcreteSlot<A extends ConcreteActivity = ConcreteActivity> {
  activity: A;
  /** From outside what the images pointed at: shown as "Misschien ook?". */
  explore: boolean;
  /** Theme tiles: the two chosen themes this activity combines (a reserved combination slot). */
  combo?: [string, string];
  /** Theme tiles: the theme that was NOT chosen that an exploring slot comes from. */
  exploreTheme?: string;
}

/** Page 2 as theme tiles (Step 211): the slots reserved for activities that fit two chosen themes, and what counts as fitting. */
export const COMBO_SLOTS = 5;
/** An activity combines two themes when it is at least this close to the weaker of them (0..1, relative to the best activity of that theme). */
export const COMBO_FLOOR = 0.5;
/** Every chosen theme gets at least this many of the 18 slots (1 when more than COVER_MANY themes were chosen). */
export const COVER_MIN = 2;
export const COVER_MANY = 5;
/** An activity belongs to a theme when its closeness to it is at least this share of the best activity's. */
export const COVER_REL = 0.5;
/** The weight of the combination score next to the rest of the page-2 score. */
export const COMBO_WEIGHT = 1;

const JITTER = 0.5;
/** How much the association layer counts next to tag closeness (1) when it is on. */
export const ASSOC_WEIGHT = 0.35;

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
export function composeConcretePage<A extends ConcreteActivity>(pool: readonly A[], opts: ConcreteOptions<A>): ConcreteSlot<A>[] {
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
  // The association layer adds a second closeness, in the vocabulary the tags lack (geur, warmte, trots, verwondering...). An activity
  // without a vector (not in the reference library) gets the average, so it is neither lifted nor sunk against the others.
  const layer = opts.assocProfile && Object.keys(opts.assocProfile).length > 0 ? opts.assocProfile : null;
  // Divided by the square root of the activity's hubness, so a broadly matching activity does not win everywhere.
  const assoc = (a: A) => (layer ? assocCloseness(layer, a.assoc) / Math.sqrt(Math.max(0.5, a.assocHub ?? 1)) : 0);
  const maxAssoc = layer ? Math.max(0.0001, ...pool.map(assoc)) : 1;
  const withVector = layer ? pool.filter((a) => a.assoc && a.assoc.length > 0) : [];
  const meanAssoc = withVector.length ? withVector.reduce((s, a) => s + assoc(a), 0) / withVector.length / maxAssoc : 0;
  // An activity without a vector gets half the average: not sunk against the ones that have one, but not lifted either.
  const assocWeight = opts.assocWeight ?? ASSOC_WEIGHT;
  const assocScore = (a: A) => (layer ? assocWeight * (a.assoc && a.assoc.length > 0 ? assoc(a) / maxAssoc : 0.5 * meanAssoc) : 0);
  // Theme tiles: how close every activity is to each chosen theme (0..1, relative to that theme's best activity).
  const themeRel = (t: ThemeProfile) => {
    const raw = (a: A) => a.tags.reduce((sum, tag) => sum + (t.weights[tag] ?? 0) * (generic.has(tag) ? 0.5 : 1), 0) / Math.sqrt(Math.max(1, a.tags.length));
    const best = Math.max(0.0001, ...pool.map(raw));
    return new Map(pool.map((a) => [a.id, raw(a) / best] as const));
  };
  const chosenThemes = opts.themes ?? [];
  const rels = chosenThemes.map(themeRel);
  /** The best pair of chosen themes an activity fits at once, and how well (the weaker of the two, so it needs both). */
  const comboOf = (a: A): { value: number; pair: [string, string] | null } => {
    let value = 0;
    let pair: [string, string] | null = null;
    for (let i = 0; i < rels.length; i++) {
      for (let j = i + 1; j < rels.length; j++) {
        const m = Math.min(rels[i].get(a.id) ?? 0, rels[j].get(a.id) ?? 0);
        if (m > value) {
          value = m;
          pair = [chosenThemes[i].id, chosenThemes[j].id];
        }
      }
    }
    return { value, pair };
  };
  const comboValue = new Map(pool.map((a) => [a.id, comboOf(a)] as const));
  const score = new Map(
    pool.map((a) => [a.id, closeness(a) / maxClose + assocScore(a) + 0.25 * fit(a) + (opts.prefer ? 0.3 * opts.prefer(a) : 0) + (chosenThemes.length >= 2 ? COMBO_WEIGHT * (comboValue.get(a.id)?.value ?? 0) : 0) + JITTER * rnd(a.id)]),
  );

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

  // Theme tiles: first every chosen theme gets its share, then the reserved combination slots. Both stay inside the register targets, so the
  // register floors of the page hold exactly as without themes.
  const combos = new Map<string, [string, string]>();
  if (chosenThemes.length > 0) {
    const roomFor = (a: A) => have(a.register) < matchedTarget[a.register] && chosen.length < matchedSlots;
    const need = chosenThemes.length > COVER_MANY ? 1 : COVER_MIN;
    for (let i = 0; i < chosenThemes.length; i++) {
      const inTheme = (a: A) => (rels[i].get(a.id) ?? 0) >= COVER_REL;
      for (const pass of [candidates, recycled]) {
        const ranked = [...pass].sort((x, y) => (rels[i].get(y.id) ?? 0) - (rels[i].get(x.id) ?? 0) || (score.get(y.id) ?? 0) - (score.get(x.id) ?? 0) || x.id.localeCompare(y.id));
        for (const a of ranked) {
          if (chosen.filter(inTheme).length >= need) break;
          if (inTheme(a) && allowed(a, true) && roomFor(a)) take(a);
        }
      }
    }
    if (chosenThemes.length >= 2) {
      // What was kept (the visitor's own picks) that already combines two themes counts towards the reserved slots.
      for (const a of chosen) {
        const c = comboValue.get(a.id);
        if (c?.pair && c.value >= COMBO_FLOOR) combos.set(a.id, c.pair);
      }
      for (const pass of [candidates, recycled]) {
        const ranked = pass.filter((a) => (comboValue.get(a.id)?.value ?? 0) >= COMBO_FLOOR).sort((x, y) => (comboValue.get(y.id)?.value ?? 0) - (comboValue.get(x.id)?.value ?? 0) || x.id.localeCompare(y.id));
        for (const a of ranked) {
          if (combos.size >= COMBO_SLOTS) break;
          if (allowed(a, true) && roomFor(a)) {
            take(a);
            combos.set(a.id, comboValue.get(a.id)!.pair!);
          }
        }
      }
    }
  }

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
  // Only what was not shown before, as long as enough of it is left: a "Misschien ook?" slot must not bring back an activity from an
  // earlier page (found live on 1 November 2026: "Een dag in een thermenbad" came back on the next page).
  const freshLeft = candidates.filter((a) => !chosen.includes(a));
  const exploreFrom = freshLeft.length >= exploreN * 3 ? freshLeft : [...freshLeft, ...recycled.filter((a) => !chosen.includes(a))];
  const median = [...exploreFrom.map(closeness)].sort((x, y) => x - y)[Math.floor(exploreFrom.length / 2)] ?? 0;
  const farther = exploreFrom.filter((a) => closeness(a) <= median);
  const shuffleExplore = (list: A[]) => shuffled(list, mulberry32(hashSeed(`${opts.seed}:concrete:${refresh}:explore`)));
  const exploring: A[] = [];
  const exploreThemeOf = new Map<string, string>();
  // Theme tiles: a "Misschien ook?" slot comes from a theme the visitor did NOT choose, one that lies near what they did choose (it shares tags
  // with the profile) but is not already covered by a chosen theme. Three slots, three different themes.
  const chosenThemeIds = new Set(chosenThemes.map((t) => t.id));
  const unchosenRels = (opts.themes && opts.allThemes ? opts.allThemes.filter((t) => !chosenThemeIds.has(t.id)) : []).map((t) => ({ id: t.id, rel: themeRel(t) }));
  const nearUnchosen = (a: A): string | null => {
    if (closeness(a) <= 0) return null;
    if (rels.some((r) => (r.get(a.id) ?? 0) >= COVER_REL * 0.8)) return null;
    let best: { id: string; v: number } | null = null;
    for (const u of unchosenRels) {
      const v = u.rel.get(a.id) ?? 0;
      if (v >= COVER_REL && (!best || v > best.v)) best = { id: u.id, v };
    }
    return best?.id ?? null;
  };
  const exploreOk = (a: A, newDomain: boolean) =>
    !exploring.includes(a) && !chosen.includes(a) && (!newDomain || (!usedDomains.has(a.domain) && !exploring.some((e) => e.domain === a.domain)));
  const nearby = unchosenRels.length > 0 ? shuffleExplore(exploreFrom).filter((a) => nearUnchosen(a) !== null) : [];
  for (const r of exploreRegisters) {
    // Theme tiles first: the reserved register, from a nearby theme that was not chosen and that no other slot uses yet.
    const near = nearby.find((a) => a.register === r && exploreOk(a, true) && ![...exploreThemeOf.values()].includes(nearUnchosen(a)!));
    if (near) {
      exploring.push(near);
      exploreThemeOf.set(near.id, nearUnchosen(near)!);
      continue;
    }
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

  const slots: ConcreteSlot<A>[] = [
    ...matched.map((activity) => ({ activity, explore: false, ...(combos.has(activity.id) ? { combo: combos.get(activity.id)! } : {}) })),
    ...exploring.map((activity) => ({ activity, explore: true, ...(exploreThemeOf.has(activity.id) ? { exploreTheme: exploreThemeOf.get(activity.id)! } : {}) })),
  ];
  return shuffled(slots, mulberry32(hashSeed(`${opts.seed}:concrete:${refresh}:final`)));
}

/** Counts per register of a page, for the events and the tests. */
export function pageRegisters(items: readonly { register: Register }[]): RegisterCounts {
  return countRegisters(items.map((i) => i.register));
}
