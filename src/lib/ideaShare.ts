import type { IdeaBookEntry } from "@/lib/claude/ideaBookTypes";
import { WILDCARD_KEY, parseIdeaParam, resolveIdeaByKey } from "@/lib/ideaKeys";

// Sharing ONE idea of a book (Step 242): the address a friend opens, the picture that shows when it is pasted into a chat, and the small pure helpers both need.
// Browser-safe (no node imports): the idea dialog uses it too.
//
// What a friend sees is only what the shared book page shows a stranger already: the idea itself. Never the profile, the answers or the other ideas.

const PLAN_ID = /^[0-9a-f-]{36}$/i;

/** The short explanation next to an idea: its own one-line intro, else the first sentence of why it fits. */
export function shortExplanation(idea: IdeaBookEntry): string {
  const intro = (idea.intro ?? "").trim();
  if (intro) return intro;
  const why = (idea.why_it_fits ?? "").trim();
  const first = why.match(/^[^.!?]+[.!?]/);
  return (first ? first[0] : why).trim();
}

/** The text cut at a word boundary within `max` characters, with an ellipsis when something was cut. */
export function truncateAtWord(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.5 ? cut.slice(0, space) : cut).replace(/[\s,;:.\-–—]+$/, "")}…`;
}

/** A valid plan id and idea key from an address, or null. Both are checked before anything is read from the database. */
export function parseShareTarget(planId: unknown, key: unknown): { planId: string; key: string } | null {
  if (typeof planId !== "string" || !PLAN_ID.test(planId)) return null;
  const k = parseIdeaParam(key);
  return k ? { planId, key: k } : null;
}

export const ideaSharePath = (planId: string, key: string): string => `/shared/${planId}/idee/${key}`;

/** The picture of the card (the same file the chat shows as a preview), as a path on this site. */
export const ideaCardPath = (planId: string, key: string): string => `${ideaSharePath(planId, key)}/opengraph-image`;

/** The link a friend opens, with where it came from for the measurements. */
export const ideaShareLink = (siteUrl: string, planId: string, key: string): string => `${siteUrl}${ideaSharePath(planId, key)}?utm_source=window_share&utm_medium=idea_card`;

/** The index that picks the idea's photo: its place in the book, and for the wildcard the number after the last idea (as on the book page). */
export function ideaPhotoIndex(key: string, ideaCount: number): number {
  if (key === WILDCARD_KEY) return ideaCount;
  const m = /^idea-(\d+)$/.exec(key);
  return m ? Number(m[1]) : 0;
}

/** The idea a share address points at, with the index for its photo; null when the key is not an idea of this book. */
export function resolveShared(key: string, ideas: IdeaBookEntry[], wildcard: IdeaBookEntry | null): { idea: IdeaBookEntry; photoIndex: number; isWildcard: boolean } | null {
  const idea = resolveIdeaByKey(key, ideas, wildcard);
  return idea ? { idea, photoIndex: ideaPhotoIndex(key, ideas.length), isWildcard: key === WILDCARD_KEY } : null;
}
