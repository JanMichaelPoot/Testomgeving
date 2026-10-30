import { cookies } from "next/headers";
import type { createServiceRoleClient } from "@/lib/supabase/server";
import { getActivity } from "@/lib/discovery/library";
import { parseSeason, seasonalEditionEnabled, type Season } from "@/lib/seasonEdition";

type ServiceRoleClient = ReturnType<typeof createServiceRoleClient>;

// What the follow-up e-mail link leaves in the browser (src/app/nieuw-venster/route.ts): the id of the book that was already received, so
// the next intake avoids the ideas in it, and optionally a season. Both are first-party cookies set by the person's own click on a link in
// a mail they consented to; both only ever hold an id or a season word. The intake (app/intake/actions.ts) reads them when the answers are
// stored, and they expire by themselves after two weeks.

export const AVOID_COOKIE = "window_avoid";
export const SEASON_COOKIE = "window_season";
const TWO_WEEKS = 60 * 60 * 24 * 14;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The cookies the follow-up link sets, as name/value/options for `response.cookies.set`. The season only when the seasonal edition is on. */
export function followUpCookies(planId: string, season: Season | null) {
  const options = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", maxAge: TWO_WEEKS, path: "/" };
  const list = [{ name: AVOID_COOKIE, value: planId, options }];
  if (season && seasonalEditionEnabled()) list.push({ name: SEASON_COOKIE, value: season, options });
  return list;
}

/** The activity ids of every idea in a stored book (ideas and wildcard), only ones that exist in the library. */
export function activityIdsOf(book: { ideas_json?: unknown; wildcard_json?: unknown }): string[] {
  const all = [...(Array.isArray(book.ideas_json) ? book.ideas_json : []), book.wildcard_json];
  const ids = all.flatMap((idea) => {
    const id = idea && typeof idea === "object" ? (idea as { activity_id?: unknown }).activity_id : undefined;
    return typeof id === "string" && getActivity(id) ? [id] : [];
  });
  return [...new Set(ids)];
}

/** The ideas to leave out of this intake's book, from the cookie; empty without one (or when the book cannot be read). */
export async function loadAvoidIds(supabase: ServiceRoleClient): Promise<string[]> {
  const planId = (await cookies()).get(AVOID_COOKIE)?.value;
  if (!planId || !UUID.test(planId)) return [];
  try {
    const { data } = await supabase.from("window_plans").select("ideas_json, wildcard_json").eq("id", planId).maybeSingle();
    return data ? activityIdsOf(data) : [];
  } catch {
    return [];
  }
}

/** The season asked for by the follow-up link; null unless the seasonal edition is switched on. */
export async function loadSeason(): Promise<Season | null> {
  if (!seasonalEditionEnabled()) return null;
  return parseSeason((await cookies()).get(SEASON_COOKIE)?.value);
}
