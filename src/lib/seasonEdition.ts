// A seasonal edition (improvement brief B5, "prepare for later"): a book written for a season instead of for the month it was asked in, for
// instance a winter edition sent in the autumn. Nothing uses it yet: with the flag off (the default) the season is ignored everywhere and a
// book is written for the current month as always. The follow-up link (src/app/nieuw-venster) can carry `?season=winter`, and the pipeline
// (src/lib/claude/generateFromSeeds.ts) takes `season` as an option; this file is the one place that knows what a season is.

export const SEASONS = ["spring", "summer", "autumn", "winter"] as const;
export type Season = (typeof SEASONS)[number];

/** Months (1-12) of each season, meteorological, in the Northern Hemisphere (the product is for the Netherlands). */
const SEASON_MONTHS: Record<Season, readonly number[]> = {
  spring: [3, 4, 5],
  summer: [6, 7, 8],
  autumn: [9, 10, 11],
  winter: [12, 1, 2],
};

export function parseSeason(value: unknown): Season | null {
  return typeof value === "string" && (SEASONS as readonly string[]).includes(value) ? (value as Season) : null;
}

/** On when SEASONAL_EDITION is 1, true, yes or on. */
export function seasonalEditionEnabled(raw: string | undefined = process.env.SEASONAL_EDITION): boolean {
  return /^(1|true|yes|on)$/i.test((raw ?? "").trim().replace(/^["']|["']$/g, ""));
}

export function seasonOfMonth(month: number): Season {
  return SEASONS.find((s) => SEASON_MONTHS[s].includes(month)) ?? "spring";
}

/**
 * The month a book for `season` is written for: the current month when it is already in that season, otherwise the middle of the season
 * (so a winter edition in October plans for January, not for the first cold week of December). `month` is 1-12.
 */
export function editionMonth(season: Season, month: number): number {
  const months = SEASON_MONTHS[season];
  return months.includes(month) ? month : months[1];
}

/**
 * The date a book for `season` is written for: today when it already is that season, otherwise the 15th of the middle month of the next one (the
 * year after, when that month has already passed this year). Noon UTC, so it is the same day in the Netherlands.
 */
export function editionDate(season: Season, now: Date): Date {
  const current = now.getUTCMonth() + 1;
  const target = editionMonth(season, current);
  if (target === current) return now;
  const year = now.getUTCFullYear() + (target < current ? 1 : 0);
  return new Date(Date.UTC(year, target - 1, 15, 12));
}
