// A review score that a search result actually showed for a place. Server-free on purpose (no API client): it is
// stored in the book and drawn in the browser. Never estimated: without a named source it is not a rating.

export interface Rating {
  /** Normalised to a 0-5 scale, one decimal. */
  score: number;
  /** How many reviews stand behind it, when the source says. */
  reviews: number | null;
  /** Where it was read: "Google", "Tripadvisor", ... Required: a score without a source is not accepted. */
  source: string;
}

/** A rating counts only with a score, a scale of 5 or 10 and a named source; it is normalised to 0-5. Anything else is null. */
export function cleanRating(raw: unknown): Rating | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const score = typeof r.score === "number" ? r.score : Number.NaN;
  const scale = typeof r.scale === "number" ? r.scale : 5;
  const source = typeof r.source === "string" ? r.source.trim().slice(0, 30) : "";
  if (!Number.isFinite(score) || (scale !== 5 && scale !== 10) || !source) return null;
  const score5 = Math.round((score / scale) * 5 * 10) / 10;
  if (score5 < 1 || score5 > 5) return null;
  const reviews = typeof r.reviews === "number" && Number.isInteger(r.reviews) && r.reviews >= 0 ? r.reviews : null;
  return { score: score5, reviews, source };
}

/** An already normalised rating (score on the 0-5 scale), as stored in a cache or a book. */
export function storedRating(raw: unknown): Rating | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  return cleanRating({ score: r.score, scale: 5, reviews: r.reviews, source: r.source });
}
