// Types of the knowledge import (stage B3 of WINDOW_Bouwopdracht_Kennisengine.md). A source is parsed into
// RawRecords, normalised, matched against the library with deterministic rules only, and what remains goes to a
// human review queue. Nothing here ever creates or changes a live activity on its own.

export interface RawRecord {
  source_id: string;
  /** The record's id in the source (a Wikidata Q-number). */
  source_record_id: string;
  labels: { nl?: string; en?: string };
  descriptions: { nl?: string; en?: string };
}

export interface NormalizedRecord extends RawRecord {
  /** Normalised names per language (src/lib/discovery/names.ts); undefined when the source has no label. */
  names: { nl?: string; en?: string };
}

/** The names a library activity answers to, per language, with how it got the name. */
export type NameTier = "label" | "alias";

export interface Merge {
  source_record_id: string;
  activityId: string;
  /** exact = the normalised label is the activity's label; alias = it is one of its aliases; reviewed = a human said so. */
  tier: "exact" | "alias" | "reviewed";
  /** The language in which the names were equal (reviewed merges have none). */
  lang?: "nl" | "en";
  /** Names of the record that the activity does not have yet (never shown, only for finding duplicates). */
  addAliases: { nl: string[]; en: string[] };
  /** True when the library already carries the source link: nothing is written again. */
  alreadyLinked: boolean;
}

export type ReviewReason =
  /** The names equal different activities in the two languages, or one name belongs to several activities. */
  | "ambiguous_name"
  /** No equal name, but the words overlap with existing activities: a human decides if it is the same thing. */
  | "similar_existing"
  /** Nothing like it in the library. */
  | "new_candidate";

export const REJECT_REASONS = [
  "no_label",
  "unsafe_or_restricted",
  "technical_term",
  "too_generic",
  "label_too_long",
  "proposal_reject",
  "reviewer_reject",
  "below_queue_cap",
] as const;
export type RejectReason = (typeof REJECT_REASONS)[number];

/** What a reviewer decided about a queue entry. Edited by hand in data/knowledge/review-queue.json. */
export type Decision = null | "accept" | "reject" | `merge:${string}`;

export interface QueueEntry {
  source_id: string;
  source_record_id: string;
  labels: { nl?: string; en?: string };
  descriptions: { nl?: string; en?: string };
  reason: ReviewReason;
  /** Existing activities to compare with (ids). */
  candidates: string[];
  /** A proposal from the person who read the source (not a decision): accept or unsure, with a suggested domain. */
  proposal?: { verdict: "accept" | "unsure" | "merge"; domain?: string; into?: string; note?: string };
  score: number;
  /** True when the source has no Dutch label: authoring it needs one. */
  needs_nl_label: boolean;
  /** A suggested Dutch label for a record without one. A translation (inferred_ai), never source data, until a person has reviewed it. */
  nl_suggestion?: string;
  decision: Decision;
}

export interface RejectedEntry {
  source_id: string;
  source_record_id: string;
  labels: { nl?: string; en?: string };
  reason: RejectReason;
  note?: string;
}

/** Hand-written judgements about a source's records, keyed by the normalised English label. Proposals, not decisions. */
export interface ProposalFile {
  source_id: string;
  /** A new activity worth writing, in this domain. */
  accept: Record<string, { domain: string; note?: string }>;
  /** Might be worth it; the reader was not sure. */
  unsure: Record<string, { domain?: string; note?: string }>;
  /** The library already covers this under another name: the id it would be merged into. A reviewer confirms with "merge:<id>". */
  merge: Record<string, { into: string; note?: string }>;
  /** Not an activity, not doable here, or not safe: why. */
  reject: Record<string, string>;
  /** Suggested Dutch labels for records the source has no Dutch label for. Translations by the reader: inferred_ai until reviewed. */
  nl_labels?: Record<string, string>;
}

export interface ImportResult {
  source_id: string;
  records: number;
  merges: Merge[];
  /** Records an activity has been written from (status concept in the library); no longer in review. */
  added: { source_record_id: string; activityId: string }[];
  queue: QueueEntry[];
  rejected: RejectedEntry[];
}
