// The seven discovery levels (Fase 3): the order of the results from what is most at hand to what is newest.
// A level orders recommendations; it is not a step or a page. No dependencies, so the browser may import it.
//
//   1 Vertrouwd   what they picked themselves, or what sits right next to it
//   2 Praktisch   the easiest to start with from what they picked (cheap, short, a provider everywhere)
//   3 Verwant     related, one step away from a pick
//   4 Inspirerend related but from further away: a new angle on a known taste
//   5 Verrassend  far from every pick, reached through a combination or a chain
//   6 Uitdagend   one facet turned up: bigger, wilder, more demanding
//   7 Onontdekt   the random prompt from a world they did not pick

export const DISCOVERY_LEVELS = [1, 2, 3, 4, 5, 6, 7] as const;
export type DiscoveryLevel = (typeof DISCOVERY_LEVELS)[number];

export const LEVEL_NAMES: Record<"nl" | "en", Record<DiscoveryLevel, string>> = {
  nl: { 1: "Vertrouwd", 2: "Praktisch", 3: "Verwant", 4: "Inspirerend", 5: "Verrassend", 6: "Uitdagend", 7: "Onontdekt" },
  en: { 1: "Familiar", 2: "Practical", 3: "Related", 4: "Inspiring", 5: "Surprising", 6: "Challenging", 7: "Undiscovered" },
};

export function isDiscoveryLevel(value: unknown): value is DiscoveryLevel {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 7;
}

export function levelName(level: DiscoveryLevel, locale: "nl" | "en"): string {
  return LEVEL_NAMES[locale][level];
}
