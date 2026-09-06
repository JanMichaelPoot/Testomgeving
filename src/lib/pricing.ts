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
