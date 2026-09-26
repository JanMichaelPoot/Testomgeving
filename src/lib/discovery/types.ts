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
  safety: Safety;
  /** A low-threshold way in (trial class, beginner evening, open day). */
  entry: Unknown<Localized>;
  /** English art direction for the card photo. No people or faces. */
  scene: string;
  /** Optional alt text; defaults to the label. */
  alt?: Localized;
  status: ActivityStatus;
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
