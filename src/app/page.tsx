import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { SiteHeader } from "@/components/window/SiteHeader";
import { SiteFooter } from "@/components/window/SiteFooter";
import { HERO_WINDOW_PANELS } from "@/lib/illustrations";
import { getLocale } from "@/lib/language";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { formatPrice } from "@/lib/pricing";

function WindowIllustration({ alt }: { alt: string }) {
  return (
    <div className="relative mx-auto aspect-4/3 w-full max-w-lg lg:max-w-none" role="img" aria-label={alt}>
      <div className="absolute inset-0 overflow-hidden rounded-3xl border-2 border-gold/40 bg-accent-dark shadow-2xl">
        <div className="grid h-full grid-cols-2 grid-rows-2 gap-0.5 bg-gold/30 p-0.5">
          {HERO_WINDOW_PANELS.map((panel, i) => (
            <div key={i} className="relative overflow-hidden">
              <Image
                src={panel.photo}
                alt=""
                fill
                sizes="(min-width: 1024px) 25vw, 50vw"
                className="object-cover"
                priority={i < 2}
              />
              <div className="absolute inset-0 bg-accent/10" />
            </div>
          ))}
        </div>
      </div>
      <div className="absolute -bottom-3 left-4 right-4 h-6 rounded-full bg-ink/15 blur-md" />
    </div>
  );
}

export default async function Home() {
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const price = formatPrice(locale);

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader locale={locale} dict={dict.header} />

      <main className="w-full flex-1">
        {/* Hero */}
        <section className="mx-auto w-full max-w-6xl px-6 py-16 sm:px-10 sm:py-24">
          <div className="grid w-full items-center gap-16 lg:grid-cols-2">
            <div className="max-w-xl">
              <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-gold/40 bg-accent/10 px-4 py-1.5">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
                <span className="text-xs font-medium tracking-wide text-accent-dark">
                  {dict.landing.badgeLabel}
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
              <div className="mt-9 flex flex-col gap-4 sm:flex-row">
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
              <p className="mt-5 text-xs text-ink/50">
                {dict.landing.ctaCaption.replace("{price}", price)}
              </p>
            </div>

            <WindowIllustration alt={dict.landing.heroAlt} />
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
                  className="rounded-2xl border border-accent/10 bg-cream p-7"
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
                <div key={t.name} className="rounded-2xl border border-accent/10 bg-paper p-7 shadow-sm">
                  <div className="mb-4 flex gap-0.5 text-gold" aria-hidden="true">
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
          <div className="relative mx-auto max-w-3xl overflow-hidden rounded-3xl bg-accent-dark p-10 text-center sm:p-14">
            <div className="pointer-events-none absolute right-0 top-0 h-64 w-64 -translate-y-32 translate-x-32 rounded-full bg-accent/40" />
            <div className="pointer-events-none absolute bottom-0 left-0 h-48 w-48 -translate-x-24 translate-y-24 rounded-full bg-gold/15" />
            <div className="relative">
              <h2 className="font-serif text-3xl font-semibold text-white sm:text-4xl">
                {dict.landing.ctaBannerHeading}
              </h2>
              <p className="mx-auto mt-4 max-w-md text-white/60">{dict.landing.ctaBannerBody}</p>
              <div className="mt-8">
                <Button href="/intake" size="lg">
                  {dict.landing.ctaBannerCta}
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter locale={locale} dict={dict.footer} />
    </div>
  );
}
