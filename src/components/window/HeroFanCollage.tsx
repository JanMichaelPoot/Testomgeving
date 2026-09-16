import Image from "next/image";

// A single, pre-composed fan-of-photos image (supplied directly, not built
// from separate wedges) — its own warm browns/creams already sit close to
// the site's Warm Walnut palette, so it's shown plainly (no card border,
// no background box) rather than boxed like the other framed photos on the
// site: the fan shape already reads as a finished object, and a rectangular
// border would just show off the flat white space around it.
export function HeroFanCollage({ alt }: { alt: string }) {
  return (
    <div className="relative mx-auto w-full max-w-2xl lg:max-w-none">
      <div className="relative aspect-[1255/848] w-full drop-shadow-[0_16px_32px_rgba(60,41,32,0.18)]">
        <Image
          src="/illustrations/hero-fan/hero.jpg"
          alt={alt}
          fill
          sizes="(min-width: 1024px) 50vw, 90vw"
          className="object-contain"
          priority
        />
      </div>
    </div>
  );
}
