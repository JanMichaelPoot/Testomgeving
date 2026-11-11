import { NextResponse } from "next/server";
import { HOME_COUNTRY, normalizeCountry } from "@/lib/countries";

// Proxies the free, keyless PDOK Locatieserver (Dutch government geocoding
// service) so the intake's location field can offer real place-name
// suggestions without a paid API (Google Places) or exposing a browser
// call directly to a third party. Restricted to city/municipality-level
// results — the intake explicitly only ever asks for "city or region",
// never a full address (see src/lib/i18n/dictionaries.ts: location.sub).
const PDOK_SUGGEST_URL = "https://api.pdok.nl/bzk/locatieserver/search/v3_1/suggest";

interface PdokDoc {
  weergavenaam?: string;
}

// Outside the Netherlands the places come from Photon (komoot), a keyless geocoder on OpenStreetMap data (ODbL, attribution in the
// privacy statement). It has no country filter, so a larger list is asked for and cut down to the chosen country. A public service with
// fair use: swap this function for a keyed provider (Geoapify, GeoNames) before the volume grows; the intake works without suggestions.
const PHOTON_URL = "https://photon.komoot.io/api/";

interface PhotonFeature {
  properties?: { name?: string; state?: string; countrycode?: string };
}

async function photonSuggest(query: string, country: string, lang: string): Promise<string[]> {
  const url = new URL(PHOTON_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "30");
  url.searchParams.set("lang", lang === "nl" ? "default" : "en");
  url.searchParams.append("layer", "city");
  url.searchParams.append("layer", "locality");
  const response = await fetch(url, { signal: AbortSignal.timeout(3500), headers: { "User-Agent": "WindowInto/1.0 (place suggestions)" } });
  if (!response.ok) return [];
  const data = (await response.json()) as { features?: PhotonFeature[] };
  const names = (data.features ?? [])
    .filter((f) => f.properties?.countrycode?.toUpperCase() === country && f.properties?.name)
    .map((f) => {
      const { name, state } = f.properties!;
      return state && state !== name ? `${name}, ${state}` : String(name);
    });
  return Array.from(new Set(names)).slice(0, 6);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") ?? "").trim();

  if (query.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  const country = normalizeCountry(searchParams.get("country")) ?? HOME_COUNTRY;
  if (country !== HOME_COUNTRY) {
    try {
      return NextResponse.json({ suggestions: await photonSuggest(query, country, searchParams.get("lang") ?? "en") });
    } catch {
      return NextResponse.json({ suggestions: [] });
    }
  }

  const url = new URL(PDOK_SUGGEST_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("fq", "type:(woonplaats OR gemeente)");
  url.searchParams.set("rows", "6");

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!response.ok) {
      return NextResponse.json({ suggestions: [] });
    }

    const data = (await response.json()) as { response?: { docs?: PdokDoc[] } };
    const names = data.response?.docs
      ?.map((doc) => doc.weergavenaam)
      .filter((name): name is string => typeof name === "string" && name.length > 0);

    // De-duplicate — PDOK can return the same display name for a
    // woonplaats and its parent gemeente.
    const suggestions = Array.from(new Set(names ?? []));

    return NextResponse.json({ suggestions });
  } catch {
    // PDOK being slow or unreachable shouldn't break the intake — the
    // field just behaves like a plain text input, with no suggestions.
    return NextResponse.json({ suggestions: [] });
  }
}
