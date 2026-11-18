import { KIND_LABELS, MODE_LABELS, kindOfActivity, modeOfActivity } from "@/lib/discovery/activityKind";
import { getActivity } from "@/lib/discovery/library";
import { themeShortLabel } from "@/lib/discovery/associations";
import type { Seed } from "@/lib/discovery/engine/types";
import type { Locale } from "@/lib/locale";
import type { RelatedActivity } from "@/lib/claude/ideaLayers";

// R1 (docs/plan-activiteitenselectie.md): an idea of the book heads an option of three. The idea is worked out in full; its two companions
// are one short line each: what kind of thing it is, what it costs, how long it takes and how it can be done (by yourself, through a provider,
// or after organising). Everything here comes from facts the library already has, by code: no model call, nothing invented.

/** The cost and duration classes of the library in words (cost 0 free .. 3 over 50 euro; duration 1 under an hour .. 4 multi-day or ongoing). */
export interface OptionCopy {
  costs: [string, string, string, string];
  durations: [string, string, string, string];
  /** "In this direction: {themes}", the heading over the option when its direction is one or two chosen themes. */
  direction: string;
  /** Joins two theme names ("natuur + ambacht en handwerk"). */
  and: string;
}

/** The direction of an option as words ("natuur + ambacht en handwerk"), or null when the idea fits none of the chosen themes. */
export function directionLabel(themes: readonly string[], locale: Locale, copy: Pick<OptionCopy, "and">): string | null {
  if (themes.length === 0) return null;
  return themes.map((t) => themeShortLabel(t, locale)).join(copy.and);
}

/** One companion as the book shows it: its name and its short facts line. Null for an activity the library does not know. */
export function companionLine(activityId: string, locale: Locale, copy: OptionCopy): RelatedActivity | null {
  const a = getActivity(activityId);
  if (!a) return null;
  const parts = [
    KIND_LABELS[kindOfActivity(a)][locale],
    a.cost === null ? null : copy.costs[a.cost],
    a.duration === null ? null : copy.durations[a.duration - 1],
    MODE_LABELS[modeOfActivity(a)][locale].toLowerCase(),
  ].filter((p): p is string => !!p);
  return { id: a.id, label: a.label[locale], facts: parts.join(" · ") };
}

/** The companions of a seed's option, in order. Empty when the seed carries none (an older engine result). */
export function companionsOf(seed: Seed, locale: Locale, copy: OptionCopy): RelatedActivity[] {
  return (seed.option?.companions ?? []).map((id) => companionLine(id, locale, copy)).filter((c): c is RelatedActivity => !!c);
}
