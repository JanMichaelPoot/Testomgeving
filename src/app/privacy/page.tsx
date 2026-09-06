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
        <p className="mt-6 rounded-lg border border-dashed border-ink/30 bg-paper px-4 py-3 text-sm text-ink/70">
          {dict.legal.privacyBody}
        </p>
      </main>
      <SiteFooter dict={dict.footer} />
    </div>
  );
}
