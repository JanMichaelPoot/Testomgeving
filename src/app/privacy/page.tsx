import type { Metadata } from "next";
import { SiteHeader } from "@/components/window/SiteHeader";
import { SiteFooter } from "@/components/window/SiteFooter";
import { getLocale } from "@/lib/language";
import { getDictionary } from "@/lib/i18n/dictionaries";

export async function generateMetadata(): Promise<Metadata> {
  const dict = getDictionary(await getLocale());
  return { title: dict.legal.privacyTitle };
}

export default async function PrivacyPage() {
  const locale = await getLocale();
  const dict = getDictionary(locale);

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader locale={locale} dict={dict.header} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
        <h1 className="font-serif text-3xl text-ink">{dict.legal.privacyHeading}</h1>
        <p className="mt-4 text-ink/60">{dict.legal.privacyIntro}</p>
        <div className="mt-8 space-y-6">
          {dict.legal.privacySections.map((section) => (
            <div key={section.heading}>
              <h2 className="font-serif text-lg text-ink">{section.heading}</h2>
              <p className="mt-1.5 text-sm text-ink/70">{section.body}</p>
            </div>
          ))}
        </div>
      </main>
      <SiteFooter locale={locale} dict={dict.footer} />
    </div>
  );
}
