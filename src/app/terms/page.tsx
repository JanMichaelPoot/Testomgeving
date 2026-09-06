import type { Metadata } from "next";
import { SiteHeader } from "@/components/window/SiteHeader";
import { SiteFooter } from "@/components/window/SiteFooter";
import { getLocale } from "@/lib/language";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { formatPrice } from "@/lib/pricing";

export async function generateMetadata(): Promise<Metadata> {
  const dict = getDictionary(await getLocale());
  return { title: dict.legal.termsTitle };
}

export default async function TermsPage() {
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const price = formatPrice(locale);

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader locale={locale} dict={dict.header} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
        <h1 className="font-serif text-3xl text-ink">{dict.legal.termsHeading}</h1>
        <p className="mt-4 text-ink/60">{dict.legal.termsIntro}</p>
        <div className="mt-8 space-y-6">
          {dict.legal.termsSections.map((section) => (
            <div key={section.heading}>
              <h2 className="font-serif text-lg text-ink">{section.heading}</h2>
              <p className="mt-1.5 text-sm text-ink/70">
                {section.body.replace("{price}", price)}
              </p>
            </div>
          ))}
        </div>
      </main>
      <SiteFooter locale={locale} dict={dict.footer} />
    </div>
  );
}
