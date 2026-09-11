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
    <header className="sticky top-0 z-40 border-b border-accent/10 bg-cream/90 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4 sm:px-10">
        <Link href="/" className="flex items-center gap-2.5 text-accent-dark">
          <WindowMark className="h-7 w-7" />
          <span className="font-serif text-lg font-semibold tracking-tight text-ink">
            WINDOW
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          <Link href="/#wat-je-krijgt" className="text-sm text-ink/60 transition-colors hover:text-accent">
            {dict.navHowItWorks}
          </Link>
          <Link href="/#voorbeelden" className="text-sm text-ink/60 transition-colors hover:text-accent">
            {dict.navExamples}
          </Link>
          <Link href="/#over-ons" className="text-sm text-ink/60 transition-colors hover:text-accent">
            {dict.navAbout}
          </Link>
        </nav>

        <LanguageToggle locale={locale} label={dict.switchLanguage} />
      </div>
    </header>
  );
}
