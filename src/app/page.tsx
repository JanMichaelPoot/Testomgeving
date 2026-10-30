import { Button } from "@/components/ui/Button";
import { SiteHeader } from "@/components/window/SiteHeader";
import { SiteFooter } from "@/components/window/SiteFooter";
import { HeroFanCollage } from "@/components/window/HeroFanCollage";
import { HeroStartForm } from "@/components/window/HeroStartForm";
import { ExampleIdeaCard } from "@/components/window/ExampleIdeaCard";
import { EXAMPLE_IDEAS, EXAMPLE_IDEA_DOOR } from "@/lib/exampleIdea";
import { getLocale } from "@/lib/language";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getVisitorPrice } from "@/lib/visitorPrice";
import { VensterHero } from "@/components/window/VensterHero";
import { getGiftCopy } from "@/lib/i18n/gift";
import { giftHrefWithArrival, newArrivalId, showVensterLanding, VENSTER_SELF_HREF } from "@/lib/vensterLanding";
import { heroAltText, randomHero } from "@/lib/heroPool";
import Link from "next/link";
import { SampleSpreads } from "@/components/window/SampleSpreads";
import { FaqList } from "@/components/window/FaqList";
import { TrustBlock } from "@/components/window/TrustBlock";
import { getHomeCopy, TESTIMONIALS } from "@/lib/i18n/home";

// The pages of the sample book shown on the homepage (see scripts/make-sample-spreads.py): the cover and two idea pages.
const SAMPLE_SPREADS = ["cover", "profile", "idea-1", "idea-2"] as const;

