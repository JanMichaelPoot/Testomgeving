import Link from "next/link";
import { WindowMark } from "./WindowMark";
import { LanguageToggle } from "./LanguageToggle";
import type { Locale } from "@/lib/language";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function SiteHeader({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary["header"];
}) {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6 sm:px-10">
      <Link
        href="/"
        className="flex items-center gap-2 text-accent-dark"
      >
        <WindowMark className="h-6 w-6" />
        <span className="font-sans text-sm font-semibold tracking-[0.2em] text-ink">
          WINDOW
        </span>
      </Link>
      <LanguageToggle locale={locale} label={dict.switchLanguage} />
    </header>
  );
}
