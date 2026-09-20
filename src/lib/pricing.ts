import type { Locale } from "@/lib/locale";

// Single price point for the MVP — adjust anywhere in the €2-5 range from
// the product brief. Kept in cents since that's what Stripe expects.
export const WINDOW_PLAN_PRICE = {
  currency: "eur",
  amountCents: 350,
} as const;

// Formatted manually (not via Intl.NumberFormat) so the output is always
// exactly "€3,50" / "€3.50" — Intl's nl-NL currency format inserts a space
// after the symbol, which reads oddly in short inline copy like "vanaf €3,50".
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
