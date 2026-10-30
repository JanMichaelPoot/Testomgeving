import { basePriceCents, type PriceKind } from "@/lib/pricing";

// Price test support (improvement brief B6). OFF by default: with no PRICE_TEST setting every visitor sees and pays the normal price
// and nothing is recorded. The test itself (which prices, how long, how to read it) is run by Jan; this file only makes it possible.
//
// PRICE_TEST is JSON naming the *other* variants; the visitors who are not in one of them are the "control" and see the normal price:
//
//   PRICE_TEST={"B":{"self":650,"gift":1295},"C":{"self":850}}
//
// Prices are final consumer prices in cents (the price a visitor pays) and always replace the whole price of that product; a variant
// that names no price for a product leaves that product at its normal price. A variant is assigned per visitor, once, in a cookie
// (src/components/window/ConsentBanner.tsx sets it, and only after analytics consent: a cookie for an experiment is not essential),
// so a visitor sees one price everywhere. The variant is recorded on the order (payments.price_variant) and on the analytics events.
//
// Fail closed: any mistake in the setting (bad JSON, a price of 7 cents because someone typed 7.5) turns the test off completely.

export const PRICE_VARIANT_COOKIE = "window_price_variant";
export const CONTROL_VARIANT = "control";
export const MIN_TEST_PRICE_CENTS = 100;
export const MAX_TEST_PRICE_CENTS = 10_000;

export type PriceTestConfig = Record<string, Partial<Record<PriceKind, number>>>;

const VARIANT_ID = /^[A-Za-z0-9_-]{1,12}$/;

export function parsePriceTest(raw: string | undefined | null): PriceTestConfig | null {
  if (!raw || !raw.trim()) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const config: PriceTestConfig = {};
  for (const [id, prices] of Object.entries(parsed)) {
    if (!VARIANT_ID.test(id) || id === CONTROL_VARIANT) return null;
    if (!prices || typeof prices !== "object" || Array.isArray(prices)) return null;
    const entry: Partial<Record<PriceKind, number>> = {};
    for (const [kind, cents] of Object.entries(prices)) {
      if (kind !== "self" && kind !== "gift") return null;
      if (typeof cents !== "number" || !Number.isInteger(cents) || cents < MIN_TEST_PRICE_CENTS || cents > MAX_TEST_PRICE_CENTS) return null;
      entry[kind] = cents;
    }
    if (Object.keys(entry).length === 0) return null;
    config[id] = entry;
  }
  return Object.keys(config).length > 0 ? config : null;
}

/** The variant ids a visitor can be given (the control first). Empty when the test is off. */
export function variantIds(config: PriceTestConfig | null): string[] {
  return config ? [CONTROL_VARIANT, ...Object.keys(config)] : [];
}

/** An even random pick among control and the variants; `random` is 0 <= n < 1. */
export function assignVariant(config: PriceTestConfig | null, random: () => number = Math.random): string | null {
  const ids = variantIds(config);
  if (ids.length === 0) return null;
  return ids[Math.min(ids.length - 1, Math.floor(random() * ids.length))];
}

export interface ResolvedPrice {
  cents: number;
  /** null while the test is off; "control" for a visitor on the normal price while it is on; otherwise the variant id. */
  variant: string | null;
}

/**
 * The price this visitor sees and pays for a product. `cookieVariant` is whatever the cookie held (anything unknown, such as a
 * variant that was removed from the setting, counts as control, so nobody is charged a price that is no longer on offer).
 */
export function resolvePrice(kind: PriceKind, config: PriceTestConfig | null, cookieVariant: string | null | undefined): ResolvedPrice {
  const base = basePriceCents(kind);
  if (!config) return { cents: base, variant: null };
  const entry = cookieVariant ? config[cookieVariant] : undefined;
  if (!entry) return { cents: base, variant: CONTROL_VARIANT };
  const cents = entry[kind];
  return { cents: cents ?? base, variant: cookieVariant! };
}
