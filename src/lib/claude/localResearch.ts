import type Anthropic from "@anthropic-ai/sdk";
import { anthropic } from "@/lib/anthropic";
import { getActivity } from "@/lib/discovery/library";
import { describeToday, isoDateNL } from "@/lib/discovery/season";
import { cleanRating, type Rating } from "@/lib/claude/rating";
import { verifyOptionUrls } from "@/lib/claude/verifyUrls";

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
}

/** The most options kept per activity. The model may return one more, so the best rated can be chosen. */
export const MAX_OPTIONS = 3;
const MAX_CANDIDATES = 6;
// A venue with few reviews should not beat a well-known one on a single 5.0: the score is pulled towards this
// prior (4.0, worth 20 reviews) before options are compared. An unknown review count counts as 3.
const PRIOR_SCORE = 4.0;
const PRIOR_WEIGHT = 20;
/** Rated this low (after the pull) an option is only kept when nothing better exists. */
const POOR_SCORE = 3.5;

export function adjustedScore(r: Rating): number {
  const n = r.reviews ?? 3;
  return (r.score * n + PRIOR_SCORE * PRIOR_WEIGHT) / (n + PRIOR_WEIGHT);
}

/**
 * The options worth showing: best rated first (see adjustedScore), the unrated after them in the order given, a poorly
 * rated one only when it is all there is. At most MAX_OPTIONS. Deterministic, and stable when applied twice.
 */
