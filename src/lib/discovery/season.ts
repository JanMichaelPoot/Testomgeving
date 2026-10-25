// Seasons: what can really be done on the day someone asks. Client-safe and pure (no JSON import).
//
// The Dutch calendar is what counts: the book is for people in the Netherlands, so "today" is read in
// Europe/Amsterdam, not in the server's own zone (a server near midnight UTC would otherwise be a day off).

export type Season = "winter" | "spring" | "summer" | "autumn";

const MONTH_OF: Record<string, number> = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };

/** The calendar month (1-12) of `now` in the Netherlands. */
export function currentMonth(now: Date = new Date()): number {
  const label = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "Europe/Amsterdam" }).format(now);
  return MONTH_OF[label] ?? now.getUTCMonth() + 1;
}

/** Meteorological seasons: they follow the weather, which is what outdoor activities depend on. */
export function seasonOf(month: number): Season {
  if (month === 12 || month <= 2) return "winter";
  if (month <= 5) return "spring";
  if (month <= 8) return "summer";
  return "autumn";
}

/** The date in the Netherlands as YYYY-MM-DD (for prompts and for comparing with dates in research). */
export function isoDateNL(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Europe/Amsterdam" }).format(now);
  return parts; // en-CA formats as YYYY-MM-DD
}

const SEASON_NAMES: Record<"nl" | "en", Record<Season, string>> = {
  nl: { winter: "winter", spring: "lente", summer: "zomer", autumn: "herfst" },
  en: { winter: "winter", spring: "spring", summer: "summer", autumn: "autumn" },
};

/** "25 oktober 2026 (herfst)" / "25 October 2026 (autumn)": the line a prompt gives so the model knows when it is. */
export function describeToday(now: Date, locale: "nl" | "en"): string {
  const date = new Intl.DateTimeFormat(locale === "nl" ? "nl-NL" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Amsterdam",
  }).format(now);
  return `${date} (${SEASON_NAMES[locale][seasonOf(currentMonth(now))]})`;
}

/**
 * Is the activity realistically available in this month? No `months` means all year (or no clear season).
 * A null month means "do not filter" (older callers and the tests that do not care about the season).
 */
export function inSeason(activity: { months?: readonly number[] }, month: number | null | undefined): boolean {
  if (month === null || month === undefined) return true;
  return !activity.months || activity.months.length === 0 || activity.months.includes(month);
}
