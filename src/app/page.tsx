import { Button } from "@/components/ui/Button";
import { SiteHeader } from "@/components/window/SiteHeader";
import { SiteFooter } from "@/components/window/SiteFooter";
import { HeroFanCollage } from "@/components/window/HeroFanCollage";
import { getLocale } from "@/lib/language";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { formatPrice } from "@/lib/pricing";

export default async function Home() {
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const price = formatPrice(locale);

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader locale={locale} dict={dict.header} />

      <main className="w-full flex-1">
        {/* Hero */}
        <section className="mx-auto w-full max-w-[84rem] px-6 py-16 sm:px-10 sm:py-24">
          <div className="grid w-full items-center gap-16 lg:grid-cols-[1fr_1.3fr]">
            <div className="max-w-xl">
              <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-border bg-paper px-4 py-1.5">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
                <span className="text-xs font-medium tracking-wide text-ink/70">
                  {dict.landing.ctaCaption.replace("{price}", price)}
                </span>
              </div>
              <h1 className="font-serif text-5xl leading-[1.1] text-ink sm:text-6xl">
                {dict.landing.headlineLine1}
                <br />
                <span className="text-accent">{dict.landing.headlineEmphasis}</span>
                <br />
                {dict.landing.headlineLine2}
              </h1>
              <p className="mt-6 max-w-md text-lg text-ink/70">{dict.landing.subcopy}</p>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Button href="/intake" size="lg">
                  {dict.landing.cta}
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Button>
                <Button href="/#voorbeelden" variant="secondary" size="lg">
                  {dict.landing.secondaryCta}
                </Button>
              </div>
            </div>

            <HeroFanCollage alt={dict.landing.heroAlt} />
          </div>
        </section>

        {/* What you get */}
        <section id="wat-je-krijgt" className="bg-paper py-20 px-6 sm:px-10">
          <div className="mx-auto w-full max-w-6xl">
            <div className="mb-14 text-center">
              <h2 className="font-serif text-3xl text-ink sm:text-4xl">
                {dict.landing.whatYouGetHeading}
              </h2>
              <p className="mx-auto mt-4 max-w-lg text-ink/60">
                {dict.landing.whatYouGetSubcopy}
              </p>
            </div>
            <div className="grid gap-6 sm:grid-cols-3">
              {dict.landing.whatYouGetItems.map((item) => (
                <div
                  key={item.title}
                  className="rounded-lg border border-border bg-cream p-7"
                >
                  <h3 className="font-serif text-lg text-ink">{item.title}</h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-ink/70">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Social proof */}
        <section id="voorbeelden" className="px-6 py-20 sm:px-10">
          <div className="mx-auto w-full max-w-6xl">
            <h2 className="mb-12 text-center font-serif text-3xl text-ink sm:text-4xl">
              {dict.landing.testimonialsHeading}
            </h2>
            <div className="grid gap-6 sm:grid-cols-3">
              {dict.landing.testimonials.map((t) => (
                <div key={t.name} className="rounded-lg border border-border bg-paper p-7">
                  <div className="mb-4 flex gap-0.5 text-ink" aria-hidden="true">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <svg key={i} width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                        <path d="M7 1l1.545 3.13L12 4.635l-2.5 2.437.59 3.441L7 8.885l-3.09 1.628.59-3.441L2 4.635l3.455-.505L7 1z" />
                      </svg>
                    ))}
                  </div>
                  <p className="mb-5 text-sm italic leading-relaxed text-ink">&ldquo;{t.quote}&rdquo;</p>
                  <p className="text-sm font-medium text-ink">{t.name}</p>
                  <p className="text-xs text-ink/50">{t.role}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Closing CTA banner */}
        <section className="px-6 py-20 sm:px-10">
          <div className="mx-auto max-w-3xl rounded-lg bg-accent-dark p-10 text-center sm:p-14">
            <h2 className="font-serif text-3xl font-semibold text-white sm:text-4xl">
              {dict.landing.ctaBannerHeading}
            </h2>
            <p className="mx-auto mt-4 max-w-md text-white/60">{dict.landing.ctaBannerBody}</p>
            <div className="mt-8">
              <Button href="/intake" variant="secondary" size="lg">
                {dict.landing.ctaBannerCta}
              </Button>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter locale={locale} dict={dict.footer} />
    </div>
  );
}
