// The one place for the discount rules (the price itself is in pricing.ts). Only one code can be entered per order, so discounts never add up.

/**
 * What a personal one-time code takes off, as a percentage of the price: the code for a friend, the one for a next book, the reward and the
 * compensation. The amount in cents is stored with the code when it is made, so changing this only changes codes made from then on: a code that
 * was already sent keeps what its e-mail promised.
 */
export const CODE_DISCOUNT_PERCENT = 25;

/**
 * The introduction ("early bird") discount: one shared code that anyone can use, not tied to an order and not stored in the database.
 * Switch it off with enabled: false, or give it a last day ("YYYY-MM-DD", Dutch time).
 */
export const EARLY_BIRD: { enabled: boolean; code: string; percent: number; validUntil: string | null } = {
  enabled: true,
  code: "EARLYBIRD",
  percent: 25,
  validUntil: null,
};

/** The price after a percentage off, in whole cents: 25% off EUR 5,99 is EUR 4,49. */
export function priceAfterPercent(priceCents: number, percent: number): number {
  return Math.round((priceCents * (100 - percent)) / 100);
}

/** What a percentage takes off, in cents: the difference with the price after it. */
export function percentOffCents(priceCents: number, percent: number): number {
  return priceCents - priceAfterPercent(priceCents, percent);
}
