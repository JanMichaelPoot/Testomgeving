// Client-safe pieces of the visual interest step: the slim card data the wizard
// receives from the server, and the (deterministic) logic that decides which
// cards are shown in which batch. No JSON library import here on purpose: the
// full library (both languages, art direction, safety notes) must not end up in
// the browser bundle; the server sends only what a card needs.

export interface CardActivity {
  id: string;
  domain: string;
  sub: string;
  /** Label in the visitor's language. */
  label: string;
  /** Low-threshold way in, in the visitor's language. */
  entry: string | null;
  /** Safety tier: 2 = only under qualified supervision. */
  tier: 0 | 1 | 2;
}

export interface CardDomain {
  id: string;
  /** Short label in the visitor's language. */
  label: string;
  color: string;
}

export interface CardLibrary {
  domains: CardDomain[];
  activities: CardActivity[];
}

export interface CardSlot {
  id: string;
  /** From a domain the person did not choose: a way to discover something new. */
  ext: boolean;
}

export const CARDS_PER_BATCH = 10;
export const EXT_PER_BATCH = 2;
export const MAX_BATCHES = 4;

// --- seeded randomness ---------------------------------------------------------
// The order must survive a refresh or a step back, so it comes from a seed that is
// kept with the draft rather than from Math.random() on every render.

function hashSeed(text: string): number {
  let h = 1779033703 ^ text.length;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(list: readonly T[], rnd: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** One domain's activities, ordered so consecutive cards come from different sub-domains. */
function orderWithinDomain(items: CardActivity[], rnd: () => number): CardActivity[] {
  const bySub = new Map<string, CardActivity[]>();
  for (const a of shuffled(items, rnd)) bySub.set(a.sub, [...(bySub.get(a.sub) ?? []), a]);
  const lanes = shuffled([...bySub.values()], rnd);
  const out: CardActivity[] = [];
  for (let i = 0; out.length < items.length; i++) {
    for (const lane of lanes) if (lane[i]) out.push(lane[i]);
  }
  return out;
}

/** Interleaves several lists: first of each, second of each, and so on. */
function roundRobin<T>(lists: T[][]): T[] {
  const out: T[] = [];
  const longest = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < longest; i++) for (const l of lists) if (l[i]) out.push(l[i]);
  return out;
}

/**
 * Safety tier 2 (only under qualified supervision) is only offered to people who
 * said they are open to something less predictable.
 */
export function hidesSupervisedActivities(practicalToWild: string): boolean {
  return practicalToWild === "grounded" || practicalToWild === "practical";
}

/**
 * The batches of cards for the interest step (8-12 at a time; default 10).
 *
 * - With chosen domains: mostly cards from those domains, spread over sub-domains and
 *   alternating between the domains, plus a few "maybe also?" cards from domains that
 *   were not chosen, so new categories can be found without hiding the rest.
 * - Without chosen domains ("surprise me", or nothing picked): a broad sample, one card
 *   per domain per batch.
 *
 * Same input and seed always give the same batches, and a card never appears twice.
 */
export function buildCardBatches(opts: {
  activities: readonly CardActivity[];
  domainIds: readonly string[];
  chosenDomains: readonly string[];
  seed: string;
  hideSupervised: boolean;
  perBatch?: number;
  extPerBatch?: number;
  maxBatches?: number;
}): CardSlot[][] {
  const { activities, domainIds, chosenDomains, seed, hideSupervised } = opts;
  const perBatch = opts.perBatch ?? CARDS_PER_BATCH;
  const extPerBatch = opts.extPerBatch ?? EXT_PER_BATCH;
  const maxBatches = opts.maxBatches ?? MAX_BATCHES;
  const rnd = mulberry32(hashSeed(seed));

  const pool = activities.filter((a) => !(hideSupervised && a.tier === 2));
  const laneOf = (domain: string) => orderWithinDomain(pool.filter((a) => a.domain === domain), rnd);
  const chosen = domainIds.filter((d) => chosenDomains.includes(d));
  const batches: CardSlot[][] = [];

  if (chosen.length === 0) {
    const lanes = shuffled(domainIds, rnd).map(laneOf);
    const all = roundRobin(lanes);
    for (let i = 0; i < all.length && batches.length < maxBatches; i += perBatch) {
      batches.push(all.slice(i, i + perBatch).map((a) => ({ id: a.id, ext: false })));
    }
    return batches;
  }

  const main = roundRobin(shuffled(chosen, rnd).map(laneOf));
  const others = domainIds.filter((d) => !chosenDomains.includes(d));
  const ext = roundRobin(shuffled(others, rnd).map(laneOf));
  let m = 0;
  let e = 0;
  while ((m < main.length || e < ext.length) && batches.length < maxBatches) {
    const wantMain = perBatch - extPerBatch;
    const batch: CardSlot[] = [];
    while (batch.length < wantMain && m < main.length) batch.push({ id: main[m++].id, ext: false });
    // The rest of a batch (its "maybe also?" cards, plus any room left when the chosen
    // domains ran out) comes from the other domains.
    while (batch.length < perBatch && e < ext.length) batch.push({ id: ext[e++].id, ext: batch.length >= wantMain || m >= main.length });
    if (batch.length === 0) break;
    batches.push(batch);
  }
  return batches;
}
