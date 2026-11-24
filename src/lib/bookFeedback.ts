// The buyer's rating of a finished book (Step 241): the pure rules, shared by the form, the server action and the admin page. Browser-safe.

export const COMMENT_MAX = 600;

/** A rating of this or higher is "enthusiastic": the buyer is then asked to pass the book on and may leave a sentence to show on the site. */
export const ENTHUSIASTIC_FROM = 4;

export interface BookFeedbackInput {
  rating: number;
  /** undefined = leave what is stored as it is (a plain tap on a score); a string, also an empty one, replaces it. */
  comment?: string;
  /** undefined = leave it as it is. */
  quoteConsent?: boolean;
}

export interface CleanBookFeedback {
  rating: number;
  /** undefined = do not touch the stored sentence. */
  comment?: string | null;
  /** undefined = do not touch the stored consent. */
  quoteConsent?: boolean;
}

export const isEnthusiastic = (rating: number | null | undefined): boolean => typeof rating === "number" && rating >= ENTHUSIASTIC_FROM;

/**
 * Cleaned input, or null when it is not a rating at all. Rules that keep consent honest: it can only be given with a rating of 4 or 5 and a sentence to show; a lower rating
 * (or a cleared sentence) always withdraws it, even when the caller did not mention it.
 */
export function cleanBookFeedback(input: Partial<BookFeedbackInput> | null | undefined): CleanBookFeedback | null {
  const rating = input?.rating;
  if (!Number.isInteger(rating) || (rating as number) < 1 || (rating as number) > 5) return null;
  const r = rating as number;
  const out: CleanBookFeedback = { rating: r };
  if (typeof input?.comment === "string") {
    const text = input.comment.trim().slice(0, COMMENT_MAX);
    out.comment = text === "" ? null : text;
  }
  if (!isEnthusiastic(r) || out.comment === null) out.quoteConsent = false;
  else if (input?.quoteConsent !== undefined) out.quoteConsent = input.quoteConsent === true && typeof out.comment === "string";
  return out;
}

export interface BookFeedbackRow {
  rating: number;
  comment: string | null;
  quote_consent: boolean;
  locale: string | null;
  created_at: string;
}

export interface BookFeedbackSummary {
  n: number;
  mean: number | null;
  /** Counts of the ratings 1..5. */
  distribution: [number, number, number, number, number];
  /** Share of 4s and 5s, null without answers. */
  enthusiastic: number | null;
  /** Rows with a sentence, newest first. */
  comments: { text: string; rating: number; consent: boolean; locale: string | null; at: string }[];
}

export function summarizeBookFeedback(rows: readonly BookFeedbackRow[]): BookFeedbackSummary {
  const distribution: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  let sum = 0;
  let n = 0;
  for (const r of rows) {
    if (!Number.isInteger(r.rating) || r.rating < 1 || r.rating > 5) continue;
    distribution[r.rating - 1]++;
    sum += r.rating;
    n++;
  }
  const comments = rows
    .filter((r) => typeof r.comment === "string" && r.comment.trim() !== "")
    .map((r) => ({ text: r.comment as string, rating: r.rating, consent: r.quote_consent === true && isEnthusiastic(r.rating), locale: r.locale, at: r.created_at }))
    .sort((a, b) => b.at.localeCompare(a.at));
  return {
    n,
    mean: n === 0 ? null : sum / n,
    distribution,
    enthusiastic: n === 0 ? null : (distribution[3] + distribution[4]) / n,
    comments,
  };
}
