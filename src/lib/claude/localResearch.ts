import type Anthropic from "@anthropic-ai/sdk";
import { anthropic } from "@/lib/anthropic";
import { getActivity } from "@/lib/discovery/library";
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
  region: "within roughly an hour's travel",
  nl: "anywhere in the Netherlands (including online options)",
};

// --- cache ---------------------------------------------------------------------------------

/** Found options are trusted for 30 days; "nothing verifiable" is remembered for 7. */
export const FOUND_TTL_DAYS = 30;
export const EMPTY_TTL_DAYS = 7;

export interface ResearchCache {
  get(activityIds: string[], place: string, locale: Locale): Promise<Map<string, LocalOption[]>>;
  put(entries: { activityId: string; options: LocalOption[] }[], place: string, locale: Locale): Promise<void>;
}

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
          expires_at: new Date(now + (e.options.length > 0 ? FOUND_TTL_DAYS : EMPTY_TTL_DAYS) * 86400000).toISOString(),
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

const SYSTEM = `You are a meticulous local-options researcher for WINDOW, a possibility-discovery app.
Your only job is to use web search to find REAL, CURRENTLY OPERATING businesses, venues, clubs, routes, event
series or platforms where a beginner can take part in the activities you are given. Always verify with a search
and never rely on memory or a plausible-sounding guess. Never invent a name or a URL. You finish with exactly
one JSON code block and nothing after it.`;

export function buildResearchPrompt(
  activityIds: string[],
  location: string,
  radius: string,
  locale: Locale,
): string {
  const language = locale === "nl" ? "Dutch" : "English";
  const lines = activityIds.map((id, i) => {
    const a = getActivity(id);
    const entry = a?.entry ? ` Usual way in: ${a.entry.en}.` : "";
    return `${i + 1}. id "${id}": ${a?.label.nl ?? id} (${a?.label.en ?? id}).${entry}`;
  });
  return `Place: ${location || "the Netherlands"}. Search radius: ${RADIUS_TEXT[radius] ?? RADIUS_TEXT.city}.
Write the notes in ${language}.

For each activity below, find up to 3 real, currently operating options where a beginner can actually take part
there, preferring a low-threshold way in (trial class, beginner evening, open day, drop-in). Combine searches
where one query can cover several activities (for example "creatieve workshops ${location || "Nederland"}").
If nothing can be verified for an activity, give an empty options list instead of guessing.

Activities:
${lines.join("\n")}

Rules: only list options that appear in your search results. Give the website exactly as it appeared, or null.
The note is one short line: what it is, and prices or times only when the source states them.

Finish with one JSON code block, exactly this shape:
\`\`\`json
[{"activity_id": "<id>", "options": [{"name": "...", "city": "...", "url": "https://..." , "note": "..."}]}]
\`\`\``;
}

function cleanOptions(raw: unknown): LocalOption[] {
  if (!Array.isArray(raw)) return [];
  const out: LocalOption[] = [];
  for (const o of raw) {
    if (!o || typeof o !== "object") continue;
    const r = o as Record<string, unknown>;
    const name = typeof r.name === "string" ? r.name.trim() : "";
    if (!name) continue;
    const url = typeof r.url === "string" && /^https?:\/\//i.test(r.url.trim()) ? r.url.trim() : null;
    out.push({
      name,
      city: typeof r.city === "string" ? r.city.trim() : "",
      url,
      note: typeof r.note === "string" ? r.note.trim() : "",
    });
    if (out.length === 3) break;
  }
  return out;
}

/** Reads the model's JSON answer; anything malformed yields null (the caller treats it as "no research"). */
export function parseResearchAnswer(text: string, wanted: string[]): Map<string, LocalOption[]> | null {
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
    if (typeof r.activity_id === "string" && wanted.includes(r.activity_id)) out.set(r.activity_id, cleanOptions(r.options));
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
): Promise<Map<string, LocalOption[]> | null> {
  const startedAt = Date.now();
  const maxUses = Math.min(MAX_SEARCHES, Math.max(2, Math.ceil(activityIds.length * 0.7)));
  const message = await anthropic.messages.create({
    model: RESEARCH_MODEL,
    max_tokens: 3500,
    system: SYSTEM,
    messages: [{ role: "user", content: buildResearchPrompt(activityIds, location, radius, locale) }],
    tools: [
      {
        type: "web_search_20250305",
        name: "web_search",
        max_uses: maxUses,
        ...(radius === "nl" ? {} : { user_location: { type: "approximate", city: location || null, country: "NL" } }),
      } as Anthropic.Messages.WebSearchTool20250305,
    ],
  });
  const searches = message.content.filter((b) => b.type === "server_tool_use" && b.name === "web_search").length;
  console.log(
    `WINDOW: research pass took ${Date.now() - startedAt}ms, ${searches} web searches for ${activityIds.length} activities (${RESEARCH_MODEL}), ` +
      `usage=${JSON.stringify(message.usage)}`,
  );
  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  return parseResearchAnswer(text, activityIds);
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
}): Promise<{ byActivity: Map<string, SeedResearch>; stats: ResearchStats }> {
  const startedAt = Date.now();
  const { activityIds, location, searchDistance, locale } = opts;
  const place = placeKey(location, searchDistance);
  const radius = place.split("|")[1] ?? "city";
  const cache = opts.cache === undefined ? createSupabaseResearchCache() : opts.cache;
  const byActivity = new Map<string, SeedResearch>();

  const cached = cache ? await cache.get(activityIds, place, locale) : new Map<string, LocalOption[]>();
  for (const [id, options] of cached) byActivity.set(id, { activityId: id, options, source: "cache" });

  const missing = activityIds.filter((id) => !byActivity.has(id));
  let failed = 0;
  if (missing.length > 0) {
    try {
      const found = await (opts.search ?? searchOnce)(missing, location, radius, locale);
      if (!found) throw new Error("the research answer could not be read");
      for (const id of missing) byActivity.set(id, { activityId: id, options: found.get(id) ?? [], source: "search" });
      await cache?.put(missing.map((id) => ({ activityId: id, options: found.get(id) ?? [] })), place, locale);
    } catch (err) {
      failed = missing.length;
      console.error("WINDOW: local research failed, continuing without it", err instanceof Error ? err.message : err);
      for (const id of missing) byActivity.set(id, { activityId: id, options: [], source: "none" });
    }
  }

  const stats: ResearchStats = { cached: cached.size, searched: missing.length - failed, failed, ms: Date.now() - startedAt };
  console.log(`WINDOW: local research: ${stats.cached} cached, ${stats.searched} searched, ${stats.failed} failed (${place})`);
  return { byActivity, stats };
}
