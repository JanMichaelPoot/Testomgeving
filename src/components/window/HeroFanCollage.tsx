import Image from "next/image";

// A single, pre-composed fan-of-photos image (supplied directly, not built
// from separate wedges) — its own warm browns/creams already sit close to
// the site's Warm Walnut palette, so it's shown plainly (no card border,
// no background box) rather than boxed like the other framed photos on the
// site: the fan shape already reads as a finished object, and a rectangular
// border would just show off the flat white space around it.
//
// Deliberately no drop-shadow/filter here: the source is an opaque JPEG
// (no alpha channel), so any CSS drop-shadow gets cast around its full
// rectangular bounding box, not around the visible fan silhouette — that
// rectangle is exactly the unwanted "frame" this was reported as showing.
// The image's own off-white background already sits within a couple of
// RGB values of --color-cream, so it blends in on its own without one.
export function HeroFanCollage({ alt }: { alt: string }) {
  return (
    <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
      <div className="relative aspect-[1255/848] w-full">
        <Image
          src="/illustrations/hero-fan/hero.jpg"
          alt={alt}
          fill
          sizes="(min-width: 1024px) 40vw, 90vw"
          className="object-contain"
          priority
        />
      </div>
    </div>
  );
}
