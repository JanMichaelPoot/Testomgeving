import Link from "next/link";
import Image from "next/image";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/language";
import { formatPrice } from "@/lib/pricing";

export function SiteFooter({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary["footer"];
}) {
  const price = formatPrice(locale);

  return (
    <footer id="over-ons" className="mt-24 bg-accent-dark text-white/60">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-14 sm:flex-row sm:justify-between sm:px-10">
        <div>
          {/* A flat cream "reversed" cutout (windowinto-cream.png), not the
              walnut-colored wordmark used by SiteHeader — that asset's own
              walnut brown is close enough to this bg-accent-dark background
              that it would nearly disappear here. Replaces the old
              <WindowMark/><Wordmark onDark/> pair with the single supplied
              lockup. */}
          <div className="mb-3">
            <Image
              src="/logo/windowinto-cream.png"
              alt="WindowInto"
              width={800}
              height={237}
              className="h-7 w-auto"
            />
          </div>
          <p className="max-w-xs text-sm leading-relaxed">{dict.tagline}</p>
        </div>

        <div className="flex gap-14 text-sm">
          <div>
            <p className="mb-3 text-xs uppercase tracking-widest text-white/35">
              {dict.productHeading}
            </p>
            <div className="flex flex-col gap-2">
              <Link href="/#wat-je-krijgt" className="transition-colors hover:text-white">
                {dict.navHowItWorks}
              </Link>
              <Link href="/#voorbeelden" className="transition-colors hover:text-white">
                {dict.navExamples}
              </Link>
              <details className="group">
                <summary className="cursor-pointer list-none transition-colors hover:text-white">
                  {dict.priceFaqLabel}
                </summary>
                <p className="mt-2 max-w-56 text-white/50">
                  {dict.priceFaqAnswer.replace("{price}", price)}
                </p>
              </details>
            </div>
          </div>
          <div>
            <p className="mb-3 text-xs uppercase tracking-widest text-white/35">
              {dict.legalHeading}
            </p>
            <div className="flex flex-col gap-2">
              <Link href="/terms" className="transition-colors hover:text-white">
                {dict.terms}
              </Link>
              <Link href="/herroepingsrecht" className="transition-colors hover:text-white">
                {dict.withdrawal}
              </Link>
              <Link href="/privacy" className="transition-colors hover:text-white">
                {dict.privacy}
              </Link>
              <Link href="/privacy#cookies" className="transition-colors hover:text-white">
                {dict.cookies}
              </Link>
              <Link href="/privacy#contact" className="transition-colors hover:text-white">
                {dict.contact}
              </Link>
              <Link href="/privacy#bedrijfsgegevens" className="transition-colors hover:text-white">
                {dict.companyInfo}
              </Link>
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto w-full max-w-6xl border-t border-white/10 px-6 py-6 text-xs sm:px-10">
        &copy; {new Date().getFullYear()} WINDOW. Alle rechten voorbehouden.
      </div>
    </footer>
  );
}
