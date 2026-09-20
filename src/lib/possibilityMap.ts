import type { IdeaBookEntry, IdeaDoor } from "@/lib/claude/ideaBookTypes";

// Fase 4 (New Result Experience) — shared logic behind the "Possibility
// Map" screen. Pure and deterministic (no AI call): both the door ordering
// and the "One Thing" pick work directly off data Fase 3 already computes
// and stores (door, scores) — this phase is about surfacing that data, not
// generating anything new.

// The 4 regular doors, ordered by increasing distance from the person's
// comfort zone. "wildcard" is deliberately excluded: it always gets its
// own row/framing wherever ideas are listed.
export const DOOR_ORDER: readonly Exclude<IdeaDoor, "wildcard">[] = [
  "natural",
  "discovery",
  "unexpected",
  "stretch",
];

export interface OrderedIdea {
  idea: IdeaBookEntry;
  originalIndex: number;
}

// Sorts ideas by door (natural → discovery → unexpected → stretch),
// preserving Claude's original relative order within each door — a stable
// sort, not a re-shuffle. Both the web Possibility Map and the PDF
// renderer use this same order, so an idea's position never disagrees
// between the two. An idea with an unrecognized door (shouldn't happen
// after generateIdeaBook's own normalization, but this is display code,
// not generation code — stay defensive) sorts last rather than throwing.
export function orderIdeasByDoor(ideas: IdeaBookEntry[]): OrderedIdea[] {
  return ideas
    .map((idea, originalIndex) => ({ idea, originalIndex }))
    .sort((a, b) => {
      const rankA = DOOR_ORDER.indexOf(a.idea.door as (typeof DOOR_ORDER)[number]);
      const rankB = DOOR_ORDER.indexOf(b.idea.door as (typeof DOOR_ORDER)[number]);
      const safeA = rankA === -1 ? DOOR_ORDER.length : rankA;
      const safeB = rankB === -1 ? DOOR_ORDER.length : rankB;
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

function oneThingScore(idea: IdeaBookEntry): number {
  const s = idea.scores;
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
// already gets its own spotlight, and "if you only do one thing" should
// point at something squarely achievable.
export function pickOneThingIndex(ideas: IdeaBookEntry[]): number | null {
  if (ideas.length === 0) return null;
  let bestIndex = 0;
  let bestScore = -Infinity;
  ideas.forEach((idea, index) => {
    const score = oneThingScore(idea);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });
  return bestIndex;
}
