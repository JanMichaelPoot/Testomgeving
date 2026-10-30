import { cookies } from "next/headers";
import type { Locale } from "@/lib/locale";
import { formatPrice, type PriceKind } from "@/lib/pricing";
import { PRICE_VARIANT_COOKIE, parsePriceTest, resolvePrice, variantIds, type ResolvedPrice } from "@/lib/priceTest";

// Server side of the price test (src/lib/priceTest.ts): the price for the visitor who is making this request. Every place that
// shows a price and every place that charges one reads it here, so what is shown and what is charged cannot differ.

export function priceTestConfig() {
  return parsePriceTest(process.env.PRICE_TEST);
}

/** The variant ids the browser may be given a cookie for; empty while the test is off. */
export function priceTestVariants(): string[] {
  return variantIds(priceTestConfig());
}

export async function getVisitorPrice(kind: PriceKind): Promise<ResolvedPrice & { label: (locale: Locale) => string }> {
  const config = priceTestConfig();
  const cookie = config ? ((await cookies()).get(PRICE_VARIANT_COOKIE)?.value ?? null) : null;
  const price = resolvePrice(kind, config, cookie);
  return { ...price, label: (locale) => formatPrice(locale, price.cents) };
}
