import { Button } from "@/components/ui/Button";
import { HeroWindow } from "@/components/window/HeroWindow";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { HeroWindowData } from "@/lib/heroWindow";
import { VENSTER_SELF_HREF } from "@/lib/vensterLanding";

// Landing hero for "Het venster": the app's own rectangular sash window (HeroWindow), filled with real images of the
// library (another set on another visit), one headline and one way in: starting your own journey of discovery.
export function VensterHero({
  dict,
  price,
  hero,
}: {
  dict: Dictionary["venster"]["landing"];
  price: string;
  hero: HeroWindowData;
}) {
  return (
    <section className="mx-auto w-full max-w-[84rem] px-4 pt-8 sm:px-10 sm:pt-16">
      <div className="grid w-full items-center gap-10 md:grid-cols-[1fr_1fr] lg:gap-16">
        <div className="flex max-w-xl flex-col gap-6">
          <div className="inline-flex items-center gap-2 self-start rounded-full border border-border bg-paper px-3.5 py-1.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-gold" />
            <span className="text-xs font-medium text-ink/70">{dict.badge.replace("{price}", price)}</span>
          </div>
          <h1 className="font-serif text-[2.6rem] leading-[1.05] tracking-[-0.015em] text-ink sm:text-6xl">
            {dict.headline} <span
              className="italic text-gold-text bg-clip-text text-transparent [-webkit-box-decoration-break:clone] [box-decoration-break:clone] bg-[linear-gradient(100deg,#7c5f20_0%,#a67f2c_45%,#c2a05a_55%,#8f6c22_100%)]"
            >
              {dict.headlineEmphasis}
            </span>
          </h1>
          <p className="max-w-md text-lg leading-relaxed text-ink/75">{dict.subcopy}</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button href={VENSTER_SELF_HREF} size="lg" className="justify-center sm:min-w-64">
              {dict.selfCta}
            </Button>
          </div>
        </div>

        {/* On a big screen the window is as tall as fits under the header, never more than 560px wide. */}
        <div className="mx-auto w-full max-w-[340px] sm:max-w-[460px] lg:max-w-[clamp(380px,calc((100svh_-_190px)/1.375),560px)]">
          <HeroWindow items={hero.items} spare={hero.spare} title={dict.heroAlt} />
        </div>
      </div>
    </section>
  );
}
