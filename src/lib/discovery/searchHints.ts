// What to look for, per activity, when the research asks "where can this person actually do it near them?". The plain question
// "find a workshop or studio" gets nothing for a walk, a puzzle or a bike repair: the option for those is a club, a place or a repair café.
// Hand-written hints (searchHints.manual.json) win over the generated ones (searchHints.generated.json, scripts/generate-search-hints.ts).
import generated from "./searchHints.generated.json";
import manual from "./searchHints.manual.json";

/** venue: a studio, school or workshop with lessons · club: a club or regular group to join · place: somewhere to go · event: an outing, open day or excursion. */
export const HINT_KINDS = ["venue", "club", "place", "event"] as const;
export type HintKind = (typeof HINT_KINDS)[number];
export interface SearchHint {
  kind: HintKind;
  /** Dutch search phrases, separated by semicolons. */
  terms: string;
}

const HINTS: Record<string, SearchHint> = { ...(generated as Record<string, SearchHint>), ...(manual as Record<string, SearchHint>) };

export function searchHint(activityId: string): SearchHint | undefined {
  return HINTS[activityId];
}
export function searchHintIds(): string[] {
  return Object.keys(HINTS);
}

const KIND_TEXT: Record<HintKind, string> = {
  venue: "a studio, school, workshop or venue that gives lessons, trial sessions or a day to try it",
  club: "a club, association or regular group a beginner can join (open evening, trial membership)",
  place: "a place to go to (a venue, park, route, nature site or museum) that is open to visit",
  event: "an organised outing, excursion, open day or event, or the group that organises it",
};
/** One line for the research prompt: what kind of option counts for this activity and what to type into the search. */
export function hintLine(activityId: string): string {
  const h = searchHint(activityId);
  return h ? ` Look for ${KIND_TEXT[h.kind]}. Search terms to try (Dutch): ${h.terms}.` : "";
}
