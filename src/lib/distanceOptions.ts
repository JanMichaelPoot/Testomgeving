// How far the visitor is willing to travel, measured from the place they start from (the start page's slider).
//
// The slider has eight steps; the last one means "more than 100 km" and is stored as 150. The stored kilometres go to the
// researcher, which looks for real places within that radius. The older three-way `searchDistance` ("city", "hour", "anywhere")
// stays in the answers as a derived class, so everything that already reads it (profile text, summaries, old sessions) keeps working.

export const DISTANCE_KM_STEPS = [5, 10, 15, 25, 50, 75, 100, 150] as const;
export type DistanceKm = (typeof DISTANCE_KM_STEPS)[number];

/** The value stored for "more than 100 km". */
export const DISTANCE_OVER_100 = 150;
/** What the slider starts at: around a city and its surroundings. */
export const DEFAULT_DISTANCE_KM: DistanceKm = 15;

/** Only a real step survives; anything else (a tampered value, an old session) is "not given". */
export function sanitizeDistanceKm(raw: unknown): DistanceKm | undefined {
  return typeof raw === "number" && (DISTANCE_KM_STEPS as readonly number[]).includes(raw) ? (raw as DistanceKm) : undefined;
}

/** The three-way class the older code reads. */
export function distanceClassFor(km: number): "city" | "hour" | "anywhere" {
  if (km <= 15) return "city";
  if (km <= 75) return "hour";
  return "anywhere";
}

/** Index of a step on the slider (-1 when it is not one). */
export function distanceStepIndex(km: number | undefined): number {
  return km === undefined ? -1 : (DISTANCE_KM_STEPS as readonly number[]).indexOf(km);
}

/** The distance in words for a prompt. Without kilometres (an old session) the three-way class is described. */
export function describeDistance(searchDistance: string | undefined, km: number | undefined): string {
  if (km !== undefined && sanitizeDistanceKm(km) !== undefined) {
    return km > 100 ? "more than 100 km (anywhere in the Netherlands is fine)" : `up to ${km} km from the starting place`;
  }
  if (searchDistance === "hour") return "roughly an hour's travel from the starting place";
  if (searchDistance === "anywhere") return "anywhere in the Netherlands";
  if (searchDistance === "city") return "the city itself and its surroundings";
  return searchDistance ? searchDistance : "not stated";
}

/** The radius sentence of the research prompt. */
export function radiusText(radius: "city" | "region" | "nl", km?: number): string {
  if (km !== undefined && sanitizeDistanceKm(km) !== undefined) {
    return km > 100
      ? "anywhere in the Netherlands (including online options)"
      : `within about ${km} km of the place (real places that are further away do not count)`;
  }
  return radius === "region"
    ? "within roughly an hour's travel of the place"
    : radius === "nl"
      ? "anywhere in the Netherlands (including online options)"
      : "in the city itself and its immediate surroundings";
}
