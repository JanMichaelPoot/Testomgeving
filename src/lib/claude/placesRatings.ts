// Google review scores for the places the research found (Jan, 14 Nov 2026: the options in a book must be the highly rated ones, and a web search
// shows Google stars too rarely: 1 of 14 ideas in the measurement). One Places API (New) "Text Search" per place, with the rating fields in the mask.
//
// What it costs, and how that is kept in hand:
//   - A request whose mask holds `rating` is billed as Text Search Enterprise: USD 35 per 1,000, the first 1,000 of a month free
//     (Google's price list, read 14 Nov 2026). That is USD 0.035 per place at list price.
//   - Nothing here can pass the free tier by accident: every lookup first takes a ticket from a monthly counter in the database
//     (migration 0025, `places_usage_take`), and the counter stops at GOOGLE_PLACES_FREE_PER_MONTH (default 900). Without the table, without
//     the key or past the limit there are simply no lookups and the book is made as before. Only GOOGLE_PLACES_ALLOW_PAID=1 lifts the limit.
//   - Few lookups: only physical places without a rating; the best option of an activity first, a second only when the first is not
//     good enough yet (a Google score of 4.3 or more from 15 reviews stops the search); at most GOOGLE_PLACES_MAX_PER_BOOK (default 8) a book.
//   - Each answer (a score, or the fact that there is none) is stored with the option in the research cache, so a place is looked up once a
//     month, not once a book.
// Only the place's name and town are sent: no personal data.

import { cleanRating, type Rating } from "@/lib/claude/rating";
import { isPhysicalOption, rankOptions, type LocalOption } from "@/lib/claude/localResearch";

/** Text Search Enterprise (the rating fields), per request, after the free tier. */
export const PLACES_LIST_PRICE_USD = 0.035;
/** The free requests per month of that SKU. */
export const PLACES_FREE_PER_MONTH = 1000;
const DEFAULT_FREE_LIMIT = 900;
const DEFAULT_MAX_PER_BOOK = 8;
/** A score at or above this from at least this many reviews ends the search for an activity. */
const GOOD_SCORE = 4.3;
const GOOD_REVIEWS = 15;
const ENDPOINT = "https://places.googleapis.com/v1/places:searchText";
const FIELD_MASK = "places.id,places.displayName,places.formattedAddress,places.businessStatus,places.rating,places.userRatingCount";
const TIMEOUT_MS = 6000;

export interface PlacesResult {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  businessStatus?: string;
  rating?: number;
  userRatingCount?: number;
}

const STOP_WORDS = new Set(["de", "het", "een", "van", "voor", "the", "and", "bv", "vof", "stichting", "vereniging", "club"]);
const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const tokens = (s: string) => norm(s).split(" ").filter((t) => t.length >= 3 && !STOP_WORDS.has(t));

/** The result that is the option itself: a name that contains or largely shares the option's name, in the option's town. */
export function matchPlace(option: Pick<LocalOption, "name" | "city">, results: readonly PlacesResult[]): PlacesResult | null {
  const wanted = norm(option.name);
  const wantedTokens = tokens(option.name);
  const city = norm(option.city);
  for (const r of results) {
    const found = norm(r.displayName?.text ?? "");
    if (!found) continue;
    if (city && !norm(r.formattedAddress ?? "").includes(city)) continue;
    if (found.includes(wanted) || wanted.includes(found)) return r;
    const foundTokens = new Set(tokens(r.displayName?.text ?? ""));
    if (wantedTokens.length === 0 || foundTokens.size === 0) continue;
    const shared = wantedTokens.filter((t) => foundTokens.has(t)).length;
    if (shared / Math.min(wantedTokens.length, foundTokens.size) >= 0.6) return r;
  }
  return null;
}

export type LookupOutcome = { status: "found"; rating: Rating | null } | { status: "closed" } | { status: "nomatch" } | { status: "error"; reason: string };

/** Reads the answer of a text search for one option. Exported for the tests. */
export function outcomeFrom(option: Pick<LocalOption, "name" | "city">, results: readonly PlacesResult[]): LookupOutcome {
  const hit = matchPlace(option, results);
  if (!hit) return { status: "nomatch" };
  if (hit.businessStatus === "CLOSED_PERMANENTLY") return { status: "closed" };
  const rating = typeof hit.rating === "number" ? cleanRating({ score: hit.rating, scale: 5, reviews: hit.userRatingCount, source: "Google" }) : null;
  return { status: "found", rating };
}

type Fetch = typeof fetch;
/** Takes `n` lookups from the month's allowance; resolves to how many were granted (0 when the limit is reached or the counter is not there). */
export type LookupCounter = (n: number) => Promise<number>;

export interface RatingHint {
  /** ISO country code of the place (default NL). */
  country?: string | null;
  locale?: "nl" | "en";
}

export interface RatingEnricher {
  /** The options of one activity with the Google score added where it was missing, a closed place removed and the rest ranked again. */
  enrich(options: LocalOption[], hint?: RatingHint): Promise<LocalOption[]>;
  readonly enabled: boolean;
  stats(): { lookups: number; rated: number; closed: number; limited: boolean };
  /** One log line for the cost meters, or "" when nothing was looked up. */
  summary(): string;
}

