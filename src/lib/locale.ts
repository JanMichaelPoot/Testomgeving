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
