import { Button } from "@/components/ui/Button";
import { SiteHeader } from "@/components/window/SiteHeader";
import { SiteFooter } from "@/components/window/SiteFooter";
import { HeroFanCollage } from "@/components/window/HeroFanCollage";
import { HeroStartForm } from "@/components/window/HeroStartForm";
import { ExampleIdeaCard } from "@/components/window/ExampleIdeaCard";
import { EXAMPLE_IDEAS, EXAMPLE_IDEA_DOOR } from "@/lib/exampleIdea";
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
                <span className="italic text-accent">{dict.landing.headlineEmphasis}</span>
                <br />
                {dict.landing.headlineLine2}
              </h1>
              <p className="max-w-md text-lg leading-relaxed text-ink/75">{dict.landing.subcopy}</p>
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
                  .replace("{label}", dict.plan.book.doors[EXAMPLE_IDEA_DOOR].label)}
                firstStepLabel={dict.plan.reveal.firstStepHeading}
                className="absolute bottom-0 left-0 hidden w-[300px] -rotate-2 overflow-hidden rounded-lg border border-border bg-paper shadow-[0_30px_60px_-28px_rgba(60,41,32,0.55)] md:block lg:w-[340px]"
              />
              <p className="absolute bottom-4 left-[320px] hidden max-w-[180px] text-xs leading-snug text-ink/70 md:block lg:left-[360px]">
                {dict.landing.exampleCardCaption}
              </p>
            </div>
          </div>
        </section>

        {/* How it works + honest example block */}
        <section id="hoe" className="mx-auto mt-14 w-full max-w-[84rem] scroll-mt-24 px-6 sm:px-10">
          <div className="grid gap-8 border-t border-border pt-7 sm:grid-cols-3 lg:grid-cols-[repeat(3,minmax(0,1fr))_1.2fr] lg:gap-8">
            <h2 className="sr-only">{dict.landing.howHeading}</h2>
            {dict.landing.howSteps.map((step, i) => (
              <div key={step.title} className="flex flex-col gap-1.5">
                <span className="font-serif text-3xl text-walnut-light">{i + 1}</span>
                <p className="text-[15px] font-semibold text-ink">{step.title}</p>
                <p className="text-sm leading-relaxed text-ink/70">{step.body}</p>
              </div>
            ))}
            <div
              id="voorbeelden"
              className="flex scroll-mt-24 flex-col gap-2.5 rounded-lg bg-surface-active p-5 sm:col-span-3 lg:col-span-1"
            >
              <p className="text-sm leading-relaxed text-accent-dark">{dict.landing.honestBody}</p>
              <a
                href={`/examples/idea-book-${locale}.pdf`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center self-start text-sm font-semibold text-accent-dark underline underline-offset-2 hover:text-accent"
              >
                {dict.landing.honestLinkLabel}
              </a>
            </div>
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
