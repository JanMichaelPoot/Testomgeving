import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { VENSTER_SELF_HREF } from "@/lib/vensterLanding";

// Landing hero for "Het venster" (fase 7): the photo in the same arched walnut frame as the
// window the visitor is about to fill, one headline and two ways in (for yourself, as a gift).
// `heroSrc` is one photo of the hero pool (src/lib/heroPool.ts), another one on another visit.
export function VensterHero({
  dict,
  price,
  heroSrc,
  heroAlt,
  giftHref,
  voucherLabel,
}: {
  dict: Dictionary["venster"]["landing"];
  price: string;
  heroSrc: string;
  heroAlt: string;
  giftHref: string;
  /** The line under the buttons that leads to the gift voucher page. */
  voucherLabel?: string;
}) {
  return (
    <section className="mx-auto w-full max-w-[84rem] px-4 pt-8 sm:px-10 sm:pt-16">
      <div className="grid w-full items-center gap-10 md:grid-cols-[1fr_0.9fr] lg:gap-16">
        <div className="flex max-w-xl flex-col gap-6">
          <div className="inline-flex items-center gap-2 self-start rounded-full border border-border bg-paper px-3.5 py-1.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-gold" />
            <span className="text-xs font-medium text-ink/70">{dict.badge.replace("{price}", price)}</span>
          </div>
          <h1 className="font-serif text-[2.6rem] leading-[1.05] tracking-[-0.015em] text-ink sm:text-6xl">
            {dict.headline} <span className="italic text-accent">{dict.headlineEmphasis}</span>
          </h1>
          <p className="max-w-md text-lg leading-relaxed text-ink/75">{dict.subcopy}</p>
          <p className="max-w-md text-[15px] leading-relaxed text-ink/70">{dict.occasion}</p>
          {/* The two ways in carry the same weight: a gift is as much the point of the page as buying for yourself. */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button href={VENSTER_SELF_HREF} size="lg" className="justify-center sm:flex-1">
              {dict.selfCta}
            </Button>
            <Button href={giftHref} variant="secondary" size="lg" className="justify-center border-accent text-accent-dark sm:flex-1">
              {dict.giftCta}
            </Button>
          </div>
          {voucherLabel && (
            <Link href="/cadeaubon" className="inline-flex min-h-11 items-center self-start text-sm font-semibold text-accent-dark underline underline-offset-4">
              {voucherLabel}
            </Link>
          )}
        </div>

        <div className="mx-auto w-full max-w-[260px] sm:max-w-[360px] lg:max-w-[420px]">
          <div className="rounded-[50%_50%_14px_14px/34%_34%_14px_14px] bg-accent-dark p-3 shadow-[0_30px_60px_-30px_rgba(60,41,32,0.6)]">
            <div className="relative aspect-[3/4] overflow-hidden rounded-[50%_50%_6px_6px/32%_32%_6px_6px] ring-1 ring-gold/60">
              <Image
                src={heroSrc}
                alt={heroAlt}
                fill
                priority
                sizes="(min-width: 1024px) 420px, (min-width: 640px) 360px, 260px"
                className="object-cover"
              />
            </div>
          </div>
          <div className="mx-6 h-3 rounded-b-md bg-gold/70" />
        </div>
      </div>
    </section>
  );
}