export function rankOptions(options: LocalOption[]): LocalOption[] {
  const rated = options.filter((o) => o.rating).sort((a, b) => adjustedScore(b.rating!) - adjustedScore(a.rating!));
  const unrated = options.filter((o) => !o.rating);
  const bestRated = rated[0] ? adjustedScore(rated[0].rating!) : 0;
  const keptRated = bestRated >= POOR_SCORE ? rated.filter((o) => adjustedScore(o.rating!) >= POOR_SCORE) : rated;
  return [...keptRated, ...unrated].slice(0, MAX_OPTIONS);
}

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
export function placeKey(location: string, searchDistance: string): string {
  const place = (location ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[,(]/)[0]
    .replace(/^(gemeente|provincie|stad)\s+/, "")
    .replace(/[^a-z0-9' -]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const radius = searchDistance === "hour" ? "region" : searchDistance === "anywhere" ? "nl" : "city";
  if (radius === "nl") return "nl|nl";
  return `${place || "nl"}|${radius}`;
}

const RADIUS_TEXT: Record<string, string> = {
  city: "in the city itself and its immediate surroundings",
  region: "within roughly an hour's travel of the place",
  nl: "anywhere in the Netherlands (including online options)",
};

// --- cache ---------------------------------------------------------------------------------

/** Found options are trusted for 30 days; "nothing verifiable" is remembered for 7. */
export const FOUND_TTL_DAYS = 30;
export const EMPTY_TTL_DAYS = 7;

/** When a cached answer stops being trusted: the TTL, or earlier when an option states the day it ends. */
export function expiryMs(options: LocalOption[], now: number, emptyTtlDays: number = EMPTY_TTL_DAYS): number {
  const ttl = now + (options.length > 0 ? FOUND_TTL_DAYS : emptyTtlDays) * 86400000;
  const ends = options.map((o) => (o.until ? Date.parse(`${o.until}T23:59:59+01:00`) : NaN)).filter((t) => Number.isFinite(t));
  return ends.length ? Math.max(now, Math.min(ttl, ...ends)) : ttl;
}

export interface ResearchCache {
  get(activityIds: string[], place: string, locale: Locale): Promise<Map<string, LocalOption[]>>;
  put(entries: { activityId: string; options: LocalOption[]; emptyTtlDays?: number }[], place: string, locale: Locale): Promise<void>;
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
const MAX_SEARCHES = 5;
const MAX_PRIORITY_SEARCHES = 4;

const SYSTEM = `You are a meticulous local-options researcher for WINDOW, a possibility-discovery app.
Your only job is to use web search to find REAL, CURRENTLY OPERATING businesses, venues, clubs, routes, event
series or platforms where a beginner can take part in the activities you are given. Always verify with a search
and never rely on memory or a plausible-sounding guess. Never invent a name or a URL. An empty answer is a good
answer: "nothing verifiable in or near this place" is correct and expected whenever the search does not clearly
show a venue that exists and is open now; a wrong venue in a paid book is far worse than none. You finish with
exactly one JSON code block and nothing after it.`;

export function buildResearchPrompt(
  activityIds: string[],
  location: string,
  radius: string,
  locale: Locale,
  now: Date = new Date(),
  priority = false,
): string {
  const language = locale === "nl" ? "Dutch" : "English";
  // Activities the person chose themselves: search each one separately and accept a little more distance and evidence for
  // permanent places. Everything else (the rules of the next paragraphs: exists, open now, really offers it) stays as strict.
  const priorityBlock = priority
    ? `
These activities were chosen by the person themselves, so try harder than usual. Search every activity on its own, in Dutch
(for example "<activity> ${location || "Nederland"}", "<activity> proefles ${location || "Nederland"}", "<activity> in de buurt"). If the place
itself has nothing, an option within about 25 km counts: write its real city, never the place you searched. A permanent place
(museum, estate, garden, shop, market hall) counts when its own website, or a source from the last 24 months, shows that it exists
and is open. Classes, events and seasonal offers keep the stricter rules below.
`
    : "";
  const evidenceWindow = priority ? "the last 12 months (24 for a permanent place)" : "the last 12 months";
  const lines = activityIds.map((id, i) => {
    const a = getActivity(id);
    const entry = a?.entry ? ` Usual way in: ${a.entry.en}.` : "";
    return `${i + 1}. id "${id}": ${a?.label.nl ?? id} (${a?.label.en ?? id}).${entry}`;
  });
  return `Today is ${describeToday(now, "en")} (${isoDateNL(now)}). Place: ${location || "the Netherlands"}. Search radius: ${RADIUS_TEXT[radius] ?? RADIUS_TEXT.city}.
Write the notes in ${language}: if the website is in another language, translate what you take from it (keep names, streets and titles as they are). A note in the wrong language is an error.

For each activity below, find up to 4 real, currently operating options where a beginner can actually take part
there, preferring a low-threshold way in (trial class, beginner evening, open day, drop-in). Combine searches
where one query can cover several activities (for example "creatieve workshops ${location || "Nederland"}").
If nothing can be verified for an activity, give an empty options list instead of guessing.
${priorityBlock}
It must be possible to take part within the next four weeks from today. So an option does NOT count when it is
closed for the season, has stopped running, or is an event whose date has already passed. Seasonal offers (open-
water swimming, outdoor pools, boat rental, ice rinks, markets, festivals, garden and farm days) only count when
the source shows they are running in this season. When the source gives a date or an end date, put the last day
in "until" (YYYY-MM-DD); otherwise "until" is null.

An option only counts when ALL of these are true:
- It is in or near the place above (the same city or region${priority ? ", up to about 25 km for the person's own choices" : ""}). Never offer a venue in another city or country as a
  substitute, and never write a city that the source does not show for that venue.
- Its own official website, or a source from ${evidenceWindow}, shows that it exists and is operating now. A venue
  that is closed, permanently closed, relocated, "coming soon", bankrupt or only remembered in old articles or
  reviews does not count. A listing that merely says such a venue exists in a country or region does not count.
- It really offers this activity to beginners, not something merely similar.
If no option meets all three, the options list for that activity is empty. Do not fill it up.

Ratings: when a search result shows a review score for an option (Google, Tripadvisor, the venue's own page, ...), give it as
"rating": {"score": 4.6, "scale": 5, "reviews": 312, "source": "Google"} (scale 5 or 10; "reviews" null when not stated).
Never estimate or remember a score: "rating" is null when the results do not show one. When more than 3 options qualify,
keep the 3 with the highest ratings (more reviews counts for more), and never pick a poorly rated option over a better one.

Activities:
${lines.join("\n")}

Rules: only list options that appear in your search results. Give the website exactly as it appeared, or null.
The note is one short line: what it is, and prices or times only when the source states them. Prefer the option's own website over a listing or directory page.

Finish with one JSON code block, exactly this shape:
\`\`\`json
[{"activity_id": "<id>", "options": [{"name": "...", "city": "...", "url": "https://..." , "note": "...", "until": null, "rating": {"score": 4.6, "scale": 5, "reviews": 312, "source": "Google"}}]}]
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
    });
    if (out.length === MAX_CANDIDATES) break;
  }
  return rankOptions(out);
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
): Promise<Map<string, LocalOption[]> | null> {
  const startedAt = Date.now();
  // The person's own choices get about one and a half searches each (measured: 6 searches for 3 choices cost ~$0.14, mostly the
  // search results read back in); the rest of the book shares a few.
  const maxUses = priority
    ? Math.min(MAX_PRIORITY_SEARCHES, Math.max(3, Math.ceil(activityIds.length * 1.5)))
    : Math.min(MAX_SEARCHES, Math.max(2, Math.ceil(activityIds.length * 0.7)));
  const message = await anthropic.messages.create({
    model: RESEARCH_MODEL,
    max_tokens: 3500,
    system: SYSTEM,
    messages: [{ role: "user", content: buildResearchPrompt(activityIds, location, radius, locale, now, priority) }],
    tools: [
      {
        type: "web_search_20250305",
        name: "web_search",
        max_uses: maxUses,
        // No country here: the person may be anywhere, and a forced "NL" would pull a search for Madrid towards the Netherlands.
        ...(radius === "nl" ? {} : { user_location: { type: "approximate", city: location || null } }),
      } as Anthropic.Messages.WebSearchTool20250305,
    ],
  });
  const searches = message.content.filter((b) => b.type === "server_tool_use" && b.name === "web_search").length;
  console.log(
    `WINDOW: research pass${priority ? " (own choices)" : ""} took ${Date.now() - startedAt}ms, ${searches} web searches for ${activityIds.length} activities (${RESEARCH_MODEL}), ` +
      `usage=${JSON.stringify(message.usage)}`,
  );
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
}): Promise<{ byActivity: Map<string, SeedResearch>; stats: ResearchStats }> {
  const startedAt = Date.now();
  const { activityIds, location, searchDistance, locale } = opts;
  const now = opts.now ?? new Date();
  const today = isoDateNL(now);
  const place = placeKey(location, searchDistance);
  const radius = place.split("|")[1] ?? "city";
  // The cache is kept per month: what is open or running in June says nothing about December.
  // "v2": the notes are now always in the book's language; older cached notes could be in the language of the website.
  // "v3": options now carry ratings and passed the stricter "is it really open" rules; older answers are not trusted.
  const cacheKey = `${place}|${today.slice(0, 7)}|v3`;
  const cache = opts.cache === undefined ? createSupabaseResearchCache() : opts.cache;
  const byActivity = new Map<string, SeedResearch>();

  const priority = new Set(opts.priorityIds ?? []);
  // The person's own choices are cached under their own key: the shared key may hold an empty answer from a call that was too thin.
  const ownKey = `${cacheKey}|own`;

  const toLookUp = activityIds.filter((id) => !opts.known?.has(id));
  const cached = cache ? await cache.get(toLookUp, cacheKey, locale) : new Map<string, LocalOption[]>();
  for (const [id, stored] of cached) {
    const options = cleanOptions(stored, today);
    // Everything that was stored has run out since: that is a new question, not an answer.
    if (options.length === 0 && stored.length > 0) continue;
    // An empty shared answer does not settle a choice of the person's own: that one is searched with its own, wider call.
    if (options.length === 0 && priority.has(id)) continue;
    byActivity.set(id, { activityId: id, options, source: "cache" });
  }
  const ownToLookUp = toLookUp.filter((id) => priority.has(id) && !byActivity.has(id));
  if (cache && ownToLookUp.length > 0) {
    for (const [id, stored] of await cache.get(ownToLookUp, ownKey, locale)) {
      const options = cleanOptions(stored, today);
      if (options.length === 0 && stored.length > 0) continue;
      byActivity.set(id, { activityId: id, options, source: "cache" });
    }
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
      const found = await (opts.search ?? searchOnce)(ids, location, radius, locale, now, own);
      if (!found) throw new Error("the research answer could not be read");
      await Promise.all(
        ids.map(async (id) => {
          let options = found.get(id) ?? [];
          if (checker && options.length > 0) {
            const result = await checker(options);
            dropped += result.dropped.length;
            for (const d of result.dropped) console.warn(`WINDOW: research option dropped (${d.reason}): ${d.option.name} ${d.option.url ?? ""}`);
            options = result.kept;
          }
          byActivity.set(id, { activityId: id, options, source: "search" });
        }),
      );
      await cache?.put(
        ids.map((id) => ({ activityId: id, options: byActivity.get(id)?.options ?? [], ...(own ? { emptyTtlDays: PICK_EMPTY_TTL_DAYS } : {}) })),
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
