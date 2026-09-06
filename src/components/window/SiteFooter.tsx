import Link from "next/link";
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
    <footer className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-6 py-8 text-xs text-ink/50 sm:px-10">
      <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
        <span>&copy; {new Date().getFullYear()} WINDOW</span>
        <div className="flex items-center gap-4">
          <Link href="/privacy" className="hover:text-ink">
            {dict.privacy}
          </Link>
          <Link href="/terms" className="hover:text-ink">
            {dict.terms}
          </Link>
          <details className="group relative">
            <summary className="cursor-pointer list-none hover:text-ink">
              {dict.priceFaqLabel}
            </summary>
            <p className="absolute right-0 z-10 mt-2 w-56 rounded-xl border border-ink/10 bg-paper p-3 text-ink/70 shadow-md sm:left-0 sm:right-auto">
              {dict.priceFaqAnswer.replace("{price}", price)}
            </p>
          </details>
        </div>
      </div>
    </footer>
  );
}
