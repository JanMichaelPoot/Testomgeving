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

/** The country (ISO 3166-1 alpha-2, any country) and place of a connection, as the host reports them. For the order record and the admin log. */
export interface OrdererGeo {
  country: string;
  /** "" when the host did not report a city. */
  city: string;
}

/** Pure part, for tests: the header values in, the orderer's geo out (null without a valid country code). Never reads or returns the IP address. */
export function ordererGeoFrom(country: string | null | undefined, city: string | null | undefined): OrdererGeo | null {
  const code = (country ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code) || code === "XX" || code === "T1") return null;
  let name = (city ?? "").trim();
  try {
    name = decodeURIComponent(name);
  } catch {
    // keep as is
  }
  return { country: code, city: name.replace(/[<>\n\r]/g, "").slice(0, 80) };
}

/** The geo of the request that is being handled: the country and city Vercel derives from the connection. Null on a local run. */
export async function getOrdererGeo(): Promise<OrdererGeo | null> {
  const h = await headers();
  return ordererGeoFrom(h.get("x-vercel-ip-country"), h.get("x-vercel-ip-city"));
}

export async function getGeoHint(): Promise<GeoHint | null> {
  const h = await headers();
  return geoHintFrom(h.get("x-vercel-ip-country"), h.get("x-vercel-ip-city"));
}
