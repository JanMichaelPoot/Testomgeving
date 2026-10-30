import Image from "next/image";
import { founderNoteFor, type HomeCopy, type HomeLocale, type Testimonial } from "@/lib/i18n/home";

// The trust block on the homepage: what we do and do not claim, the guarantee, the honest "no reviews yet", the founder's note (hidden
// until it is filled in, src/lib/i18n/home.ts) and testimonials (hidden until there are some).
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
  return (
    <section id="vertrouwen" className="mx-auto w-full max-w-[84rem] scroll-mt-24 px-6 py-16 sm:px-10">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-4 rounded-lg border border-border bg-paper p-6 sm:p-8">
          <p className="text-[15px] leading-relaxed text-ink/80">{copy.aiLine}</p>
          <div className="rounded-lg bg-surface-active p-4">
            <p className="font-semibold text-ink">{copy.guaranteeTitle}</p>
            <p className="mt-1 text-[15px] text-ink/80">{copy.guaranteeBody}</p>
          </div>
          <p className="text-sm text-ink/70">{copy.noReviews}</p>
        </div>

        {founder && (
          <figure className="flex items-start gap-5 rounded-lg border border-border bg-paper p-6 sm:p-8">
            {founder.photo && <Image src={founder.photo} alt={founder.name} width={72} height={72} className="h-[72px] w-[72px] shrink-0 rounded-full object-cover" />}
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.09em] text-gold-text">{copy.founderHeading}</p>
              <blockquote className="mt-2 font-serif text-xl leading-snug text-ink">{founder.sentence}</blockquote>
              <figcaption className="mt-2 text-sm text-ink/70">{founder.name}</figcaption>
            </div>
          </figure>
        )}
      </div>

      {testimonials.length > 0 && (
        <div className="mt-10">
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
