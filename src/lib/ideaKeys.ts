import type { IdeaBookEntry } from "@/lib/claude/ideaBookTypes";

// One key format for everything that refers to a single idea of a plan:
// window_plans.feedback_json (0009) and window_plans.committed_idea_key
// (0013). "idea-<index into ideas_json>" is stable regardless of the door
// order the ideas are displayed in; the wildcard is always just "wildcard".
export const WILDCARD_KEY = "wildcard";

export function ideaKey(originalIndex: number): string {
  return `idea-${originalIndex}`;
}

// Looks a key up in a plan's stored ideas. Returns null for anything that
// doesn't point at a real idea (malformed key, index out of range, wildcard
// requested but the plan has none) — callers treat that as "nothing chosen".
export function resolveIdeaByKey(
  key: string | null | undefined,
  ideas: IdeaBookEntry[],
  wildcard: IdeaBookEntry | null
): IdeaBookEntry | null {
  if (!key) return null;
  if (key === WILDCARD_KEY) return wildcard;
  const match = /^idea-(\d+)$/.exec(key);
  if (!match) return null;
  return ideas[Number(match[1])] ?? null;
}

// A link to one idea of a plan (the e-mail has one per idea): the plan address plus ?idee=<key>. The plan page reads it and opens that idea's
// window at once. Only the key formats above are accepted back, so the parameter can never carry anything else into the page.
export const IDEA_LINK_PARAM = "idee";

export function ideaUrl(planUrl: string, key: string): string {
  return `${planUrl}${planUrl.includes("?") ? "&" : "?"}${IDEA_LINK_PARAM}=${encodeURIComponent(key)}`;
}

/** A key from a link, or null when it is not an idea key (a malformed value, an array of values, nothing). */
export function parseIdeaParam(raw: unknown): string | null {
  return typeof raw === "string" && (raw === WILDCARD_KEY || /^idea-\d{1,2}$/.test(raw)) ? raw : null;
}
