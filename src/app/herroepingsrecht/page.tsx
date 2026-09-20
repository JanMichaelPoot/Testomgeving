import type { Metadata } from "next";
import { SiteHeader } from "@/components/window/SiteHeader";
import { SiteFooter } from "@/components/window/SiteFooter";
import { getLocale } from "@/lib/language";
import { getDictionary } from "@/lib/i18n/dictionaries";

// Model C digital sale compliance, section 9 — a standalone route (not
// only a subsection of /terms, even though /terms already covers the same
// ground briefly) so the withdrawal-right information is directly
// linkable from checkout, the footer, and the order confirmation e-mail.
export async function generateMetadata(): Promise<Metadata> {
  const dict = getDictionary(await getLocale());
  return { title: dict.legal.withdrawalTitle };
}

export default async function WithdrawalRightPage() {
  const locale = await getLocale();
  const dict = getDictionary(locale);

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader locale={locale} dict={dict.header} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
        <h1 className="font-serif text-3xl text-ink">{dict.legal.withdrawalHeading}</h1>
        <p className="mt-4 text-ink/60">{dict.legal.withdrawalIntro}</p>
        <div className="mt-8 space-y-6">
          {dict.legal.withdrawalSections.map((section) => (
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