const goodEnough = (r: Rating | null | undefined) => !!r && r.score >= GOOD_SCORE && (r.reviews ?? 0) >= GOOD_REVIEWS;

/** The monthly counter in the database: the free tier cannot be passed through this. Not there (migration not run) means no lookups. */
export function monthlyCounter(limit: number, now: () => Date = () => new Date()): LookupCounter {
  let warned = false;
  return async (n) => {
    try {
      const { createServiceRoleClient } = await import("@/lib/supabase/server");
      const month = now().toISOString().slice(0, 7);
      const { data, error } = await createServiceRoleClient().rpc("places_usage_take", { p_month: month, p_n: n, p_limit: limit });
      if (error) throw new Error(error.message);
      return typeof data === "number" ? data : 0;
    } catch (err) {
      if (!warned) {
        warned = true;
        console.error("WindowInto: google places ratings are off: the monthly counter is not available (run migration 0025?)", err instanceof Error ? err.message : err);
      }
      return 0;
    }
  };
}

export function createRatingEnricher(
  deps: { apiKey?: string | null; counter?: LookupCounter; fetchImpl?: Fetch; maxPerBook?: number; allowPaid?: boolean } = {},
): RatingEnricher {
  const apiKey = (deps.apiKey === undefined ? process.env.GOOGLE_PLACES_API_KEY : deps.apiKey)?.trim() || "";
  const allowPaid = deps.allowPaid ?? process.env.GOOGLE_PLACES_ALLOW_PAID === "1";
  const envMax = Number(process.env.GOOGLE_PLACES_MAX_PER_BOOK);
  const maxPerBook = deps.maxPerBook ?? (Number.isFinite(envMax) && envMax >= 0 && process.env.GOOGLE_PLACES_MAX_PER_BOOK ? envMax : DEFAULT_MAX_PER_BOOK);
  const envLimit = Number(process.env.GOOGLE_PLACES_FREE_PER_MONTH);
  const limit = Number.isFinite(envLimit) && process.env.GOOGLE_PLACES_FREE_PER_MONTH ? envLimit : DEFAULT_FREE_LIMIT;
  const counter: LookupCounter = deps.counter ?? (allowPaid ? async (n) => n : monthlyCounter(limit));
  const doFetch = deps.fetchImpl ?? fetch;
  const enabled = apiKey.length > 0 && maxPerBook > 0;
  const state = { lookups: 0, rated: 0, closed: 0, limited: false };

  async function lookup(option: LocalOption, hint: RatingHint): Promise<LookupOutcome> {
    try {
      const res = await doFetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": FIELD_MASK },
        body: JSON.stringify({ textQuery: `${option.name} ${option.city}`, languageCode: hint.locale ?? "nl", regionCode: (hint.country ?? "NL").toUpperCase(), pageSize: 3 }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) return { status: "error", reason: `HTTP ${res.status}` };
      const body = (await res.json()) as { places?: PlacesResult[] };
      return outcomeFrom(option, body.places ?? []);
    } catch (err) {
      return { status: "error", reason: err instanceof Error ? err.message : String(err) };
    }
  }

  return {
    enabled,
    stats: () => ({ ...state }),
    summary: () =>
      state.lookups === 0
        ? ""
        : `WindowInto: google places ratings: ${state.lookups} lookups (list price $${(state.lookups * PLACES_LIST_PRICE_USD).toFixed(3)}, inside the free tier unless GOOGLE_PLACES_ALLOW_PAID is on), ${state.rated} ratings found, ${state.closed} closed dropped${state.limited ? ", stopped at the monthly limit" : ""}`,
    async enrich(options, hint = {}) {
      if (!enabled || options.length === 0) return options;
      let out = [...options];
      let looked = 0;
      for (let i = 0; i < out.length && looked < 2; ) {
        const option = out[i];
        // Already known (a score from the search, or looked up before, also when there was none): it counts, and a good one ends the search.
        if (option.rating || option.ratingChecked) {
          if (goodEnough(option.rating)) break;
          i++;
          continue;
        }
        if (!isPhysicalOption(option)) {
          i++;
          continue;
        }
        if (state.lookups >= maxPerBook) break;
        state.lookups++; // before the first await: the activities of a pass run side by side
        if ((await counter(1)) < 1) {
          state.lookups--;
          state.limited = true;
          break;
        }
        looked++;
        const outcome = await lookup(option, hint);
        if (outcome.status === "error") {
          console.warn(`WindowInto: google places lookup failed for ${option.name}: ${outcome.reason}`);
          i++;
          continue;
        }
        if (outcome.status === "closed") {
          state.closed++;
          out = out.filter((_, k) => k !== i);
          continue;
        }
        const next: LocalOption = { ...option, ratingChecked: true };
        if (outcome.status === "found" && outcome.rating) {
          next.rating = outcome.rating;
          state.rated++;
        }
        out[i] = next;
        if (goodEnough(next.rating)) break;
        i++;
      }
      return rankOptions(out);
    },
  };
}
