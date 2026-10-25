import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE_NAME, SUPPORTED_LOCALES, detectLocale, type Locale } from "@/lib/locale";

export { LOCALE_COOKIE_NAME, SUPPORTED_LOCALES, languageLabel, type Locale } from "@/lib/locale";

function isLocale(value: string | undefined): value is Locale {
  return SUPPORTED_LOCALES.some((locale) => locale.code === value);
}

// Server-only. The language the visitor chose with the toggle (a cookie, see
// src/components/window/LanguageToggle.tsx via src/app/actions/locale.ts) always wins. Without that
// choice the language follows the country of the request (detectLocale in src/lib/locale.ts): Dutch in
// the Netherlands and Belgium, English elsewhere. No cookie is written for the detected language, so
// travelling to another country changes the default, and the toggle still overrides it for good.
export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const value = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  if (isLocale(value)) return value;
  const h = await headers();
  return detectLocale({ country: h.get("x-vercel-ip-country"), acceptLanguage: h.get("accept-language") });
}
