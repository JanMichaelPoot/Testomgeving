import type { IdeaBookEntry } from "@/lib/claude/ideaBookTypes";
import { hasMoreLayers } from "@/lib/claude/ideaLayers";
import { mapsSearchUrl } from "@/lib/maps";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";

// More body per door (R2.3): how it feels, three sizes, real places, related activities and
// what comes after. Every layer is optional: a book made before this existed shows nothing
// here at all, and a layer the model left out is simply absent.
//
// "full" is the buyer's own view. On a phone the layers sit behind a "More about this door"
// fold so the page keeps its pace; on a computer they are simply shown. "shared" is the public
// preview (/shared/[id]): only the three sizes, no places and nothing personal.
//
// The row of sizes follows the width of its own box (a container query), so it is three columns
// where there is room (the dialog) and a swipe row where there is not (a phone, the one-thing card).
//
// The phone and computer versions are two renderings of the same layers, switched with CSS
// (md:hidden / hidden md:block), so nothing depends on JavaScript or on a hydration guess.

type More = Dictionary["venster"]["more"];

function Layers({ idea, copy, mode }: { idea: IdeaBookEntry; copy: More; mode: "full" | "shared" }) {
  const full = mode === "full";
  return (
    <div className="space-y-5">
      {full && idea.feels_like && (
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-accent">{copy.feelsHeading}</p>
          <p className="font-serif text-lg italic leading-[1.5] text-ink">{idea.feels_like}</p>
        </div>
      )}

      {idea.sizes && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-accent">{copy.sizesHeading}</p>
          {/* Phone: a row you swipe through, the next card peeking in (snap). Computer: three columns. */}
          <ul
            role="list"
            tabIndex={0}
            aria-label={copy.sizesHeading}
            className="-mx-1 flex [contain:inline-size] snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2 @md:mx-0 @md:grid @md:grid-cols-3 @md:overflow-visible @md:px-0 @md:pb-0 @md:[contain:none]"
          >
            {idea.sizes.map((size, i) => (
              <li
                key={size.kind}
                className="flex w-[78%] shrink-0 snap-start flex-col gap-1.5 rounded-md border border-border bg-cream p-4 @md:w-auto"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-dark">
                  {copy.sizeNames[i]}
                  <span className="ml-2 font-medium normal-case tracking-normal text-ink/70">{copy.sizeHints[i]}</span>
                </p>
                <p className="text-[15px] font-semibold leading-snug text-ink">{size.title}</p>
                <p className="text-sm leading-relaxed text-ink/80">{size.description}</p>
                <p className="mt-auto pt-1 text-sm font-medium text-accent-dark">
                  {size.estimated_cost} · {size.duration}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {full && idea.places && idea.places.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-accent">{copy.placesHeading}</p>
          <p className="mb-2 text-xs text-ink/70">{copy.placesNote}</p>
          <ul role="list" className="space-y-2">
            {idea.places.map((place) => (
              <li key={`${place.name}|${place.city}`} className="rounded-md border border-border bg-paper p-3.5">
                <p className="text-[15px] font-semibold leading-snug text-ink">
                  {place.name}
                  {place.city && <span className="font-normal text-ink/70">, {place.city}</span>}
                </p>
                {place.note && <p className="mt-0.5 text-sm leading-relaxed text-ink/75">{place.note}</p>}
                {place.rating && (
                  <p className="mt-0.5 text-xs text-ink/70">
                    {copy.ratingLine
                      .replace("{score}", place.rating.score.toFixed(1).replace(".", copy.ratingDecimal))
                      .replace("{source}", place.rating.source)
                      .replace("{reviews}", place.rating.reviews !== null ? copy.ratingReviews.replace("{n}", String(place.rating.reviews)) : "")}
                  </p>
                )}
                <p className="mt-1 flex flex-wrap gap-x-4">
                  <a
                    href={mapsSearchUrl(place.name, place.city)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 items-center text-sm font-semibold text-accent-dark underline underline-offset-2"
                  >
                    {copy.mapLink}
                  </a>
                  {place.url && (
                    <a
                      href={place.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-11 items-center text-sm font-semibold text-accent-dark underline underline-offset-2"
                    >
                      {copy.siteLink}
                    </a>
                  )}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {full && idea.related && idea.related.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-accent">{copy.relatedHeading}</p>
          <ul role="list" className="flex flex-wrap gap-2">
            {idea.related.map((r) => (
              <li key={r.id} className="rounded-full border border-border bg-surface-active px-3.5 py-1.5 text-sm text-accent-dark">
                {r.label}
              </li>
            ))}
          </ul>
        </div>
      )}

      {full && idea.next_step && (
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-accent">{copy.nextHeading}</p>
          <p className="text-sm leading-relaxed text-ink/85">{idea.next_step}</p>
        </div>
      )}
    </div>
  );
}

export function IdeaMore({
  idea,
  copy,
  mode = "full",
  className,
}: {
  idea: IdeaBookEntry;
  copy: More;
  mode?: "full" | "shared";
  className?: string;
}) {
  // The shared preview only ever shows the sizes.
  const shows = mode === "shared" ? !!idea.sizes : hasMoreLayers(idea);
  if (!shows) return null;

  return (
    <section aria-label={copy.heading} className={cn("@container", className)}>
      {/* Computer (and the public preview): simply shown. */}
      <div className={cn(mode === "full" ? "hidden md:block" : "block")}>
        <Layers idea={idea} copy={copy} mode={mode} />
      </div>
      {/* Phone: behind a fold, collapsed to start with. */}
      {mode === "full" && (
        <details className="group md:hidden">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between rounded-md border border-border bg-surface-active px-4 text-[15px] font-semibold text-accent-dark [&::-webkit-details-marker]:hidden">
            {copy.heading}
            <span aria-hidden="true" className="text-lg transition-transform group-open:rotate-45">
              +
            </span>
          </summary>
          <div className="pt-4">
            <Layers idea={idea} copy={copy} mode={mode} />
          </div>
        </details>
      )}
    </section>
  );
}
