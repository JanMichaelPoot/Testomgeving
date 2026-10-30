import type { Locale } from "@/lib/locale";

// Single price point for the MVP. Kept in cents since that's what Stripe expects.
// €7,50 per product (Jan, 30 Oct 2026; it was €3,50). The price lives in code only: an environment variable used to override it
// (NEXT_PUBLIC_WINDOW_PRICE_CENTS, 600 on the test preview) and a leftover value on Vercel kept the live site at €6,00 after this
// default changed, so that override is gone. To change the price, change this number. The same value feeds the page copy, the
// Stripe line item (checkout/actions.ts) and the order record, so they cannot differ.
export const PRICE_CENTS = 750;

export const WINDOW_PLAN_PRICE = {
  currency: "eur",
  amountCents: PRICE_CENTS,
} as const;

// Formatted manually (not via Intl.NumberFormat) so the output is always
// exactly "€7,50" / "€7.50" — Intl's nl-NL currency format inserts a space
// after the symbol, which reads oddly in short inline copy like "vanaf €7,50".
export function formatPrice(locale: Locale): string {
  const amount = (WINDOW_PLAN_PRICE.amountCents / 100).toFixed(2);
  return `€${locale === "nl" ? amount.replace(".", ",") : amount}`;
}

// Formats an arbitrary stored amount — e.g. a specific order's
// payments.amount/currency — rather than the current WINDOW_PLAN_PRICE
// constant above. Used for the order confirmation e-mail (Model C
// compliance, section 17) so a past order always shows what was actually
// charged, even if the live price changes later. Falls back to a generic
// "CUR 1,23" shape for a non-EUR currency, since this product only ever
// sells in EUR today but the price/products architecture doesn't assume
// that stays true forever.
export function formatAmount(amountCents: number, currency: string, locale: Locale): string {
  const amount = (amountCents / 100).toFixed(2);
  const formatted = locale === "nl" ? amount.replace(".", ",") : amount;
  return currency.toLowerCase() === "eur" ? `€${formatted}` : `${currency.toUpperCase()} ${formatted}`;
}
