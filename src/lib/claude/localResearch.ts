import { countryName } from "@/lib/countries";
import { radiusText, sanitizeDistanceKm } from "@/lib/distanceOptions";
import type Anthropic from "@anthropic-ai/sdk";
import { anthropic } from "@/lib/anthropic";
import { getActivity } from "@/lib/discovery/library";
import { hintLine } from "@/lib/discovery/searchHints";
import { describeToday, isoDateNL } from "@/lib/discovery/season";
import { cleanRating, type Rating } from "@/lib/claude/rating";
import type { RatingEnricher } from "@/lib/claude/placesRatings";
import type { CostLedger } from "@/lib/claude/costLedger";
import { verifyOptionUrls } from "@/lib/claude/verifyUrls";
import { filterRelevant, relevantOptions } from "@/lib/claude/optionRelevance";

export type { Rating };
import type { Locale } from "@/lib/locale";

// Local research for the seeds of an Idea Book: for each chosen activity, real and
// currently operating places where a beginner can take part near the person.
//
// How it stays cheap (measured in docs/discovery-api-costs.md):
//   1. GROUPED: every activity that still needs an answer goes into ONE call, not one
//      call per activity. The model combines searches where one query covers several
//      activities ("creatieve workshops Utrecht").
//   2. SHARED CACHE: an answer per (activity, place) is stored and reused for the next
//      person, so popular activity/place combinations get cheaper as orders grow.
//   3. A SMALLER MODEL: notes-taking from search results does not need the writing
//      model; Haiku gave briefs of the same kind at about half the price.
// It fails soft: if research or the cache breaks, the book is still written, with
// generic (certainly real) ways in instead of named places.

export interface LocalOption {
  name: string;
  city: string;
  url: string | null;
  note: string;
  /** The last day it can be done (a dated event, a season that ends), YYYY-MM-DD; null = ongoing or not stated. */
  until: string | null;
  /** A review score that a search result actually showed, with its source; null when none was found. Never estimated. */
  rating: Rating | null;
  /** What the place really is, in a few words ("café op de hei", "keramiekstudio met proeflessen"); null when the research did not say (older cached answers). The idea's title follows this. */
  kind?: string | null;
  /** True once the Google score of this place was looked up (src/lib/claude/placesRatings.ts), also when there is none: it is not looked up again. */
  ratingChecked?: boolean;
  /** "exact": it is the form the activity's usual way in names (a high tea in a country house); "close": the same activity in another form (a café on the heath). Absent when not stated. */
  match?: "exact" | "close" | null;
}

/** The most options kept per activity. The model may return one more, so the best rated can be chosen. */
export const MAX_OPTIONS = 3;
const MAX_CANDIDATES = 6;
// A venue with few reviews should not beat a well-known one on a single 5.0: the score is pulled towards this
// prior (4.0, worth 20 reviews) before options are compared. An unknown review count counts as 3.
const PRIOR_SCORE = 4.0;
const PRIOR_WEIGHT = 20;
/**
 * Rated below this (after the pull) an option is only kept when nothing better exists. Jan (31 Oct 2026): the options shown must be
 * the highly rated ones, so the bar is 4.0, the same as the prior: an option the reviews put under it gives way to one above it.
 */
const POOR_SCORE = 4.0;

export function adjustedScore(r: Rating): number {
  const n = r.reviews ?? 3;
  return (r.score * n + PRIOR_SCORE * PRIOR_WEIGHT) / (n + PRIOR_WEIGHT);
}

/**
 * The options worth showing: the form the idea names first (match "exact"), then best rated first (see adjustedScore), the unrated
 * after them in the order given, a poorly rated one only when it is all there is. At most MAX_OPTIONS. Deterministic, and stable when applied twice.
 */
export function rankOptions(options: LocalOption[]): LocalOption[] {
  const rated = options.filter((o) => o.rating).sort((a, b) => adjustedScore(b.rating!) - adjustedScore(a.rating!));
  const unrated = options.filter((o) => !o.rating);
  const bestRated = rated[0] ? adjustedScore(rated[0].rating!) : 0;
  const keptRated = bestRated >= POOR_SCORE ? rated.filter((o) => adjustedScore(o.rating!) >= POOR_SCORE) : rated;
  // The form the idea names comes before the rating (an idea written about a country house should name one when it exists); the sort is
  // stable, so within a form the better rated one stays first.
  const formRank = (o: LocalOption) => (o.match === "close" ? 1 : 0);
  return [...keptRated, ...unrated].sort((a, b) => formRank(a) - formRank(b)).slice(0, MAX_OPTIONS);
}

/** "standard": the first search. "broad": the second attempt, for activities the first one found nothing for. */
export type ResearchPass = "standard" | "broad";

export interface SeedResearch {
  activityId: string;
  options: LocalOption[];
  /** Where the answer came from; "none" = nothing could be researched (soft failure). */
  source: "cache" | "search" | "none";
}

export interface ResearchStats {
  cached: number;
  searched: number;
  failed: number;
  /** Options thrown away because their website does not exist or their date has passed. */
  dropped: number;
  ms: number;
}

// --- place keys ------------------------------------------------------------------------

