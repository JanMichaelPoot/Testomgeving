import type { IdeaDoor } from "@/lib/claude/ideaBookTypes";
import type { SocialFormat } from "@/lib/discovery/types";

// The selection engine: from what a person picked and stated, choose the six
// ideas plus a wildcard (as "seeds": which activity, in which direction, why,
// and in which social form). It is deterministic and makes no AI call; Claude
// writes the text around the seeds afterwards. See docs/discovery-engine.md.

/** The four directions the brief asks for, plus the random prompt and a cold start. */
export type Direction = "familiar" | "adjacent" | "unexpected" | "stretch" | "wildcard" | "explore";

export interface EngineInput {
  /** Activity ids picked on the cards. */
  interests: readonly string[];
  /** World (domain) ids picked before the cards. */
  interestDomains: readonly string[];
  /** They asked to be surprised and picked nothing on purpose. */
  surpriseMe?: boolean;
  /** Explicit "how do you like to do this" answers (SocialFormat ids, "any", "varies"). */
  socialFormats: readonly string[];
  // The dials, as the wizard stores them (see the intake dictionary).
  practicalToWild: string;
  budget: string;
  effort: string;
  timeAvailable: string;
  ageCategory: string;
  /** Free text: what may not be missing or must stay away. Read conservatively. */
  mustHaves: string;
  /** Activities shown to this visitor in recent sessions; not repeated unless picked again. */
  history?: readonly string[];
  /** Makes the result reproducible. */
  seed: string;
}

export interface Seed {
  activityId: string;
  direction: Direction;
  /** The door the idea belongs to in the Idea Book. */
  door: IdeaDoor;
  /** Activity ids from the person's own pick to this seed (2-3 long for a chain). */
  chain: string[];
  /** The bridge tags that connect the steps. */
  via: string[];
  /** For a curated combination: the partner activity and the combined activity's name. */
  hybrid?: { partnerId: string; label: { nl: string; en: string } };
  /** The social form to lead with (their own choice), or null when they did not choose or it is unknown. */
  lead: SocialFormat | null;
  /** Other forms the activity also supports. */
  alsoFormats: SocialFormat[];
  /** Things the research step must confirm, e.g. "cost_unknown", "accessibility". */
  verify: string[];
}

export interface ResolvedConstraints {
  /** Highest typical entry cost allowed (0 free .. 3 over 50). */
  costCap: 0 | 1 | 2 | 3;
  /** The cost class whose range can reach past the stated budget; those pass with a "cost_near_budget" flag. */
  nearBudgetCost: number | null;
  /** Highest physical intensity allowed (0..3). */
  intensityCap: 0 | 1 | 2 | 3;
  /** Activities that need qualified supervision are hidden. */
  hideSupervised: boolean;
  /** Only their explicit choice: activities must support at least one of these. Null = no restriction. */
  formats: SocialFormat[] | null;
  /** Groups are ruled out ("geen groepen"). */
  noGroups: boolean;
  /** A stated must-have about where it happens. */
  setting: "indoor" | "outdoor" | null;
  /** Things we cannot filter on (no data) but must not lose; passed on to be checked. */
  verify: string[];
}

export interface EngineResult {
  /** The six regular seeds ordered by door, then the wildcard. */
  seeds: Seed[];
  constraints: ResolvedConstraints;
  /** Notes about what was hard: "pool_small", "no_picks", "direction_relaxed:stretch", ... */
  notes: string[];
}
