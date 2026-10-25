// Client-safe locale constants — no "next/headers" import here, so this
// can be pulled into Client Components (e.g. LanguageToggle) without
// dragging a server-only module into the client bundle. Server code should
// generally import from src/lib/language.ts instead (which re-exports
// everything here plus the server-only getLocale() helper).
export const LOCALE_COOKIE_NAME = "window_locale";

export const SUPPORTED_LOCALES = [
  { code: "nl", label: "Nederlands" },
  { code: "en", label: "English" },
] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number]["code"];

export function languageLabel(code: string): string {
  return SUPPORTED_LOCALES.find((locale) => locale.code === code)?.label ?? code;
}

/** The word for "no cost" in a book's language: written into the prompts, and the fallback in localizeBook. */
export function freeWord(locale: string): string {
  return locale === "nl" ? "Gratis" : "Free";
}

/** Countries whose visitors start in Dutch: the Netherlands and Flanders' Belgium. */
const DUTCH_COUNTRIES = new Set(["NL", "BE", "SR", "AW", "CW", "SX"]);

/**
 * The language a visitor starts in when they have not chosen one (no toggle cookie yet):
 *   1. the country the request comes from (Vercel sets `x-vercel-ip-country` from the IP address,
 *      and we only read that country code, never the address itself): NL, BE and the Dutch-speaking
 *      Caribbean and Suriname start in Dutch, every other country in English;
 *   2. but a visitor abroad whose browser prefers Dutch (a Dutch holiday-maker) still gets Dutch;
 *   3. without a country (local development, other hosts) the browser's language decides;
 *   4. with neither, Dutch, the product's own language.
 * The toggle always wins (that choice is the cookie).
 */
export function detectLocale(input: { country?: string | null; acceptLanguage?: string | null }): Locale {
  // Only the first language of the browser counts ("en-US,nl;q=0.8" is an English browser).
  const prefersDutch = /^\s*nl\b/i.test(input.acceptLanguage ?? "");
  const country = (input.country ?? "").trim().toUpperCase();
  if (country && country !== "XX" && country !== "T1") {
    if (DUTCH_COUNTRIES.has(country)) return "nl";
    return prefersDutch ? "nl" : "en";
  }
  if (input.acceptLanguage && input.acceptLanguage.trim()) return prefersDutch ? "nl" : "en";
  return "nl";
}