/** "Gemeente Utrecht" -> "utrecht"; the visitor's radius decides how wide the search is. */
export function placeKey(location: string, searchDistance: string, searchDistanceKm?: number): string {
  const place = (location ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[,(]/)[0]
    .replace(/^(gemeente|provincie|stad)\s+/, "")
    .replace(/[^a-z0-9' -]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  // A distance in kilometres (the slider) is exact: every step is its own cache key, and more than 100 km is the whole country.
  const km = sanitizeDistanceKm(searchDistanceKm);
  if (km !== undefined) return km > 100 ? "nl|nl" : `${place || "nl"}|${km}km`;
  const radius = searchDistance === "hour" ? "region" : searchDistance === "anywhere" ? "nl" : "city";
  if (radius === "nl") return "nl|nl";
  return `${place || "nl"}|${radius}`;
}

/** The radius part of a place key ("city", "region", "nl" or "25km") as a sentence for the prompt. */
function radiusLine(radius: string): string {
  const m = /^([0-9]+)km$/.exec(radius);
  if (m) return radiusText("city", Number(m[1]));
  return radiusText(radius === "region" ? "region" : radius === "nl" ? "nl" : "city");
}

// --- cache ---------------------------------------------------------------------------------

/**
 * Found options are trusted for 30 days; "nothing verifiable" is remembered for 14 (it was 7: an empty answer is mostly a search that was too thin, but
 * every repeat costs a whole round, and what earlier empties found is kept for the supply index anyway, see supplyIndex.ts).
 */
export const FOUND_TTL_DAYS = 30;
export const EMPTY_TTL_DAYS = 14;

/**
 * The version of what a cached answer MEANS. Bump it only when old answers would be wrong for the new question (v4 asked for physical places
 * only, v5 let a group count without a dated session, v6 reads reviews on purpose); never for a change of wording that asks the same question,
 * because every bump makes every stored answer useless (890 rows over 19 places were lost to the bumps from v2 to v6).
 */
export const RESEARCH_CACHE_EPOCH = "v6";

/** The slider's steps, in kilometres: the radii a cached answer can have (distanceOptions.ts), "city" and "region" being the older classes of 15 and 75. */
const RADIUS_STEPS_KM = [5, 10, 15, 25, 50, 75, 100] as const;
const LEGACY_CLASS_KM: Record<string, number> = { city: 15, region: 75 };

/**
 * The cache keys of one research request: its own, and the same question asked for other radii (`narrower`: a smaller radius, `wider`: a larger one).
 * What a cached answer says holds across radii in one direction each: options found within 15 km are real options for someone who searches within 25
 * (a smaller set, but valid), and "nothing within 50 km" is true for someone who searches within 25. The other directions say nothing (nothing within 5 km
 * does not mean nothing within 25; a venue found at 50 km may be too far for 5), so they are never read.
 */
export function radiusKeys(key: string): { narrower: string[]; wider: string[] } | null {
  const parts = key.split("|");
  const radius = parts[1];
  const km = /^(\d+)km$/.exec(radius ?? "") ? Number(/^(\d+)km$/.exec(radius)![1]) : LEGACY_CLASS_KM[radius ?? ""];
  if (km === undefined || parts[0] === "nl" || parts[0].startsWith("online")) return null;
  const withRadius = (r: number) => [parts[0], `${r}km`, ...parts.slice(2)].join("|");
  // A request in the older classes ("city" = 15 km) shares its answers with the same radius in kilometres.
  const same = radius in LEGACY_CLASS_KM ? [withRadius(km)] : [];
  return {
    narrower: [...same, ...RADIUS_STEPS_KM.filter((r) => r < km).map(withRadius)],
    wider: [...same, ...RADIUS_STEPS_KM.filter((r) => r > km).map(withRadius)],
  };
}

/** When a cached answer stops being trusted: the TTL, or earlier when an option states the day it ends. */
export function expiryMs(options: LocalOption[], now: number, emptyTtlDays: number = EMPTY_TTL_DAYS): number {
  const ttl = now + (options.length > 0 ? FOUND_TTL_DAYS : emptyTtlDays) * 86400000;
  const ends = options.map((o) => (o.until ? Date.parse(`${o.until}T23:59:59+01:00`) : NaN)).filter((t) => Number.isFinite(t));
  return ends.length ? Math.max(now, Math.min(ttl, ...ends)) : ttl;
}

export interface ResearchCache {
  get(activityIds: string[], place: string, locale: Locale): Promise<Map<string, LocalOption[]>>;
  put(entries: { activityId: string; options: LocalOption[]; emptyTtlDays?: number }[], place: string, locale: Locale): Promise<void>;
  /**
   * The unexpired answers of several keys at once (the same question at other radii, see radiusKeys), per activity with the key each came from. Optional: a
   * cache without it simply has no radius reuse.
   */
  getAcross?(activityIds: string[], keys: string[], locale: Locale): Promise<Map<string, { key: string; options: LocalOption[] }[]>>;
}

/** An empty answer for something the person chose themselves is only remembered briefly: it deserves another try soon. */
export const PICK_EMPTY_TTL_DAYS = 2;

let cacheWarned = false;

/** The shared cache in Supabase (migration 0014). If the table is missing it just does not cache. */
export function createSupabaseResearchCache(): ResearchCache {
  const warn = (what: string, message: string) => {
    if (cacheWarned) return;
    cacheWarned = true;
    console.warn(`WINDOW: research cache ${what} failed (${message}); continuing without the cache. Has migration 0014 been run?`);
  };
  return {
    async get(activityIds, place, locale) {
      const out = new Map<string, LocalOption[]>();
      if (activityIds.length === 0) return out;
      try {
        const { createServiceRoleClient } = await import("@/lib/supabase/server");
        const { data, error } = await createServiceRoleClient()
          .from("local_research_cache")
          .select("activity_id, options")
          .in("activity_id", activityIds)
          .eq("place_key", place)
          .eq("locale", locale)
          .gt("expires_at", new Date().toISOString());
        if (error) throw new Error(error.message);
        for (const row of data ?? []) out.set(row.activity_id, cleanOptions(row.options));
      } catch (err) {
        warn("read", err instanceof Error ? err.message : String(err));
      }
      return out;
    },
    async getAcross(activityIds, keys, locale) {
      const out = new Map<string, { key: string; options: LocalOption[] }[]>();
      if (activityIds.length === 0 || keys.length === 0) return out;
      try {
        const { createServiceRoleClient } = await import("@/lib/supabase/server");
        const { data, error } = await createServiceRoleClient()
          .from("local_research_cache")
          .select("activity_id, place_key, options")
          .in("activity_id", activityIds)
          .in("place_key", keys)
          .eq("locale", locale)
          .gt("expires_at", new Date().toISOString());
        if (error) throw new Error(error.message);
        for (const row of data ?? []) out.set(row.activity_id, [...(out.get(row.activity_id) ?? []), { key: row.place_key, options: cleanOptions(row.options) }]);
      } catch (err) {
        warn("read", err instanceof Error ? err.message : String(err));
      }
      return out;
    },
    async put(entries, place, locale) {
      if (entries.length === 0) return;
      try {
        const { createServiceRoleClient } = await import("@/lib/supabase/server");
        const now = Date.now();
        const rows = entries.map((e) => ({
          activity_id: e.activityId,
          place_key: place,
          locale,
          options: e.options as unknown[],
          searched_at: new Date(now).toISOString(),
          expires_at: new Date(expiryMs(e.options, now, e.emptyTtlDays)).toISOString(),
        }));
        const { error } = await createServiceRoleClient()
          .from("local_research_cache")
          .upsert(rows, { onConflict: "activity_id,place_key,locale" });
        if (error) throw new Error(error.message);
      } catch (err) {
        warn("write", err instanceof Error ? err.message : String(err));
      }
    },
  };
}

// --- the research call -------------------------------------------------------------------

/** Notes-taking from search results; a smaller model is enough (see docs/discovery-api-costs.md). */
export const RESEARCH_MODEL = process.env.WINDOW_RESEARCH_MODEL || "claude-haiku-4-5-20251001";
// The Google score of a place is looked up afterwards by the app (placesRatings.ts), so the model needs no extra searches to read reviews.
const MAX_SEARCHES = 5;
const MAX_PRIORITY_SEARCHES = 4;
// The broad pass reads a lot back (35-55k tokens per round, measured): four searches at most.
const MAX_BROAD_SEARCHES = 4;

const SYSTEM = `You are a meticulous local-options researcher for WindowInto, a possibility-discovery app.
Your only job is to use web search to find REAL, CURRENTLY OPERATING businesses, venues, clubs, routes, event
series or platforms where a beginner can take part in the activities you are given. Always verify with a search
and never rely on memory or a plausible-sounding guess. Never invent a name or a URL. An empty answer is a good
answer: "nothing verifiable in or near this place" is correct and expected whenever the search does not clearly
show a venue that exists and is open now; a wrong venue in a paid book is far worse than none. You finish with
exactly one JSON code block and nothing after it.`;

/** Practical wishes of the person that change which venue is a good one (the engine only flags them; it has no data to filter on). */
export type ResearchNeed = "evening" | "transport" | "accessibility" | "children" | "young_children" | "calm_pace" | "no_alcohol" | "quiet" | "meet_people" | "no_dutch";
const NEED_BY_FLAG: Record<string, ResearchNeed> = { evening: "evening", transport: "transport", accessibility: "accessibility", children: "children", young_children: "young_children", calm_pace: "calm_pace", no_alcohol: "no_alcohol", quiet: "quiet", meet_people: "meet_people", no_dutch: "no_dutch" };

/** The research-relevant wishes among the engine's `verify` flags, in a fixed order (they are part of the cache key). */
export function researchNeedsFrom(verify: readonly string[]): ResearchNeed[] {
  const found = new Set(verify.map((v) => NEED_BY_FLAG[v]).filter((n): n is ResearchNeed => !!n));
  return (["evening", "transport", "accessibility", "children", "young_children", "calm_pace", "no_alcohol", "quiet", "meet_people", "no_dutch"] as const).filter((n) => found.has(n));
}

const NEED_TEXT: Record<ResearchNeed, string> = {
  evening: "wants to go in the evening: prefer an option that actually runs in the evening (the source shows evening times or sessions) and sits somewhere busy and well lit, such as a venue in a town centre or on a main street, not a remote spot",
  transport: "has no car: prefer an option that is easy to reach by public transport or on foot or by bike from the place above; say so in the note when the source shows the station or stop",
  accessibility: "needs step-free access: prefer an option whose source says it is accessible; leave out one that the source says is not",
  children: "goes with children: prefer an option where children are welcome; leave out one that is for adults only",
  young_children: "goes with young children (toddlers and pre-schoolers): prefer an option that welcomes them, with a minimum age they meet, short sessions and room to move; leave out one with an age limit above theirs",
  calm_pace: "wants a calm pace: prefer an option without a rush, a crowd or a performance; leave out one that is fast, loud or competitive",
  no_alcohol: "does not want alcohol: prefer an option where drinking is not the point; leave out a bar, tasting or brewery",
  quiet: "wants quiet and predictable: prefer a small, structured option with a fixed programme and little noise; leave out a loud, crowded or improvised one",
  no_dutch: "does not speak Dutch: prefer an option that works in English or without much language (the source says English, international or expat, or it is a physical activity); leave out one that is only in Dutch",
  meet_people: "wants to meet new people: prefer an option where newcomers are welcome and people talk to each other (an open evening, a course, a regular group); leave out one you can only do alone or with people you already know",
};

/** One paragraph for the research prompt, or an empty string when there is nothing to say. */
export function needsBlock(needs: readonly ResearchNeed[]): string {
  if (needs.length === 0) return "";
  return `
The person ${needs.map((n) => `(${n}) ${NEED_TEXT[n]}`).join("; ")}. This decides which options to keep when several qualify, and an option that clearly does not meet it
is left out. It never lets you list something that fails the rules below (it must exist and be open now), and never write a claim the source does not show.
`;
}

export function buildResearchPrompt(
  activityIds: string[],
  location: string,
  radius: string,
  locale: Locale,
  now: Date = new Date(),
  priority = false,
  needs: readonly ResearchNeed[] = [],
  /** The country when it is not the Netherlands (English name): the places are searched there, in its own language. */
  country: string | null = null,
  /** "broad": the second attempt for activities the first search found nothing for (clubs, community centres, adult education, libraries, repair cafes ...). */
  pass: ResearchPass = "standard",
): string {
  const language = locale === "nl" ? "Dutch" : "English";
  const searchLanguage = country ? "the local language of the country (and in English)" : "Dutch";
  const countryName = country ?? "the Netherlands";
  // Activities the person chose themselves: search each one separately and accept a little more distance and evidence for
  // permanent places. Everything else (the rules of the next paragraphs: exists, open now, really offers it) stays as strict.
  const priorityBlock = priority
    ? `
These activities were chosen by the person themselves, so try harder than usual. Search every activity on its own, in ${searchLanguage}
(for example "<activity> ${location || countryName}", "<activity> beginners class ${location || countryName}", "<activity> near me"). If the place
itself has nothing, an option ${/^[0-9]+km$/.test(radius) ? "inside the search radius" : "within about 25 km"} counts: write its real city, never the place you searched. A permanent place
(museum, estate, garden, shop, market hall) counts when its own website, or a source from the last 24 months, shows that it exists
and is open. Classes, events and seasonal offers keep the stricter rules below.
`
    : "";
  const evidenceWindow = priority ? "the last 12 months (24 for a permanent place)" : "the last 12 months";
  const lines = activityIds.map((id, i) => {
    const a = getActivity(id);
    const entry = a?.entry ? ` Usual way in: ${a.entry.en}.` : "";
    return `${i + 1}. id "${id}": ${a?.label.nl ?? id} (${a?.label.en ?? id}).${entry}${hintLine(id)}`;
  });
  const broadBlock =
    pass === "broad"
      ? `
SECOND ATTEMPT: a first search found nothing for these activities, so search more widely for WHO really offers or organises them: clubs and associations (and their club finders or member lists), community centres and neighbourhood workshops, adult-education courses, libraries, repair cafes, nature, heritage and sports associations (for example IVN, Natuurmonumenten, a sports federation's club finder), municipal activity calendars, museums and visitor centres, farms and animal parks. Use the search terms given per activity and also the broader name of the activity. A group that meets regularly counts even when its website is simple. The radius above may be wide: look in and around the place itself first, widen only as far as needed, and list the nearest options first.
`
      : "";
  return `Today is ${describeToday(now, "en")} (${isoDateNL(now)}). Place: ${location || countryName}. Search radius: ${radiusLine(radius).replace("the Netherlands", countryName)}.
Write the notes in ${language}: if the website is in another language, translate what you take from it (keep names, streets and titles as they are). A note in the wrong language is an error.

For each activity below, find up to 4 real, currently operating options where a beginner can actually take part
there, preferring a low-threshold way in (trial class, beginner evening, open day, drop-in). Combine searches
where one query can cover several activities (for example "creative workshops ${location || countryName}").
If nothing can be verified for an activity, give an empty options list instead of guessing.

Only PHYSICAL places count here: a workshop, studio, atelier, school, club or association that gives trial classes, an organised outing or event, a
play or activity venue, a farm, an animal park or a nature site: somewhere a person walks into or travels to. An online course, a video lesson, an app, a
webshop or starter kit, a streaming platform, a national organisation without a local address or a home-delivery service does NOT count, however good it is.
Write the venue's own city (the real town where it is, taken from its address on the website); never "Online" and never just the country. Search for
${country ? "the local equivalents of " : ""}workshops, studios, classes, clubs, organised outings and play venues rather than for products.
${broadBlock}${priorityBlock}${needsBlock(needs)}
It must be possible to take part now or soon. An option does NOT count when it is closed for the season, has stopped running, or is an
event whose date has already passed. Two kinds of option:
- A permanent place or group (a club, association, studio, school, workshop, manege, repair cafe, museum, garden, venue): it counts when its own
  website, or a source from the last 12 months, shows that it exists and is operating now and says how a newcomer joins or visits (a trial lesson,
  an open evening, drop-in, opening hours, enrolling). It does NOT need a dated session in the next four weeks: when the next start is not shown,
  say in the note that the person should ask for the next start.
- A dated event, a course with a fixed start or a seasonal offer (open-water swimming, outdoor pools, boat rental, ice rinks, markets, festivals,
  garden and farm days): it only counts when the source shows a date in the next four weeks, or that it is running in this season.
When the source gives a date or an end date, put the last day in "until" (YYYY-MM-DD); otherwise "until" is null.

An option only counts when ALL of these are true:
- It is in or near the place above (the same city or region${priority ? ", up to about 25 km for the person's own choices" : ""}). Never offer a venue in another city or country as a
  substitute, and never write a city that the source does not show for that venue.
- Its own official website, or a source from ${evidenceWindow}, shows that it exists and is operating now. A venue
  that is closed, permanently closed, relocated, "coming soon", bankrupt or only remembered in old articles or
  reviews does not count. A listing that merely says such a venue exists in a country or region does not count.
- It really offers this activity to beginners, not something merely similar.
If no option meets all three, the options list for that activity is empty. Do not fill it up.
Every option is listed under the activity it is about. Never put an option under an activity it does not offer, and never list the same provider under several activities
unless it really offers each of them: an option found for one activity is not a substitute for another, and an empty list is the right answer when nothing fits.

How to search (this decides how good the options are):
- Search the way a local looks for it, in ${searchLanguage}, and combine related activities in one query where that works. Good queries: "<activity> <place>",
  "<activity> proefles <place>", "<activity> cursus <place> beoordelingen", "beste <activity> <place>", "<activity> <place> reviews". Put "reviews" or "beoordelingen"
  in the first query so the results show review scores (Google Maps and Tripadvisor snippets, the venue's own page).
- Take the exact name and the town from the result itself. A listing page of many venues is a lead, not an option: open or search the venue it names.
- Prefer venues that people rate highly: the review snippets in the results (Google, Tripadvisor) show which. Do not spend searches on reading scores: the Google score of
  each place is looked up afterwards, so give a score only when a result happens to show one.
- Match the form first. The "Usual way in" of an activity names the form people expect (a high tea in a country house or garden room, a class in a studio). Look inside the
  radius for options of that form first, and widen within the radius before you accept a different form. Only then list the nearest thing that really exists, and say
  plainly in "kind" what it is. Never describe an option as more than it is: a café on the heath is not a country house.

Ratings: when a search result shows a review score for an option (Google, Tripadvisor, the venue's own page, ...), give it as
"rating": {"score": 4.6, "scale": 5, "reviews": 312, "source": "Google"} (scale 5 or 10; "reviews" null when not stated).
Never estimate or remember a score: "rating" is null when the results do not show one. When more than 3 options qualify,
keep the 3 with the highest ratings (more reviews counts for more), and never pick a poorly rated option over a better one.
"kind" is what the place really is in a few words, in ${language} (for example "café op de hei", "keramiekstudio met proeflessen"); "match" is "exact" when it is the form of the
usual way in and "close" when it is the same activity in another form.

Activities:
${lines.join("\n")}

Rules: only list options that appear in your search results. Give the website exactly as it appeared, or null.
The note is one short line: what it is, how a beginner takes part (trial lesson, open evening, drop-in, booking), and prices or times only when the source states them. Prefer the option's own website over a listing or directory page.

Finish with one JSON code block, exactly this shape:
\`\`\`json
[{"activity_id": "<id>", "options": [{"name": "...", "city": "...", "kind": "...", "match": "exact", "url": "https://..." , "note": "...", "until": null, "rating": {"score": 4.6, "scale": 5, "reviews": 312, "source": "Google"}}]}]
\`\`\``;
}

/**
 * The second chance for an idea with no option near the person (Jan, 31 Oct 2026: every idea needs a concrete, real option): providers
 * that serve anyone in the Netherlands from a website: an online course or class, a shop with a starter kit, a national club or
 * association with a website, an app or platform. Same honesty rules as the local pass: it must exist, be operating now and really
 * offer the activity to beginners; a rating only when a search result showed it; the best rated first.
 */
export function buildOnlinePrompt(activityIds: string[], location: string, locale: Locale, now: Date = new Date(), country: string | null = null): string {
  const language = locale === "nl" ? "Dutch" : "English";
  const countryName = country ?? "the Netherlands";
  const lines = activityIds.map((id, i) => {
    const a = getActivity(id);
    return `${i + 1}. id "${id}": ${a?.label.nl ?? id} (${a?.label.en ?? id}).`;
  });
  return `Today is ${describeToday(now, "en")} (${isoDateNL(now)}). The person lives near ${location || countryName}.
Nothing was found NEAR them for the activities below. For each one, find up to 3 real, currently operating options that someone in
${countryName} can use from home or by post/delivery, or that a national organisation offers through a website: an online course or
class, a shop or webshop with a beginner kit, a national club or association (with local chapters) with a website, an app or a platform.
Write the notes in ${language} (translate what you take from a website; keep names as they are).

An option only counts when ALL of these are true:
- Its own official website, or a source from the last 12 months, shows that it exists and is operating now (not closed, parked, "coming soon").
- It really offers this activity to beginners, or the material to start it, not something merely similar.
- It can actually be used by someone in ${countryName} (it ships to, or runs for, people there).
If the activity cannot sensibly be done or started online or by post (it needs a venue, a licence or an instructor on site), or nothing
verifiable exists, give an empty options list. An empty answer is a good answer; never invent a name or URL.
Every option is listed under the activity it is about. Never put an option under an activity it does not offer, and never list the same provider under several activities
unless it really offers each of them: an option found for one activity is not a substitute for another, so when nothing fits an activity its list is empty.

Ratings: when a search result shows a review score (Trustpilot, Google, the shop's own page, an app store, ...), give it as
"rating": {"score": 4.6, "scale": 5, "reviews": 312, "source": "Trustpilot"} (scale 5 or 10; "reviews" null when not stated). Never estimate or
remember a score: "rating" is null when the results show none. When more than 3 qualify, keep the 3 with the highest ratings (more reviews counts for more). Put "reviews" or "beoordelingen"
in a query so the results show scores, and aim for 4.3 or more from at least 15 reviews; below 4.0 only when nothing better exists.
Write "Online" as the city for something that is used from home, "${country ?? "Nederland"}" for a national organisation, or the real city of a local chapter.

Activities:
${lines.join("\n")}

Give the website exactly as it appeared. The note is one short line: what it is and, only when the source states them, prices.
Finish with one JSON code block, exactly this shape:
\`\`\`json
[{"activity_id": "<id>", "options": [{"name": "...", "city": "Online", "url": "https://...", "note": "...", "until": null, "rating": {"score": 4.6, "scale": 5, "reviews": 312, "source": "Trustpilot"}}]}]
\`\`\``;
}

/** Options from the model or the cache; with `today` (YYYY-MM-DD) the ones whose last day has passed are left out. */
export function cleanOptions(raw: unknown, today?: string): LocalOption[] {
  if (!Array.isArray(raw)) return [];
  const out: LocalOption[] = [];
  for (const o of raw) {
    if (!o || typeof o !== "object") continue;
    const r = o as Record<string, unknown>;
    const name = typeof r.name === "string" ? r.name.trim() : "";
    if (!name) continue;
    const url = typeof r.url === "string" && /^https?:\/\//i.test(r.url.trim()) ? r.url.trim() : null;
    const until = typeof r.until === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.until.trim()) ? r.until.trim() : null;
    if (today && until && until < today) continue;
    out.push({
      name,
      city: typeof r.city === "string" ? r.city.trim() : "",
      url,
      note: typeof r.note === "string" ? r.note.trim() : "",
      until,
      rating: cleanRating(r.rating),
      ...(r.ratingChecked === true ? { ratingChecked: true } : {}),
      kind: typeof r.kind === "string" && r.kind.trim() ? r.kind.trim().slice(0, 70) : null,
      match: r.match === "exact" || r.match === "close" ? r.match : null,
    });
    if (out.length === MAX_CANDIDATES) break;
  }
  return rankOptions(out);
}

/**
 * Whether an option is a place to go to: it has a real city (not "Online", not just the country) and is not by its name an online course, an app or a webshop.
 * The prompt asks for it; this is the check behind the prompt, because a model sometimes lists a good online provider anyway.
 */
export function isPhysicalOption(o: Pick<LocalOption, "name" | "city">): boolean {
  const city = o.city.trim();
  if (!city) return false;
  if (/^(online|webshop|web|internet|landelijk|nationaal|national|nederland|the netherlands|netherlands|belgi[eë]|belgium|schweiz|switzerland|zwitserland|deutschland|germany|duitsland|france|frankrijk)$/i.test(city)) return false;
  if (/\b(webshop|online (cursus|course|class|les)|e-?learning|video ?(les|lessen|course)|app store)\b/i.test(o.name)) return false;
  return true;
}

/** Reads the model's JSON answer; anything malformed yields null (the caller treats it as "no research"). */
export function parseResearchAnswer(text: string, wanted: string[], today?: string): Map<string, LocalOption[]> | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced ?? text.slice(text.indexOf("["), text.lastIndexOf("]") + 1);
  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;
  const out = new Map<string, LocalOption[]>();
  for (const row of parsed) {
    if (!row || typeof row !== "object") continue;
    const r = row as { activity_id?: unknown; options?: unknown };
    if (typeof r.activity_id === "string" && wanted.includes(r.activity_id)) out.set(r.activity_id, cleanOptions(r.options, today));
  }
  // An activity the model skipped counts as "searched, nothing verifiable".
  for (const id of wanted) if (!out.has(id)) out.set(id, []);
  return out;
}

async function searchOnce(
  activityIds: string[],
  location: string,
  radius: string,
  locale: Locale,
  now: Date = new Date(),
  priority = false,
  needs: readonly ResearchNeed[] = [],
  country: string | null = null,
  countryCode: string | null = null,
  pass: ResearchPass = "standard",
  ledger?: CostLedger,
): Promise<Map<string, LocalOption[]> | null> {
  const startedAt = Date.now();
  // The person's own choices get about one and a half searches each (measured: 6 searches for 3 choices cost ~$0.14, mostly the
  // search results read back in); the rest of the book shares a few.
  // The second attempt has more room: the first one already failed on these.
  const maxUses =
    pass === "broad"
      ? Math.min(MAX_BROAD_SEARCHES, Math.max(3, activityIds.length * 2))
      : priority
        ? Math.min(MAX_PRIORITY_SEARCHES, Math.max(3, Math.ceil(activityIds.length * 1.5)))
        : Math.min(MAX_SEARCHES, Math.max(2, Math.ceil(activityIds.length * 0.7)));
  const message = await anthropic.messages.create({
    model: RESEARCH_MODEL,
    max_tokens: 3500,
    system: SYSTEM,
    messages: [{ role: "user", content: buildResearchPrompt(activityIds, location, radius, locale, now, priority, needs, country, pass) }],
    tools: [
      {
        type: "web_search_20250305",
        name: "web_search",
        max_uses: maxUses,
        // No country here: the person may be anywhere, and a forced "NL" would pull a search for Madrid towards the Netherlands.
        ...(radius === "nl" ? {} : { user_location: { type: "approximate", city: location || null, ...(countryCode ? { country: countryCode } : {}) } }),
      } as Anthropic.Messages.WebSearchTool20250305,
    ],
  });
  ledger?.add(pass === "broad" ? "broad" : priority ? "own" : "standard", message.usage, RESEARCH_MODEL);
  const searches = message.content.filter((b) => b.type === "server_tool_use" && b.name === "web_search").length;
  console.log(
    `WindowInto: research pass${pass === "broad" ? " (broad)" : ""}${priority ? " (own choices)" : ""} took ${Date.now() - startedAt}ms, ${searches} web searches for ${activityIds.length} activities (${RESEARCH_MODEL}), ` +
      `usage=${JSON.stringify(message.usage)}`,
  );
  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  return parseResearchAnswer(text, activityIds, isoDateNL(now));
}

/** The online/national second pass (see buildOnlinePrompt). Same tool, same parsing, a smaller budget of searches. */
async function searchOnlineOnce(
  activityIds: string[],
  location: string,
  _radius: string,
  locale: Locale,
  now: Date = new Date(),
  // The online search shares the signature of searchOnce (researchSeeds calls either one the same way); these two do not apply to it.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _priority = false,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _needs: readonly ResearchNeed[] = [],
  country: string | null = null,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _countryCode: string | null = null,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _pass: ResearchPass = "standard",
  ledger?: CostLedger,
): Promise<Map<string, LocalOption[]> | null> {
  const startedAt = Date.now();
  const message = await anthropic.messages.create({
    model: RESEARCH_MODEL,
    max_tokens: 3000,
    system: SYSTEM,
    messages: [{ role: "user", content: buildOnlinePrompt(activityIds, location, locale, now, country) }],
    tools: [
      {
        type: "web_search_20250305",
        name: "web_search",
        max_uses: Math.min(4, Math.max(2, activityIds.length)),
      } as Anthropic.Messages.WebSearchTool20250305,
    ],
  });
  ledger?.add("online", message.usage, RESEARCH_MODEL);
  const searches = message.content.filter((b) => b.type === "server_tool_use" && b.name === "web_search").length;
  console.log(`WINDOW: online research pass took ${Date.now() - startedAt}ms, ${searches} web searches for ${activityIds.length} activities (${RESEARCH_MODEL}), usage=${JSON.stringify(message.usage)}`);
  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  return parseResearchAnswer(text, activityIds, isoDateNL(now));
}

/**
 * Real local options for the given activities near this person. Cached answers are used
 * as they are; everything else is researched together in one call and stored.
 */
export async function researchSeeds(opts: {
  activityIds: string[];
  location: string;
  searchDistance: string;
  /** The distance slider's kilometres (src/lib/distanceOptions.ts); when given it decides the radius, not the three-way class. */
  searchDistanceKm?: number;
  locale: Locale;
  cache?: ResearchCache | null;
  /** For tests: replaces the model call. */
  search?: typeof searchOnce;
  /** For tests: replaces the website check; `false` skips it. */
  verify?: typeof verifyOptionUrls | false;
  /** For tests: the moment "now" is. */
  now?: Date;
  /** Answers already in hand (from an earlier pass of this same book): used as they are, never searched again. */
  known?: ReadonlyMap<string, SeedResearch>;
  /**
   * Activities the person chose themselves. They are searched in their own, wider call (about two searches each, a little more distance,
   * permanent places accepted on older evidence), and an empty answer for them is cached for days, not a week. An earlier empty
   * answer from the shared cache is not trusted for them: it came from a call that had to share its few searches with the whole book.
   */
  priorityIds?: readonly string[];
  /**
   * "online": the second chance for ideas with nothing near the person (providers that serve anyone in the Netherlands from a website).
   * Its answers are cached under their own key (the place hardly matters, but the month does).
   */
  mode?: "online";
  /** "broad": the second attempt for what the standard pass found nothing for (its answers are cached under their own key). */
  pass?: ResearchPass;
  /** The country of the place (ISO code) when it is not the Netherlands: it changes where is searched, so it is part of every cache key. */
  country?: string | null;
  /** Practical wishes (researchNeedsFrom): evening, no car, step-free, with children. They change which options are kept, so they are part of the cache key. */
  needs?: readonly ResearchNeed[];
  /** The book's cost ledger: every search call of this research is recorded in it (src/lib/claude/costLedger.ts). */
  ledger?: CostLedger;
  /** Adds the Google score to the places found (and to cached places that never had one); one enricher serves a whole book, so its cap holds for the book. */
  ratings?: RatingEnricher;
}): Promise<{ byActivity: Map<string, SeedResearch>; stats: ResearchStats }> {
  const startedAt = Date.now();
  const { activityIds, location, searchDistance, locale } = opts;
  const now = opts.now ?? new Date();
  const today = isoDateNL(now);
  const foreign = opts.country && opts.country.toUpperCase() !== "NL" ? opts.country.toUpperCase() : null;
  const countryEn = foreign ? countryName(foreign, "en") : null;
  const countryTag = foreign ? `${foreign.toLowerCase()}:` : "";
  const place = countryTag + placeKey(location, searchDistance, opts.searchDistanceKm);
  const radius = place.split("|")[1] ?? "city";
  // The cache has no month in its key any more (Stap 195): what is open or running in June says nothing about December, but the time limit of a row
  // (30 days for found options, earlier when an option states its last day) already says so, and a month in the key made every answer useless on the 1st.
  // RESEARCH_CACHE_EPOCH: the notes are in the book's language (v2), carry ratings (v3), are physical places only (v4), count a group without a dated
  // session (v5), read reviews on purpose and say what each place is (v6). Bump it only when old answers would be wrong, never for a rewording.
  const online = opts.mode === "online";
  const needs = online ? [] : researchNeedsFrom(opts.needs ?? []);
  const pass: ResearchPass = !online && opts.pass === "broad" ? "broad" : "standard";
  const cacheKey = `${online ? `online${foreign ? `:${foreign.toLowerCase()}` : ""}` : place}|${RESEARCH_CACHE_EPOCH}${online ? "|online" : ""}${pass === "broad" ? "|broad" : ""}${needs.length ? `|n:${needs.join("+")}` : ""}`;
  const cache = opts.cache === undefined ? createSupabaseResearchCache() : opts.cache;
  const byActivity = new Map<string, SeedResearch>();

  const priority = new Set(opts.priorityIds ?? []);
  // The person's own choices are cached under their own key: the shared key may hold an empty answer from a call that was too thin.
  const ownKey = `${cacheKey}|own`;

  const toLookUp = activityIds.filter((id) => !opts.known?.has(id));
  const cached = cache ? await cache.get(toLookUp, cacheKey, locale) : new Map<string, LocalOption[]>();
  // Physical places only (the online pass, when it is asked for at all, is the one exception).
  const physical = (list: LocalOption[]) => (online ? list : list.filter(isPhysicalOption));
  // And only what is about the activity it is stored for (optionRelevance.ts): an answer cached before that check existed may hold another activity's options.
  const about = (id: string, list: LocalOption[]) => relevantOptions(list, id, { online });
  for (const [id, stored] of cached) {
    const options = about(id, physical(cleanOptions(stored, today)));
    // Everything that was stored has run out since: that is a new question, not an answer.
    if (options.length === 0 && stored.length > 0) continue;
    // An empty shared answer does not settle a choice of the person's own: that one is searched with its own, wider call.
    if (options.length === 0 && priority.has(id)) continue;
    byActivity.set(id, { activityId: id, options, source: "cache" });
  }
  const ownFrom = new Set<string>(); // the activities whose cached answer came from the person's own key
  const ownToLookUp = toLookUp.filter((id) => priority.has(id) && !byActivity.has(id));
  if (cache && ownToLookUp.length > 0) {
    for (const [id, stored] of await cache.get(ownToLookUp, ownKey, locale)) {
      const options = about(id, physical(cleanOptions(stored, today)));
      if (options.length === 0 && stored.length > 0) continue;
      byActivity.set(id, { activityId: id, options, source: "cache" });
      ownFrom.add(id);
    }
  }

  // The same question asked for another radius (radiusKeys): options found within a smaller radius are real options for this one, and "nothing within a
  // wider radius" is a real empty answer. Used as they are and not stored under this key, so a borrowed answer never gets a new time limit.
  const borrowed = new Set<string>();
  const nearKeys = online ? null : radiusKeys(cacheKey);
  if (cache?.getAcross && nearKeys) {
    const open = toLookUp.filter((id) => !byActivity.has(id) && !priority.has(id));
    if (open.length > 0) {
      const rows = await cache.getAcross(open, [...nearKeys.narrower, ...nearKeys.wider], locale);
      const kmOf = (key: string) => Number(/\|(\d+)km\|/.exec(key)?.[1] ?? 0);
      const narrower = new Set(nearKeys.narrower);
      const wider = new Set(nearKeys.wider);
      for (const id of open) {
        const list = rows.get(id) ?? [];
        // The nearest smaller radius that found something comes first (it is the closest to what this person asked for).
        const found = list
          .filter((r) => narrower.has(r.key))
          .sort((a, b) => kmOf(b.key) - kmOf(a.key))
          .map((r) => about(id, physical(cleanOptions(r.options, today))))
          .find((o) => o.length > 0);
        if (found) {
          byActivity.set(id, { activityId: id, options: found, source: "cache" });
          borrowed.add(id);
        } else if (list.some((r) => wider.has(r.key) && r.options.length === 0)) {
          byActivity.set(id, { activityId: id, options: [], source: "cache" });
          borrowed.add(id);
        }
      }
    }
  }

  // Cached places that never had a Google score get one now (once: the answer, also "none", is stored with the option).
  if (opts.ratings?.enabled && !online && cache) {
    const upgraded: { activityId: string; options: LocalOption[]; key: string }[] = [];
    await Promise.all(
      [...byActivity.entries()]
        .filter(([id, r]) => r.source === "cache" && !borrowed.has(id) && r.options.some((x) => !x.rating && !x.ratingChecked))
        .map(async ([id, r]) => {
          const options = await opts.ratings!.enrich(r.options, { country: foreign ?? "NL", locale });
          if (JSON.stringify(options) === JSON.stringify(r.options)) return;
          byActivity.set(id, { ...r, options });
          upgraded.push({ activityId: id, options, key: priority.has(id) && ownFrom.has(id) ? ownKey : cacheKey });
        }),
    );
    for (const key of new Set(upgraded.map((u) => u.key))) await cache.put(upgraded.filter((u) => u.key === key).map(({ activityId, options }) => ({ activityId, options })), key, locale);
  }

  for (const [id, r] of opts.known ?? []) if (activityIds.includes(id) && !byActivity.has(id)) byActivity.set(id, r);
  const missing = activityIds.filter((id) => !byActivity.has(id));
  let failed = 0;
  let dropped = 0;
  // Does what was found exist? Websites that do not answer at all are thrown away before anything is stored.
  // In production the page itself is read too (closed for good, parked domain, wrong business); see verifyUrls.ts.
  const checker = opts.verify === false ? null : (opts.verify ?? ((o: LocalOption[]) => verifyOptionUrls(o, undefined, undefined, { content: true })));

  // One call for the book's own choices and one for the rest, side by side (so the wait does not grow); a failure of one leaves the other alone.
  const batch = async (ids: string[], own: boolean) => {
    if (ids.length === 0) return;
    try {
      const found = await (opts.search ?? (online ? searchOnlineOnce : searchOnce))(ids, location, radius, locale, now, own, needs, countryEn, foreign, pass, opts.ledger);
      if (!found) throw new Error("the research answer could not be read");
      // Is each option about the activity it was given for? One call answers for several activities and the model sometimes files a provider under the wrong one
      // (the make-up courses under "design a board game", 14 Nov 2026). The same option under two activities stays with the one it fits best.
      const answer = filterRelevant(new Map(ids.map((id) => [id, physical(found.get(id) ?? [])] as const)), { online });
      for (const d of answer.dropped) console.warn(`WindowInto: research option refused (${d.reason}): "${d.option.name}" is not about ${d.activityId}`);
      dropped += answer.dropped.length;
      await Promise.all(
        ids.map(async (id) => {
          let options = answer.kept.get(id) ?? [];
          if (checker && options.length > 0) {
            const result = await checker(options);
            dropped += result.dropped.length;
            for (const d of result.dropped) console.warn(`WINDOW: research option dropped (${d.reason}): ${d.option.name} ${d.option.url ?? ""}`);
            options = result.kept;
          }
          // The Google score of the places found, before they are stored, so the cache holds it and a place is looked up once.
          if (opts.ratings && !online && options.length > 0) options = await opts.ratings.enrich(options, { country: foreign ?? "NL", locale });
          byActivity.set(id, { activityId: id, options, source: "search" });
        }),
      );
      await cache?.put(
        ids.map((id) => ({ activityId: id, options: byActivity.get(id)?.options ?? [], ...(own || online ? { emptyTtlDays: PICK_EMPTY_TTL_DAYS } : {}) })),
        own ? ownKey : cacheKey,
        locale,
      );
    } catch (err) {
      failed += ids.length;
      console.error("WINDOW: local research failed, continuing without it", err instanceof Error ? err.message : err);
      for (const id of ids) byActivity.set(id, { activityId: id, options: [], source: "none" });
    }
  };
  await Promise.all([batch(missing.filter((id) => priority.has(id)), true), batch(missing.filter((id) => !priority.has(id)), false)]);

  const stats: ResearchStats = { cached: activityIds.length - missing.length, searched: missing.length - failed, failed, dropped, ms: Date.now() - startedAt };
  console.log(`WINDOW: local research: ${stats.cached} cached, ${stats.searched} searched, ${stats.failed} failed (${place})`);
  return { byActivity, stats };
}
