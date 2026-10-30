import type { Metadata } from "next";
import { Button } from "@/components/ui/Button";
import { SiteHeader } from "@/components/window/SiteHeader";
import { SiteFooter } from "@/components/window/SiteFooter";
import { FaqList } from "@/components/window/FaqList";
import { getLocale } from "@/lib/language";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getHomeCopy, withPrice } from "@/lib/i18n/home";
import { formatPrice } from "@/lib/pricing";
import { DOORS } from "@/lib/productStructure";
import { VENSTER_SELF_HREF } from "@/lib/vensterLanding";

// "Wat zit erin": what a book contains, door by door, plus the FAQ. Public, static content, nothing personal.
export async function generateMetadata(): Promise<Metadata> {
  const home = getHomeCopy(await getLocale());
  return {
    title: `${home.inside.title} — WINDOW`,
    description: home.inside.metaDescription,
    alternates: { canonical: "/wat-zit-erin" },
  };
}

export default async function InsidePage() {
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const home = getHomeCopy(locale);
  const price = formatPrice(locale);
  const t = home.inside;

  // The FAQ as structured data, so search engines can show the answers. A data block, not a script that runs.
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: home.faq.items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: withPrice(item.answer, price) },
    })),
  };

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader locale={locale} dict={dict.header} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12 sm:px-10 sm:py-16">
        <h1 className="font-serif text-4xl leading-tight text-ink sm:text-5xl">{t.title}</h1>
        <p className="mt-4 text-lg leading-relaxed text-ink/75">{t.intro}</p>

        <section className="mt-12" aria-labelledby="doors-heading">
          <h2 id="doors-heading" className="font-serif text-2xl text-ink">
            {t.doorsHeading}
          </h2>
          <p className="mt-2 text-ink/70">{t.doorsIntro}</p>
          <ol className="mt-5 grid gap-3 sm:grid-cols-2">
            {DOORS.map((door, i) => (
              <li key={door.id} className="rounded-lg border border-border bg-paper p-5">
                <p className="text-xs font-bold uppercase tracking-[0.09em] text-gold-text">
                  {i + 1} · {door.label[locale]}
                </p>
                <p className="mt-1.5 text-[15px] leading-relaxed text-ink/80">{door.description[locale]}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-12" aria-labelledby="per-idea-heading">
          <h2 id="per-idea-heading" className="font-serif text-2xl text-ink">
            {t.perIdeaHeading}
          </h2>
          <dl className="mt-5 grid gap-5 sm:grid-cols-2">
            {t.perIdea.map((item) => (
              <div key={item.title}>
                <dt className="font-semibold text-ink">{item.title}</dt>
                <dd className="mt-1 text-[15px] leading-relaxed text-ink/75">{item.body}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-12" aria-labelledby="besides-heading">
          <h2 id="besides-heading" className="font-serif text-2xl text-ink">
            {t.besidesHeading}
          </h2>
          <dl className="mt-5 grid gap-5 sm:grid-cols-3">
            {t.besides.map((item) => (
              <div key={item.title} className="rounded-lg bg-surface-active p-5">
                <dt className="font-semibold text-ink">{item.title}</dt>
                <dd className="mt-1 text-[15px] leading-relaxed text-ink/75">{withPrice(item.body, price)}</dd>
              </div>
            ))}
          </dl>
        </section>

        <div className="mt-10">
          <Button href={VENSTER_SELF_HREF} size="lg">
            {t.cta}
          </Button>
        </div>

        <section id="faq" className="mt-16 scroll-mt-24" aria-labelledby="faq-heading">
          <h2 id="faq-heading" className="font-serif text-2xl text-ink">
            {t.faqHeading}
          </h2>
          <div className="mt-5">
            <FaqList items={home.faq.items} price={price} />
          </div>
        </section>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c") }} />
      </main>
      <SiteFooter locale={locale} dict={dict.footer} />
    </div>
  );
}
