// A plain Google Maps search URL needs no API key and can never be wrong
// in the way a fabricated deep link could be — it just searches for the
// place name, the same as a user typing it in themselves. This is the
// deliberate alternative to "grounded" exact links/addresses (see the
// improvement plan's section 9): safe now, upgradeable later if real
// web-search grounding gets added during generation.

/**
 * An option the research marked as an online provider (city "Online", or only the country): a course, an app, a webshop. A map search for it is meaningless,
 * so the booklet shows no map link for it, only its website. An empty city is an older book: those keep their map link.
 */
export function isOnlineCity(city: string): boolean {
  return /^(online|webshop|nederland|netherlands|landelijk|national)$/i.test(city.trim());
}

/** Whether the booklet shows a Google Maps link for this place (a physical place does, an online provider does not). */
export function hasMapLink(place: { city: string }): boolean {
  return !isOnlineCity(place.city);
}

export function mapsSearchUrl(name: string, city: string): string {
  const query = [name, city].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
