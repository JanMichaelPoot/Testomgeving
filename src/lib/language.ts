import { cookies } from "next/headers";
import { LOCALE_COOKIE_NAME, SUPPORTED_LOCALES, type Locale } from "@/lib/locale";

export { LOCALE_COOKIE_NAME, SUPPORTED_LOCALES, languageLabel, type Locale } from "@/lib/locale";

const DEFAULT_LOCALE: Locale = "nl";

function isLocale(value: string | undefined): value is Locale {
  return SUPPORTED_LOCALES.some((locale) => locale.code === value);
}

// Server-only — reads the cookie set by the language toggle
// (src/components/window/LanguageToggle.tsx via src/app/actions/locale.ts).
// Dutch is the standard; English is an explicit opt-in, never
// browser-detected.
export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const value = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}
