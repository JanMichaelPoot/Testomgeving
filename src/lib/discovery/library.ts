import vocabularyJson from "@/lib/discovery/vocabulary.json";
import hybridsJson from "@/lib/discovery/hybrids.json";
import collecting from "@/lib/discovery/data/collecting.json";
import creative from "@/lib/discovery/data/creative.json";
import games from "@/lib/discovery/data/games.json";
import history from "@/lib/discovery/data/history.json";
import movement from "@/lib/discovery/data/movement.json";
import nature from "@/lib/discovery/data/nature.json";
import restful from "@/lib/discovery/data/restful.json";
import soloExplore from "@/lib/discovery/data/solo_explore.json";
import tech from "@/lib/discovery/data/tech.json";
import together from "@/lib/discovery/data/together.json";
export { activityImage, domainImage } from "@/lib/discovery/paths";
import type { Activity, ActivityStatus, Domain, Hybrid, SubDomain, Tag, Vocabulary } from "@/lib/discovery/types";

// The library is plain JSON so it can grow without touching code:
//   - vocabulary.json     domains, sub-domains and tags (with nl/en labels)
//   - data/<domain>.json  the activities of one domain (add as many as you like)
//   - hybrids.json        curated combinations of two activities
// Adding a NEW domain file needs one import line here (library.test.ts fails if
// a file in data/ is missing from this list). See docs/discovery-taxonomy.md.
const activityFiles: Activity[][] = [
  movement,
  creative,
  nature,
  history,
  games,
  collecting,
  tech,
  soloExplore,
  together,
  restful,
] as Activity[][];

export const VOCABULARY = vocabularyJson as Vocabulary;
export const DOMAINS: Domain[] = VOCABULARY.domains;
export const SUB_DOMAINS: SubDomain[] = VOCABULARY.subs;
export const TAGS: Tag[] = VOCABULARY.tags;
export const HYBRIDS = hybridsJson as Hybrid[];
/** Every activity in every status (including "retired"). */
export const ALL_ACTIVITIES: Activity[] = activityFiles.flat();

const byId = new Map(ALL_ACTIVITIES.map((a) => [a.id, a]));

const STATUS_RANK: Record<ActivityStatus, number> = { retired: -1, concept: 0, reviewed: 1, live: 2 };

/** Pure filter behind getActivities(); "retired" is never included. */
export function filterByStatus(
  list: readonly Activity[],
  minStatus: Exclude<ActivityStatus, "retired"> = "concept",
): Activity[] {
  const min = STATUS_RANK[minStatus];
  return list.filter((a) => STATUS_RANK[a.status] >= min);
}

/**
 * The activities to show or draw from. `minStatus` lets production show only
 * reviewed/live items while concepts are still being checked.
 */
export function getActivities(opts: { minStatus?: Exclude<ActivityStatus, "retired"> } = {}): Activity[] {
  return filterByStatus(ALL_ACTIVITIES, opts.minStatus);
}

/** Resolves any id, including retired ones, so stored profiles keep working. */
export function getActivity(id: string): Activity | undefined {
  return byId.get(id);
}

export function activityAlt(a: Activity, locale: "nl" | "en"): string {
  return (a.alt ?? a.label)[locale];
}
