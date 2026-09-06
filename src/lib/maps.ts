// A plain Google Maps search URL needs no API key and can never be wrong
// in the way a fabricated deep link could be — it just searches for the
// place name, the same as a user typing it in themselves. This is the
// deliberate alternative to "grounded" exact links/addresses (see the
// improvement plan's section 9): safe now, upgradeable later if real
// web-search grounding gets added during generation.
export function mapsSearchUrl(name: string, city: string): string {
  const query = [name, city].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
