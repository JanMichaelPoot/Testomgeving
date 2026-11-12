import Image from "next/image";
import { founderNoteFor, type HomeCopy, type HomeLocale, type Testimonial } from "@/lib/i18n/home";

// The trust block on the homepage: the founder's note (hidden until it is filled in, src/lib/i18n/home.ts) and testimonials (hidden
// until there are some). With neither, nothing is shown at all: the guarantee lives under the pay button, and the "no reviews yet" line
// and the guarantee card were taken off the homepage (Jan, 12 Nov 2026).
export function TrustBlock({
  copy,
  locale,
  testimonials,
}: {
  copy: HomeCopy["trust"];
  locale: HomeLocale;
  testimonials: Testimonial[];
}) {
  const founder = founderNoteFor(locale);
  if (!founder && testimonials.length === 0) return null;
  return (
    <section id="vertrouwen" className="mx-auto w-full max-w-[84rem] scroll-mt-24 px-6 py-16 sm:px-10">
      {founder && (
        <figure className="flex max-w-3xl items-start gap-5 rounded-lg border border-border bg-paper p-6 sm:p-8">
          {founder.photo && <Image src={founder.photo} alt={founder.name} width={72} height={72} className="h-[72px] w-[72px] shrink-0 rounded-full object-cover" />}
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.09em] text-gold-text">{copy.founderHeading}</p>
            <blockquote className="mt-2 font-serif text-xl leading-snug text-ink">{founder.sentence}</blockquote>
            <figcaption className="mt-2 text-sm text-ink/70">{founder.name}</figcaption>
          </div>
        </figure>
      )}

      {testimonials.length > 0 && (
        <div className={founder ? "mt-10" : ""}>
          <h2 className="font-serif text-2xl text-ink">{copy.testimonialsHeading}</h2>
          <ul className="mt-4 grid gap-4 sm:grid-cols-3">
            {testimonials.map((t) => (
              <li key={t.quote} className="rounded-lg border border-border bg-paper p-5">
                <blockquote className="text-[15px] leading-relaxed text-ink/80">&ldquo;{t.quote}&rdquo;</blockquote>
                <p className="mt-3 text-sm font-semibold text-ink">{t.attribution}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
