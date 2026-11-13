import { Button } from "@/components/ui/Button";
import { HeroWindow } from "@/components/window/HeroWindow";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { HeroWindowData } from "@/lib/heroWindow";
import FRAME from "@/lib/heroWindowFrame.json";
import { ShareLinks } from "@/components/window/ShareLinks";
import { VENSTER_SELF_HREF } from "@/lib/vensterLanding";

// Landing hero, seen from INSIDE the room: the whole band is a limewashed plaster wall (no card around anything), the headline and the
// way in stand on the wall, and the photographed sash window (HeroWindow) is set into it, looking out on real images of the library
// (another set on another visit). The wall is lit from the window and fades into the page at the bottom.
const PLASTER = "url(/illustrations/hero-window/wall.jpg)";

export function VensterHero({
  dict,
  price,
  hero,
  siteUrl,
}: {
  dict: Dictionary["venster"]["landing"];
  price: string;
  hero: HeroWindowData;
  siteUrl: string;
}) {
  return (
    <section className="relative isolate overflow-hidden">
      {/* The wall. Plaster, a veil of the page colour so the text stays easy to read, the light that comes in at the window (more on the
          right, where it is) and a shadow towards the corners. */}
      <div aria-hidden="true" className="absolute inset-0 -z-10" style={{ backgroundColor: "#e4d8c4", backgroundImage: PLASTER, backgroundSize: "cover", backgroundPosition: "center" }} />
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-cream/22" />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(70%_80%_at_72%_46%,rgba(255,246,228,0.55),transparent_72%),radial-gradient(140%_120%_at_50%_40%,transparent_55%,rgba(60,41,32,0.22)_100%)]"
      />
      {/* The wall carries on into the page: it fades into the page colour just below the sill. */}
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 -z-10 h-32 bg-gradient-to-b from-transparent to-cream" />

      <div className="mx-auto w-full max-w-[84rem] px-4 pb-24 pt-8 sm:px-10 sm:pb-28 sm:pt-14">
        <div className="grid w-full items-center gap-10 md:grid-cols-[1fr_1.1fr] lg:gap-16">
          <div className="flex max-w-xl flex-col gap-6">
            <div className="inline-flex items-center gap-2 self-start rounded-full border border-border bg-paper px-3.5 py-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-gold" />
              <span className="text-xs font-medium text-ink/70">{dict.badge.replace("{price}", price)}</span>
            </div>
            {/* The name is the title: it is what people should remember. The question is the line under it. */}
            <h1 className="font-serif text-[3.4rem] leading-none tracking-[-0.02em] text-ink sm:text-7xl">
              Window<span className="italic text-gold-text bg-clip-text text-transparent bg-[linear-gradient(100deg,#7c5f20_0%,#a67f2c_45%,#c2a05a_55%,#8f6c22_100%)]">Into</span>
            </h1>
            <p className="font-serif text-2xl leading-snug tracking-[-0.01em] text-ink/85 sm:text-[1.75rem]">
              {dict.headline} <em className="text-gold-text">{dict.headlineEmphasis}</em>
            </p>
            <p className="max-w-md text-lg leading-relaxed text-ink/75">{dict.subcopy}</p>
            <div className="flex flex-col gap-3">
              <Button href={VENSTER_SELF_HREF} variant="hero" size="lg" className="min-h-14 w-full justify-center px-10 text-lg font-semibold sm:w-auto sm:min-w-72 sm:self-start">
                {dict.heroCta}
                <span aria-hidden="true" className="cta-arrow inline-block">
                  →
                </span>
              </Button>
              <p className="text-sm text-ink/65 sm:text-left">{dict.heroCtaNote}</p>
            </div>
            <ShareLinks siteUrl={siteUrl} copy={dict.share} />
          </div>

          {/* On a phone the window comes first and the words follow; on a big screen it is as tall as fits under the header (never wider than 600px). */}
          <div
            className="order-first mx-auto w-full max-w-[330px] sm:max-w-[440px] md:order-none lg:max-w-[clamp(380px,calc((100svh_-_170px)*var(--hero-aspect)),660px)]"
            style={{ "--hero-aspect": FRAME.aspect.toFixed(4) } as React.CSSProperties}
          >
            <HeroWindow items={hero.items} spare={hero.spare} title={dict.heroAlt} />
          </div>
        </div>
      </div>
    </section>
  );
}
