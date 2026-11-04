// WindowInto Activity Reference Library: types.
//
// A standalone reference layer next to the app's discovery library (src/lib/discovery). The app does not read it:
// it is an editorial master database (activities, categories, associations and the weighted links between them),
// exported to Excel and used to check and grow the app's library. Activities that exist in the app carry a
// `legacy_id` so the two can be reconciled; the reference library never overwrites the app's data.
//
// Everything here is an editorial hypothesis ("Concept") until a human has reviewed it: a relevance score is a
// judgement, not a measurement.

export interface Localized {
  nl: string;
  en: string;
}

/** EXP = experience / doing, MAK = making / creating, LER = learning / developing. */
export const ACTIVITY_TYPES = ["EXP", "MAK", "LER"] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

/**
 * How an association relates to an activity.
 * D direct: the activity is literally about it. T thematic: same theme. E experiential: the feeling it gives.
 * V skill: the skill it uses. M material: the material it works with.
 * O discovery: a non-obvious but sensible path that opens a new direction (needs a written reason).
 */
export const RELATIONS = ["D", "T", "E", "V", "M", "O"] as const;
export type Relation = (typeof RELATIONS)[number];

export const RELATION_LABELS: Record<Relation, Localized & { full: Localized }> = {
  D: { nl: "Direct", en: "Direct", full: { nl: "Direct", en: "Direct" } },
  T: { nl: "Thematisch", en: "Thematic", full: { nl: "Thematisch", en: "Thematic" } },
  E: { nl: "Ervaringsgericht", en: "Experiential", full: { nl: "Ervaringsgericht", en: "Experiential" } },
  V: { nl: "Vaardigheidsgericht", en: "Skill-based", full: { nl: "Vaardigheidsgericht", en: "Skill-based" } },
  M: { nl: "Materiaalgericht", en: "Material-based", full: { nl: "Materiaalgericht", en: "Material-based" } },
  O: { nl: "Ontdekkingsgericht", en: "Discovery", full: { nl: "Ontdekkingsgericht", en: "Discovery" } },
};

/** Relation form -> the association domains it may point at. O may point anywhere. */
export const RELATION_DOMAINS: Record<Exclude<Relation, "O">, readonly string[]> = {
  D: ["actions", "environments"],
  T: ["themes"],
  E: ["experiences", "senses", "aesthetics", "social", "challenge"],
  V: ["skills"],
  M: ["materials"],
};

export const MATCHES = ["exact", "close", "new"] as const;
/** exact: same activity as in the app. close: the app has a near neighbour with another scope. new: not in the app. */
export type Match = (typeof MATCHES)[number];

export const STATUSES = ["Concept", "Reviewed", "Approved", "Retired"] as const;
export type RefStatus = (typeof STATUSES)[number];

export interface Category {
  id: string;
  slug: string;
  nl: string;
  en: string;
  /** Target number of activities for the full library. */
  target: number;
  scope: Localized;
}

export interface AssociationDomain {
  slug: string;
  nl: string;
  en: string;
  note: Localized;
}

export interface Association {
  id: string;
  slug: string;
  domain: string;
  nl: string;
  en: string;
  def: Localized;
  /** The id this association had in the first (30-association) workbook, if it came from there. */
  v0_id?: string;
  /** The closest tag in the app's discovery vocabulary, when there is one. */
  app_tag?: string;
  /** What this association is NOT, and which neighbour to use instead. Guards against overlapping associations. */
  scope?: Localized;
}

/** Same scales as the app's discovery library (src/lib/discovery/types.ts). `source` says where the values come from. */
export interface Facets {
  setting: "indoor" | "outdoor" | "both" | null;
  social_formats: string[] | null;
  /** 0 no experience needed · 1 basics help · 2 advanced */
  level: 0 | 1 | 2 | null;
  /** 1 under an hour · 2 1-3 hours · 3 half a day or more · 4 multi-day/ongoing */
  duration: 1 | 2 | 3 | 4 | null;
  /** 0 free · 1 up to 15 · 2 15-50 · 3 over 50 (euro) */
  cost: 0 | 1 | 2 | 3 | null;
  /** 0 no special risk · 1 basic rules/equipment · 2 only under qualified supervision */
  safety_tier: 0 | 1 | 2 | null;
  /** "app" = copied from the matching app activity; "authored" = written for this record. */
  source: "app" | "authored";
}

export interface RefActivity {
  id: string;
  slug: string;
  category: string;
  types: ActivityType[];
  nl: string;
  en: string;
  sub: Localized;
  desc: Localized;
  match: Match;
  legacy_id: string | null;
  /** The id in the first workbook (ACT-001...), if the activity came from there. */
  v0_id?: string;
  facets: Facets;
  /** "association-slug:score:relation", score 1-5. */
  links: string[];
  /** The written reason for every discovery (O) link, per association slug. */
  why: Record<string, Localized>;
  status: RefStatus;
  /** Quality review: which round looked at this record and whether it was changed ("adjusted") or left as it was ("checked"). */
  qa?: { round: number; result: "checked" | "adjusted" };
  /** Open remarks from the review: overlaps with other records, estimated facets, deliberate gaps. */
  qa_notes?: string[];
}

export interface ParsedLink {
  association: string;
  score: number;
  relation: Relation;
}

export interface Issue {
  level: "error" | "warning";
  where: string;
  message: string;
}

export interface Library {
  categories: Category[];
  domains: AssociationDomain[];
  associations: Association[];
  activities: RefActivity[];
}
