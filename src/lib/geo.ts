import { headers } from "next/headers";
import { normalizeCountry, type CountryCode } from "@/lib/countries";

// An indication of where the visitor is, taken from the headers Vercel adds to every request (country and city of the connection). Only used
// to pre-fill the country and place on the start page, always editable. The IP address itself is never read, stored or sent anywhere.
// Without those headers (a local run, another host) there is simply no hint.

export interface GeoHint {
  country: CountryCode;
  /** The city as Vercel reports it, "" when unknown. */
  city: string;
}

/** Pure part, for tests: the header values in, a hint out. */
export function geoHintFrom(country: string | null | undefined, city: string | null | undefined): GeoHint | null {
  const code = normalizeCountry(country);
  if (!code) return null;
  let name = (city ?? "").trim();
  try {
    name = decodeURIComponent(name);
  } catch {
    // keep as is
  }
  // A city name is short text; anything odd is dropped rather than shown.
  name = name.replace(/[<>\n\r]/g, "").slice(0, 80);
  return { country: code, city: name };
}

export async function getGeoHint(): Promise<GeoHint | null> {
  const h = await headers();
  return geoHintFrom(h.get("x-vercel-ip-country"), h.get("x-vercel-ip-city"));
}
