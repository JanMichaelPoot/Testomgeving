// Whether the landing page shows "Het venster" (image intake) instead of the classic hero
// (fase 7). On when every visitor gets the image intake (NEXT_PUBLIC_ASSOCIATION_WIZARD_PERCENT
// of 100, as on the test preview), or for one visit with ?venster=1 so it can be checked
// without changing the environment. Below 100 the classic landing stays, because a visitor who
// then drew the classic wizard would land in a different flow than the page promised.
export function showVensterLanding(percentRaw: string | undefined, query: string | string[] | undefined): boolean {
  if ((Array.isArray(query) ? query[0] : query) === "1") return true;
  const parsed = percentRaw === undefined || percentRaw.trim() === "" ? NaN : Number(percentRaw);
  return Number.isFinite(parsed) && parsed >= 100;
}

export const VENSTER_SELF_HREF = "/intake?wizard=associations";
export const VENSTER_GIFT_HREF = "/intake?wizard=associations&for=gift";
