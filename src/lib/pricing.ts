import type { Locale } from "@/lib/locale";

// Single price point for the MVP. Kept in cents since that's what Stripe expects.
// The default stays €3,50; a deployment can set NEXT_PUBLIC_WINDOW_PRICE_CENTS (e.g. 600
// on the "Het venster" test preview, Jan 4 Oct 2026). The same value feeds the page copy,
// the Stripe line item (checkout/actions.ts) and the order record, so they cannot differ.
// NEXT_PUBLIC_ so the browser shows the same number (inlined at build time).
export const DEFAULT_PRICE_CENTS = 350;

export function priceCentsFrom(raw: string | undefined): number {
  const n = Number((raw ?? "").trim());
  // Whole cents between €1 and €50 only: a typo must never turn into a free or absurd price.
  return Number.isInteger(n) && n >= 100 && n <= 5000 ? n : DEFAULT_PRICE_CENTS;
}

export const WINDOW_PLAN_PRICE = {
  currency: "eur",
  amountCents: priceCentsFrom(process.env.NEXT_PUBLIC_WINDOW_PRICE_CENTS),
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
