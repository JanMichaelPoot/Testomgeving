// Share (0-100) of visitors who get "Het venster" (the image intake) when
// NEXT_PUBLIC_ASSOCIATION_WIZARD_PERCENT is unset or empty: everybody. Set the variable to 0
// to switch it off again (or to a lower number for a gradual roll-out).
export const DEFAULT_ASSOCIATION_WIZARD_PERCENT = 100;

export function associationWizardPercent(raw: string | undefined): number {
  const parsed = raw === undefined || raw.trim() === "" ? NaN : Number(raw);
  return Number.isFinite(parsed) ? parsed : DEFAULT_ASSOCIATION_WIZARD_PERCENT;
}

// Whether the landing page shows "Het venster" instead of the classic hero (fase 7). On when
// every visitor gets the image intake (a percentage of 100, the default), or for one visit with
// ?venster=1 so it can be checked with the switch off. Below 100 the classic landing stays,
// because a visitor who then drew another wizard would land in a different flow than the page
// promised.
export function showVensterLanding(percentRaw: string | undefined, query: string | string[] | undefined): boolean {
  if ((Array.isArray(query) ? query[0] : query) === "1") return true;
  return associationWizardPercent(percentRaw) >= 100;
}

// No ?wizard= here: forcing a variant would keep the landing from ever handing out the two-page intake (NEXT_PUBLIC_IMAGES2_PERCENT).
export const VENSTER_SELF_HREF = "/intake";
export const VENSTER_GIFT_HREF = "/intake?for=gift";

/** The landing page's gift link with a one-time value: the wizard starts clean on every new arrival and keeps its answers on a reload. */
/** A new one-time value for the gift link (one per landing page render). */
export function newArrivalId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function giftHrefWithArrival(arrival: string): string {
  return `${VENSTER_GIFT_HREF}&s=${encodeURIComponent(arrival)}`;
}

// Share (0-100) of visitors who get the two-page image intake ("images2", docs/fase4-opzet.md) in a fresh draw. Default 100:
// everybody (Jan, 30 Oct 2026: the four-round intake must not be what visitors see); set NEXT_PUBLIC_IMAGES2_PERCENT to 0 to switch
// it off again. The draw for it comes first; the rest go on to the four-round image intake (NEXT_PUBLIC_ASSOCIATION_WIZARD_PERCENT).
export const DEFAULT_IMAGES2_PERCENT = 100;

export function images2WizardPercent(raw: string | undefined): number {
  const parsed = raw === undefined || raw.trim() === "" ? NaN : Number(raw);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : DEFAULT_IMAGES2_PERCENT;
}
