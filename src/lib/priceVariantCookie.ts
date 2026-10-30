import { PRICE_VARIANT_COOKIE } from "@/lib/priceTest";

// Browser side of the price test (src/lib/priceTest.ts): the variant cookie is created here, after analytics consent only, and removed
// again when consent is declined or withdrawn. Takes the `document` so the rules are tested without a browser.

const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

type CookieJar = { cookie: string };

export function readVariantCookie(doc: CookieJar): string | null {
  const match = doc.cookie.split("; ").find((part) => part.startsWith(`${PRICE_VARIANT_COOKIE}=`));
  return match ? decodeURIComponent(match.slice(PRICE_VARIANT_COOKIE.length + 1)) : null;
}

/**
 * Makes sure a consenting visitor has one of the variants on offer. Returns true when the cookie was written or replaced, so the page
 * can re-render with the right price. A cookie holding a variant that is no longer offered is replaced by a fresh draw.
 */
export function ensurePriceVariantCookie(variants: readonly string[], doc: CookieJar, random: () => number = Math.random): boolean {
  if (variants.length === 0) return clearPriceVariantCookie(doc);
  const current = readVariantCookie(doc);
  if (current && variants.includes(current)) return false;
  const pick = variants[Math.min(variants.length - 1, Math.floor(random() * variants.length))];
  doc.cookie = `${PRICE_VARIANT_COOKIE}=${encodeURIComponent(pick)}; max-age=${MAX_AGE_SECONDS}; path=/; SameSite=Lax`;
  return true;
}

/** Removes the cookie; true when there was one. */
export function clearPriceVariantCookie(doc: CookieJar): boolean {
  if (readVariantCookie(doc) === null) return false;
  doc.cookie = `${PRICE_VARIANT_COOKIE}=; max-age=0; path=/; SameSite=Lax`;
  return true;
}
