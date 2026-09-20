import Link from "next/link";
import Image from "next/image";
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
        {/* This is the row's first flex child under justify-between, so the
            wordmark sits flush against the content column's left edge on
            every page that renders SiteHeader — the source PNG is cropped
            tight to the mark's own bounds (no baked-in padding), so no
            transparent margin pushes it off that edge. Replaces the old
            <WindowMark/><Wordmark/> pair with the single supplied lockup
            (see public/logo/windowinto-color.png), recolored from its
            original green to this site's walnut accent family. */}
        <Link href="/" className="flex shrink-0 items-center">
          <Image
            src="/logo/windowinto-color.png"
            alt="WindowInto"
            width={800}
            height={237}
            priority
            className="h-8 w-auto sm:h-9"
          />
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
