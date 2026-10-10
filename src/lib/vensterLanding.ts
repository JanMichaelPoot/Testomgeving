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

export const VENSTER_SELF_HREF = "/intake?wizard=associations";
export const VENSTER_GIFT_HREF = "/intake?wizard=associations&for=gift";
