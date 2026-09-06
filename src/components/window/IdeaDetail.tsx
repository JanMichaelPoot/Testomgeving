import { DIFFICULTY_LABELS, type IdeaBookEntry } from "@/lib/claude/generateIdeaBook";
import { mapsSearchUrl } from "@/lib/maps";
import type { Locale } from "@/lib/language";
import type { Dictionary } from "@/lib/i18n/dictionaries";

// Renders one idea (or the wildcard) with the full Actionability Layer
// content — shared between /plan (the buyer's own page) and /shared/[id]
// (the public read-only preview), so both ever show the same information.
export function IdeaDetail({
  idea,
  index,
  locale,
  labels,
  dict,
}: {
  idea: IdeaBookEntry;
  index: number | null;
  locale: Locale;
  labels: Record<string, string>;
  dict: Dictionary["pdfChrome"];
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
    <div>
      <p className="font-serif text-xl text-ink">
        {index !== null ? `${index + 1}. ${idea.title}` : idea.title}
      </p>
      <p className="mt-1 text-ink/70">{idea.intro}</p>
      <p className="mt-2 text-sm text-ink/80">{idea.why_it_fits}</p>

      {idea.details.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium uppercase tracking-widest text-accent-dark">
            {labels.steps_heading || dict.stepsFallback}
          </p>
          <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm text-ink/80">
            {idea.details.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-ink/60">
        {practicalLine && (
          <span>
            <strong className="font-medium text-ink/80">
              {labels.cost_label || dict.practicalFallback}:
            </strong>{" "}
            {practicalLine}
          </span>
        )}
        {locationLine && idea.location && (
          <span>
            <strong className="font-medium text-ink/80">
              {labels.location_heading || dict.locationFallback}:
            </strong>{" "}
            {locationLine}{" "}
            <a
              href={mapsSearchUrl(idea.location.name, idea.location.city)}
              target="_blank"
              rel="noreferrer"
              className="text-accent-dark underline"
            >
              ({dict.mapLinkLabel})
            </a>
          </span>
        )}
        {idea.requirements.length > 0 && (
          <span>
            <strong className="font-medium text-ink/80">
              {labels.requirements_heading || dict.requirementsFallback}:
            </strong>{" "}
            {idea.requirements.join(", ")}
          </span>
        )}
      </div>

      {idea.first_action && (
        <div className="mt-3 rounded-xl bg-accent/5 px-4 py-3 text-sm">
          <p className="font-medium text-accent-dark">
            {labels.first_action_heading || dict.firstActionFallback}
          </p>
          <p className="mt-0.5 text-ink/80">{idea.first_action}</p>
        </div>
      )}
    </div>
  );
}
