import Link from "next/link";
import { SiteHeader } from "@/components/window/SiteHeader";
import { SiteFooter } from "@/components/window/SiteFooter";
import { getLocale } from "@/lib/language";
import { getDictionary } from "@/lib/i18n/dictionaries";

// A page that does not exist, in the visitor's language (Next's own 404 is English only).
export default async function NotFound() {
  const locale = await getLocale();
  const dict = getDictionary(locale);
  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader locale={locale} dict={dict.header} />
      <main className="mx-auto w-full max-w-xl flex-1 px-6 py-24 text-center">
        <h1 className="font-serif text-3xl text-ink">{dict.venster.errors.notFoundTitle}</h1>
        <p className="mt-4 text-ink/60">{dict.venster.errors.notFoundBody}</p>
        <Link
          href="/"
          className="mt-8 inline-flex min-h-12 items-center rounded-lg bg-accent-dark px-6 font-semibold text-paper hover:shadow-md"
        >
          {dict.venster.errors.home}
        </Link>
      </main>
      <SiteFooter locale={locale} dict={dict.footer} />
    </div>
  );
}
