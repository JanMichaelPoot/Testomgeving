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
