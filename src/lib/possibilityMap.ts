import type { IdeaBookEntry, IdeaDoor } from "@/lib/claude/ideaBookTypes";

// Fase 4 (New Result Experience) — shared logic behind the "Possibility
// Map" and "Open Doors" screens. Pure and deterministic (no AI call): both
// the door ordering and the "One Thing" pick work directly off data Fase 3
// already computes and stores (door, scores) — this phase is about
// surfacing that data, not generating anything new.

// The 4 regular doors, ordered by increasing distance from the person's
// comfort zone — used to walk the reader from safe to adventurous before
// the wildcard closes the book. "wildcard" is deliberately excluded: it
// already has its own dedicated screen and framing in IdeaBookViewer.
export const DOOR_ORDER: readonly Exclude<IdeaDoor, "wildcard">[] = [
  "natural",
  "discovery",
  "unexpected",
  "stretch",
];

// Fase 6 (Interaction & Retention) — Challenge Mode walks the same 4 doors
// back-to-front: stretch first, natural last. A plain reverse of DOOR_ORDER
// rather than a separately curated list, so the two orders can never
// silently drift apart (e.g. if a 5th door were ever added to DOOR_ORDER).
export const CHALLENGE_DOOR_ORDER: readonly Exclude<IdeaDoor, "wildcard">[] =
  [...DOOR_ORDER].reverse();

export interface OrderedIdea {
  idea: IdeaBookEntry;
  originalIndex: number;
}

// Sorts ideas by door, preserving Claude's original relative order within
// each door — a stable sort, not a re-shuffle. Defaults to DOOR_ORDER
// (natural → discovery → unexpected → stretch); the PDF renderer always
// uses this default. Fase 6's Challenge Mode toggle (web-only, IdeaBook-
// Viewer.tsx) passes CHALLENGE_DOOR_ORDER instead to walk the same ideas
// from stretch back to natural. An idea with an unrecognized door
// (shouldn't happen after generateIdeaBook's own normalization, but this is
// display code, not generation code — stay defensive) sorts last rather
// than throwing.
export function orderIdeasByDoor(
  ideas: IdeaBookEntry[],
  doorOrder: readonly Exclude<IdeaDoor, "wildcard">[] = DOOR_ORDER
): OrderedIdea[] {
  return ideas
    .map((idea, originalIndex) => ({ idea, originalIndex }))
    .sort((a, b) => {
      const rankA = doorOrder.indexOf(a.idea.door as (typeof doorOrder)[number]);
      const rankB = doorOrder.indexOf(b.idea.door as (typeof doorOrder)[number]);
      const safeA = rankA === -1 ? doorOrder.length : rankA;
      const safeB = rankB === -1 ? doorOrder.length : rankB;
      return safeA - safeB || a.originalIndex - b.originalIndex;
    });
}

// The "One Thing" pick — "if you only do one thing, do this." Weighted
// toward relevance first (it has to actually fit), then feasibility (it
// has to be realistic to just go and do), with novelty and surprise as
// tie-breakers so the pick doesn't always land on the safest "natural"
// idea. Deliberately not the same as "highest score on paper" — a single
// dominant dimension (e.g. maximum novelty) tends to surface the most
// extreme idea rather than the most convincing one.
const ONE_THING_WEIGHTS = {
  relevance: 0.4,
  feasibility: 0.25,
  novelty: 0.2,
  surprise: 0.15,
};

// Fase 6 — Challenge Mode's reweighting of the same pick: relevance and
// feasibility (the "safe and doable" dimensions) are turned down rather
// than dropped entirely — it should still point at something real, not just
// the single highest-novelty idea on paper — while challenge_level and
// novelty are turned up so the highlighted pick actually reads as a stretch
// when the toggle is on.
const CHALLENGE_ONE_THING_WEIGHTS = {
  relevance: 0.15,
  feasibility: 0.15,
  novelty: 0.25,
  surprise: 0.15,
  challenge_level: 0.3,
};

function oneThingScore(idea: IdeaBookEntry, challengeMode: boolean): number {
  const s = idea.scores;
  if (challengeMode) {
    return (
      s.relevance * CHALLENGE_ONE_THING_WEIGHTS.relevance +
      s.feasibility * CHALLENGE_ONE_THING_WEIGHTS.feasibility +
      s.novelty * CHALLENGE_ONE_THING_WEIGHTS.novelty +
      s.surprise * CHALLENGE_ONE_THING_WEIGHTS.surprise +
      s.challenge_level * CHALLENGE_ONE_THING_WEIGHTS.challenge_level
    );
  }
  return (
    s.relevance * ONE_THING_WEIGHTS.relevance +
    s.feasibility * ONE_THING_WEIGHTS.feasibility +
    s.novelty * ONE_THING_WEIGHTS.novelty +
    s.surprise * ONE_THING_WEIGHTS.surprise
  );
}

// Returns the index (into the original, unsorted `ideas` array) of the
// single idea to highlight as "One Thing" — or null for an empty array.
// Only considers the 6 regular ideas, never the wildcard: the wildcard
// already gets its own spotlight moment, and "if you only do one thing"
// should point at something squarely achievable. `challengeMode` (Fase 6,
// web-only — the PDF renderer never passes this) reweights the pick toward
// challenge_level and novelty instead; see CHALLENGE_ONE_THING_WEIGHTS.
export function pickOneThingIndex(
  ideas: IdeaBookEntry[],
  opts: { challengeMode?: boolean } = {}
): number | null {
  if (ideas.length === 0) return null;
  const challengeMode = opts.challengeMode ?? false;
  let bestIndex = 0;
  let bestScore = -Infinity;
  ideas.forEach((idea, index) => {
    const score = oneThingScore(idea, challengeMode);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });
  return bestIndex;
}
