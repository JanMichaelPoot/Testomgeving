import Image from "next/image";
import { DIFFICULTY_LABELS, type IdeaBookEntry } from "@/lib/claude/ideaBookTypes";
import { mapsSearchUrl } from "@/lib/maps";
import { ideaHeroPhoto } from "@/lib/illustrations";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/language";
import type { Dictionary } from "@/lib/i18n/dictionaries";

// Renders one idea (or the wildcard) with the full Actionability Layer
// content — shared between /plan (the buyer's own page) and /shared/[id]
// (the public read-only preview), so both ever show the same information.
//
// `photoIndex` picks a header photo from a small fixed stock-photo pool
// (see IDEA_HERO_PHOTOS in lib/illustrations.ts) — Claude writes a fresh
// idea every time, so there's no way to fetch a photo that actually
// matches an arbitrary AI-generated idea. Cycling a small pool still gives
// every idea a photographic header, matching the WINDOW prototype's card
// style, without pretending the photo depicts that specific idea.
export function IdeaDetail({
  idea,
  index,
  photoIndex,
  locale,
  labels,
  dict,
  isWildcard = false,
}: {
  idea: IdeaBookEntry;
  index: number | null;
  photoIndex: number;
  locale: Locale;
  labels: Record<string, string>;
  dict: Dictionary["pdfChrome"];
  isWildcard?: boolean;
}) {
  const practicalLine = [
    idea.practical.estimated_cost,
    idea.practical.duration,
    DIFFICULTY_LABELS[locale][idea.practical.difficulty],
  ]
    .filter(Boolean)
    .join(" · ");
  const locationLine = idea.location
    ? [idea.location.name, idea.location.city].filter(Boolean).join(", ")
    : null;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-3xl bg-paper shadow-md",
        isWildcard ? "border-2 border-gold" : "border border-accent/10"
      )}
    >
      {/* Hero photo */}
      <div className="relative h-48 bg-accent-dark sm:h-56">
        <Image
          src={ideaHeroPhoto(photoIndex)}
          alt=""
          fill
          sizes="(min-width: 640px) 640px, 100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-accent-dark/80 via-accent-dark/10 to-transparent" />
        {isWildcard && (
          <span className="absolute right-4 top-4 rounded-full bg-gold px-3 py-1 text-xs font-medium text-white">
            ✦ {labels.wildcard_heading || dict.wildcardFallbackHeading}
          </span>
        )}
        <p className="absolute bottom-5 left-5 right-5 font-serif text-xl font-semibold leading-tight text-white sm:text-2xl">
          {index !== null ? `${index + 1}. ${idea.title}` : idea.title}
        </p>
      </div>

      <div className="space-y-5 p-6 sm:p-7">
        <p className="text-sm leading-relaxed text-ink/80">{idea.intro}</p>

        <div className="rounded-r-xl border-l-4 border-accent bg-accent/5 px-4 py-3.5">
          <p className="mb-1 text-xs font-medium uppercase tracking-widest text-accent-dark">
            {dict.whyItFitsFallback}
          </p>
          <p className="text-sm leading-relaxed text-ink">{idea.why_it_fits}</p>
        </div>

        {idea.details.length > 0 && (
          <div>
            <p className="mb-2.5 text-xs font-medium uppercase tracking-widest text-ink">
              {labels.steps_heading || dict.stepsFallback}
            </p>
            <ol className="space-y-2">
              {idea.details.map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-medium text-white">
                    {i + 1}
                  </span>
                  <span className="text-sm leading-relaxed text-ink/80">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {practicalLine && (
            <div className="rounded-xl bg-cream p-4">
              <p className="mb-1.5 text-xs font-medium uppercase tracking-widest text-ink/50">
                {labels.cost_label || dict.practicalFallback}
              </p>
              <p className="text-sm text-ink">{practicalLine}</p>
            </div>
          )}
          {idea.requirements.length > 0 && (
            <div className="rounded-xl bg-cream p-4">
              <p className="mb-1.5 text-xs font-medium uppercase tracking-widest text-ink/50">
                {labels.requirements_heading || dict.requirementsFallback}
              </p>
              <ul className="space-y-1">
                {idea.requirements.map((r, i) => (
                  <li key={i} className="flex gap-2 text-sm text-ink">
                    <span className="text-accent">·</span>
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {locationLine && idea.location && (
          <div className="flex flex-wrap items-center gap-2 text-sm text-ink/70">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 1.5C5.515 1.5 3.5 3.515 3.5 6c0 3.75 4.5 8.5 4.5 8.5S12.5 9.75 12.5 6c0-2.485-2.015-4.5-4.5-4.5zm0 6a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" fill="currentColor" className="text-accent" />
            </svg>
            <span>{locationLine}</span>
            <a
              href={mapsSearchUrl(idea.location.name, idea.location.city)}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-medium text-accent-dark underline underline-offset-2"
            >
              {dict.mapLinkLabel} →
            </a>
          </div>
        )}

        {idea.first_action && (
          <div
            className={cn(
              "rounded-2xl p-5",
              isWildcard ? "border border-gold/50 bg-gold/10" : "bg-accent-dark"
            )}
          >
            <p
              className={cn(
                "mb-1.5 text-xs font-medium uppercase tracking-widest",
                isWildcard ? "text-gold" : "text-gold"
              )}
            >
              ✦ {labels.first_action_heading || dict.firstActionFallback}
            </p>
            <p className={cn("text-sm leading-relaxed", isWildcard ? "text-ink" : "text-white/90")}>
              {idea.first_action}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
