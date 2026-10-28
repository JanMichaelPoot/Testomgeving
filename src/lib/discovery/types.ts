// Types for the discovery library (the "taxonomy"): a broad, extensible set of
// concrete activities that the visual profile wizard shows as cards and the
// association engine draws its ideas from.
//
// Design rule: ids for domains, sub-domains and tags are plain strings that are
// checked against src/lib/discovery/vocabulary.json by validateLibrary(), NOT
// closed TypeScript unions — so growing the library (a new domain, tag or
// hundreds of activities) is a data change, never a type change.

export interface Localized {
  nl: string;
  en: string;
}

// The social forms an activity supports. Equal options, deliberately no ranking.
export const SOCIAL_FORMATS = [
  "solo", // alone, and worth doing alone
  "drop_in_alone", // come alone, do it together (everyone is welcome/new)
  "duo",
  "small_group", // 3-6
  "large_group", // 7+
  "with_known", // with people you already know
  "online",
] as const;
export type SocialFormat = (typeof SOCIAL_FORMATS)[number];

// A facet that was not established is `null` — never assumed. A filter only
// excludes on a KNOWN conflict; unknown passes through and is flagged so the
// research step can verify it locally.
export type Unknown<T> = T | null;

export const SETTINGS = ["indoor", "outdoor", "both"] as const;
export type Setting = (typeof SETTINGS)[number];

// How easy it is to find a provider for this activity in the Netherlands. "regional" needs a provider within
// reach (a club, studio or school), "rare" exists only in a few places or abroad: the engine then wants real
// supply within the visitor's travel distance before it suggests it (see engine/select.ts and the research step).
export const SUPPLIES = ["common", "regional", "rare"] as const;
export type Supply = (typeof SUPPLIES)[number];

// draft ("concept") -> checked by a human ("reviewed") -> shown to everyone
// ("live"). "retired" hides an activity from new sessions but keeps its id
// resolvable, because stored profiles may still reference it.
export const STATUSES = ["concept", "reviewed", "live", "retired"] as const;
export type ActivityStatus = (typeof STATUSES)[number];

export interface Safety {
  // 0 no special risk · 1 basic rules/equipment · 2 only under qualified supervision
  tier: 0 | 1 | 2;
  // Required for tier 2: the conditions under which it may be suggested at all.
  note?: Localized;
}

// Where a record comes from, when it does not come from us. Absent = written by this project (method "curated").
// "inferred_ai" never counts as a verified fact: an AI-derived value or label stays a suggestion until a human has
// reviewed it (status "reviewed" and `reviewed_by`).
export const PROVENANCE_METHODS = ["curated", "source", "inferred_ai"] as const;
export type ProvenanceMethod = (typeof PROVENANCE_METHODS)[number];

export interface Provenance {
  source_id: string;
  /** The record's id in the source (a Wikidata Q-number, for instance). Required when method is "source". */
  source_record_id?: string;
  method: ProvenanceMethod;
  /** YYYY-MM-DD, when a human last checked the record against its source. */
  last_verified_at?: string;
}

/** An external record this activity is known to be the same as (a merge, not an origin). */
export interface SourceLink {
  source_id: string;
  source_record_id: string;
}

export interface Activity {
  /** Stable technical key. Never rename: profiles and history reference it. */
  id: string;
  domain: string;
  sub: string;
  label: Localized;
  /** 2-5 abstract connections ("precision", "story", ...) from vocabulary.json. */
  tags: string[];
  formats: Unknown<SocialFormat[]>;
  /** 0 calm · 1 light · 2 moderate · 3 heavy */
  intensity: Unknown<0 | 1 | 2 | 3>;
  /** 0 no experience needed · 1 basics help · 2 advanced */
  level: Unknown<0 | 1 | 2>;
  /** Typical entry cost: 0 free · 1 up to 15 · 2 15-50 · 3 over 50 (euro). */
  cost: Unknown<0 | 1 | 2 | 3>;
  /** 1 under an hour · 2 1-3 hours · 3 half a day or more · 4 multi-day/ongoing */
  duration: Unknown<1 | 2 | 3 | 4>;
  setting: Unknown<Setting>;
  /**
   * The months (1-12) in which a beginner can realistically do this in the Netherlands (open water in
   * June-September, skating in October-March). Left out = all year, or no clear season. The engine never
   * suggests an activity outside its months (src/lib/discovery/season.ts).
   */
  months?: number[];
  safety: Safety;
  /** How easy it is to find a provider nearby. Left out = common. */
  supply?: Supply;
  /** A low-threshold way in (trial class, beginner evening, open day). */
  entry: Unknown<Localized>;
  /** English art direction for the card photo. No people or faces. */
  scene: string;
  /** Optional alt text; defaults to the label. */
  alt?: Localized;
  status: ActivityStatus;
  /**
   * Other names people use for this activity, per language. Only for finding duplicates and matching imports:
   * never shown. No alias may equal the name or alias of another activity.
   */
  aliases?: { nl: string[]; en: string[] };
  /** Where the record comes from if not from us (see Provenance). Absent = curated by this project. */
  provenance?: Provenance;
  /** External records this activity was matched to by an import; a record already linked is not imported again. */
  source_links?: SourceLink[];
  /** Who checked this activity and when. Required once status is "reviewed" or "live". */
  reviewed_by?: { by: string; at: string };
}

export interface Domain {
  id: string;
  label: Localized;
  /** Short label for the domain card. */
  short: Localized;
  /** Accent colour used to style the domain's photos (and later its cards). */
  color: string;
  colorName: string;
  /** Art direction for the domain card photo. */
  scene: string;
}

export interface SubDomain {
  id: string;
  domain: string;
  label: Localized;
}

export interface Tag {
  id: string;
  label: Localized;
  /** Mood-only tags describe a feel, not a connection: they never count as a bridge. */
  generic: boolean;
}

export interface Vocabulary {
  domains: Domain[];
  subs: SubDomain[];
  tags: Tag[];
}

// A curated bisociation: two activities from different worlds merged into one
// concrete, legal activity. A concept, not a promise that local supply exists.
export interface Hybrid {
  a: string;
  b: string;
  label: Localized;
}
