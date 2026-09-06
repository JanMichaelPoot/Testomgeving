import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { SiteHeader } from "@/components/window/SiteHeader";
import { SiteFooter } from "@/components/window/SiteFooter";
import { LANDING_HERO_ILLUSTRATION } from "@/lib/illustrations";
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

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12 sm:px-10">
        <div className="grid w-full items-center gap-16 lg:grid-cols-2">
          <div className="max-w-xl">
            <h1 className="font-serif text-5xl leading-[1.1] text-ink sm:text-6xl">
              {dict.landing.headlineLine1}
              <br />
              {dict.landing.headlineLine2}
            </h1>
            <p className="mt-6 text-lg text-ink/70">{dict.landing.subcopy}</p>
            <div className="mt-8">
              <Button href="/intake">{dict.landing.cta}</Button>
              <p className="mt-3 text-sm text-ink/50">
                {dict.landing.ctaCaption.replace("{price}", price)}
              </p>
            </div>
          </div>

          <div className="relative mx-auto aspect-4/3 w-full max-w-lg overflow-hidden rounded-2xl shadow-lg lg:max-w-none">
            <Image
              src={LANDING_HERO_ILLUSTRATION}
              alt={dict.landing.heroAlt}
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
              priority
            />
          </div>
        </div>

        <div className="mt-20 border-t border-ink/10 pt-14 sm:mt-28">
          <h2 className="font-serif text-2xl text-ink sm:text-3xl">
            {dict.landing.whatYouGetHeading}
          </h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {dict.landing.whatYouGetItems.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-ink/10 bg-paper p-6 shadow-sm"
              >
                <h3 className="font-serif text-lg text-ink">{item.title}</h3>
                <p className="mt-2 text-sm text-ink/60">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      <SiteFooter locale={locale} dict={dict.footer} />
    </div>
  );
}