export default async function Home(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const price = (await getVisitorPrice("self")).label(locale);
  const home = getHomeCopy(locale);
  const venster = showVensterLanding(
    process.env.NEXT_PUBLIC_ASSOCIATION_WIZARD_PERCENT,
    (await props.searchParams).venster,
  );
  const hero = randomHero();
  const howSteps = venster
    ? dict.venster.landing.chapters
    : dict.landing.howSteps;

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader locale={locale} dict={dict.header} />

      <main className="w-full flex-1">
        {venster ? (
          <VensterHero dict={dict.venster.landing} price={price} heroSrc={hero.image} heroAlt={heroAltText(hero, locale, dict.venster.landing.heroAlt)} giftHref={giftHrefWithArrival(newArrivalId())} voucherLabel={getGiftCopy(locale).homeLink} />
        ) : (
          <section className="mx-auto w-full max-w-[84rem] px-6 pt-12 sm:px-10 sm:pt-16">
            <div className="grid w-full items-center gap-12 lg:grid-cols-[1fr_1.05fr] lg:gap-14">
              <div className="flex max-w-xl flex-col gap-6">
                <div className="inline-flex items-center gap-2 self-start rounded-full border border-border bg-paper px-3.5 py-1.5">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
                  <span className="text-xs font-medium text-ink/70">
                    {dict.landing.badge.replace("{price}", price)}
                  </span>
                </div>
                <h1 className="font-serif text-5xl leading-[1.05] tracking-[-0.015em] text-ink sm:text-6xl">
                  {dict.landing.headlineLine1}
                  <br />
                  <span className="italic text-accent">
                    {dict.landing.headlineEmphasis}
                  </span>
                  <br />
                  {dict.landing.headlineLine2}
                </h1>
                <p className="max-w-md text-lg leading-relaxed text-ink/75">
                  {dict.landing.subcopy}
                </p>
                <HeroStartForm
                  label={dict.landing.startLabel}
                  placeholder={dict.intake.situation.placeholder}
                  cta={dict.landing.startCta}
                  suggestions={dict.intake.situation.suggestions.slice(0, 3)}
                />
              </div>

              {/* The real example idea overlaps the collage's lower-left on
                wider screens; below md the collage stands alone. */}
              <div className="relative pb-0 md:pb-28">
                <HeroFanCollage alt={dict.landing.heroAlt} />
                <ExampleIdeaCard
                  idea={EXAMPLE_IDEAS[locale]}
                  doorLine={dict.plan.reveal.doorLabel
                    .replace("{n}", String(1))
                    .replace(
                      "{label}",
                      dict.plan.book.doors[EXAMPLE_IDEA_DOOR].label,
                    )}
                  firstStepLabel={dict.plan.reveal.firstStepHeading}
                  className="absolute bottom-0 left-0 hidden w-[300px] -rotate-2 overflow-hidden rounded-lg border border-border bg-paper shadow-[0_30px_60px_-28px_rgba(60,41,32,0.55)] md:block lg:w-[340px]"
                />
                <p className="absolute bottom-4 left-[320px] hidden max-w-[180px] text-xs leading-snug text-ink/70 md:block lg:left-[360px]">
                  {dict.landing.exampleCardCaption}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* How it works */}
        <section
          id="hoe"
          className="mx-auto mt-14 w-full max-w-[84rem] scroll-mt-24 px-6 sm:px-10"
        >
          <div className="grid gap-8 border-t border-border pt-7 sm:grid-cols-3 lg:gap-12">
            <h2 className="sr-only">{dict.landing.howHeading}</h2>
            {howSteps.map((step, i) => (
              <div key={step.title} className="flex flex-col gap-1.5">
                <span className="font-serif text-3xl text-walnut-light">
                  {i + 1}
                </span>
                <p className="text-[15px] font-semibold text-ink">
                  {step.title}
                </p>
                <p className="text-sm leading-relaxed text-ink/70">
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* The sample book: three pages as pictures with a lightbox, the PDF, and what is free before paying */}
        <section id="voorbeeld" className="mx-auto mt-16 w-full max-w-[84rem] scroll-mt-24 px-4 sm:px-10">
          <div className="mb-8 max-w-2xl px-2 sm:px-0">
            <h2 className="font-serif text-3xl text-ink sm:text-4xl">{home.sample.heading}</h2>
            <p className="mt-3 text-ink/70">{home.sample.sub}</p>
          </div>
          <SampleSpreads
            spreads={SAMPLE_SPREADS.map((file, i) => ({ src: `/examples/spreads/${locale}-${file}.jpg`, alt: home.sample.spreads[i].alt, name: home.sample.spreads[i].name }))}
            labels={home.sample}
          />
          <div className="mt-6 flex flex-col gap-3 px-2 sm:flex-row sm:items-center sm:justify-between sm:px-0">
            <p className="max-w-xl text-[15px] font-medium text-ink/80">{home.sample.freeNote}</p>
            <a
              href={`/examples/idea-book-${locale}.pdf`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center text-sm font-semibold text-accent-dark underline underline-offset-2 hover:text-accent"
            >
              {home.sample.pdfLink}
            </a>
          </div>
        </section>

        {/* What makes it different */}
        <section id="waarom" className="mt-16 scroll-mt-24 bg-paper px-6 py-16 sm:px-10">
          <div className="mx-auto w-full max-w-6xl">
            <div className="mb-10 max-w-2xl">
              <h2 className="font-serif text-3xl text-ink sm:text-4xl">{home.differentiators.heading}</h2>
              <p className="mt-3 text-ink/70">{home.differentiators.sub}</p>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {home.differentiators.items.map((item) => (
                <div key={item.title} className="rounded-lg border border-border bg-cream p-6">
                  <h3 className="font-serif text-lg text-ink">{item.title}</h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-ink/70">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <TrustBlock copy={home.trust} locale={locale} testimonials={TESTIMONIALS} />

        {/* FAQ */}
        <section id="faq" className="mx-auto w-full max-w-3xl scroll-mt-24 px-6 pb-20 sm:px-10">
          <h2 className="font-serif text-3xl text-ink sm:text-4xl">{home.faq.heading}</h2>
          <p className="mb-8 mt-3 text-ink/70">{home.faq.sub}</p>
          <FaqList items={home.faq.items} price={price} />
          <Link href="/wat-zit-erin" className="mt-5 inline-flex min-h-11 items-center text-sm font-semibold text-accent-dark underline underline-offset-2 hover:text-accent">
            {home.faq.all}
          </Link>
        </section>

        {/* Closing CTA banner */}
        <section className="px-6 py-20 sm:px-10">
          <div className="mx-auto max-w-3xl rounded-lg bg-accent-dark p-10 text-center sm:p-14">
            <h2 className="font-serif text-3xl font-semibold text-white sm:text-4xl">
              {dict.landing.ctaBannerHeading}
            </h2>
            <p className="mx-auto mt-4 max-w-md text-white/60">
              {dict.landing.ctaBannerBody}
            </p>
            <div className="mt-8">
              <Button
                href={venster ? VENSTER_SELF_HREF : "/intake"}
                variant="secondary"
                size="lg"
              >
                {venster
                  ? dict.venster.landing.selfCta
                  : dict.landing.ctaBannerCta}
              </Button>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter locale={locale} dict={dict.footer} />
    </div>
  );
}
