import type { DiscoveryLevel } from "@/lib/discoveryLevels";
import type { Locale } from "@/lib/locale";
import type { IdeaLayers } from "@/lib/claude/ideaLayers";
import type { IdeaFill } from "@/lib/claude/ideaFill";

// Pure types/constants for the generated Idea Book — deliberately kept free
// of any import that touches the Anthropic client or other server-only
// code, so client components (IdeaDetail, IdeaBookViewer) can use them
// without dragging a server-only module (and its API credentials) into the
// browser bundle. See generateIdeaBook.ts, which re-exports all of this for
// server-side callers.

export interface IdeaPractical {
  estimated_cost: string;
  duration: string;
  difficulty: "easy" | "moderate" | "demanding";
  preparation: string;
}

// Shared between the PDF renderer and the /plan page so both ever show the
// exact same wording for a given difficulty value, in either locale.
export const DIFFICULTY_LABELS: Record<Locale, Record<IdeaPractical["difficulty"], string>> = {
  nl: { easy: "Makkelijk", moderate: "Gemiddeld", demanding: "Uitdagend" },
  en: { easy: "Easy", moderate: "Moderate", demanding: "Demanding" },
};

export interface IdeaLocation {
  name: string;
  address: string;
  city: string;
}

// Fase 3 (Possibility/Door Engine) — every idea belongs to exactly one
// "door," representing its distance from the person's comfort zone. The 6
// regular ideas use natural/discovery/unexpected/stretch; the separate
// wildcard slot always carries "wildcard". See the WindowInto master
// prompt, section 6 ("Open Doors").
export type IdeaDoor = "natural" | "discovery" | "unexpected" | "stretch" | "wildcard";

// A fixed, pre-generated photo library (see
// scripts/generate-idea-category-illustrations.ts, 2 photos per category)
// replaces the old IDEA_HERO_PHOTOS pool that just cycled through 7 generic
// stock photos with no relation to an idea's actual content (leading to
// mismatches like a misty-forest photo on an art-gallery idea). Claude picks
// the best-fitting category itself per idea — far more reliable than
// keyword-matching the free-text `image_suggestion` field after the fact —
// still with zero live image generation per purchase.
export const PHOTO_CATEGORIES = [
  "art_culture",
  "creative_workshop",
  "food_drink",
  "nature_outdoor",
  "water_activity",
  "active_sport",
  "music_nightlife",
  "wellness_relax",
  "social_games",
  "travel_adventure",
  "home_cozy",
  "market_shopping",
] as const;

export type PhotoCategory = (typeof PHOTO_CATEGORIES)[number];

// Fase 3 — internal Serendipity Engine scores (master prompt section 11),
// 0-100 each, 50 = neutral. These are Claude's own self-estimate per idea,
// used so a balanced set can be selected/inspected rather than just the
// highest-relevance ideas. Not shown to the person anywhere yet — that's a
// later-phase (display/quality-gate) decision — but logged in the admin
// audit-log export so real generations can be sanity-checked.
export interface IdeaScores {
  relevance: number;
  novelty: number;
  feasibility: number;
  surprise: number;
  shareability: number;
  effort: number;
  cost: number;
  social_fit: number;
  challenge_level: number;
}

// R2.3: the optional extra layers (feels_like, sizes, next_step, places, related) come from IdeaLayers.
export interface IdeaBookEntry extends IdeaLayers {
  title: string;
  intro: string;
  why_it_fits: string;
  details: string[];
  first_action: string;
  practical: IdeaPractical;
  location: IdeaLocation | null;
  requirements: string[];
  image_suggestion: string;
  photo_category: PhotoCategory;
  door: IdeaDoor;
  /** Fase 3: the discovery level, 1 (Vertrouwd) to 7 (Onontdekt). Set by the seed pipeline; absent on older books. */
  level?: DiscoveryLevel;
  scores: IdeaScores;
  /** B4 (KNOWLEDGE_ENGINE_V2): how well this idea fits the person, measured by the selection (0-100). "If you only pick one" uses it when present. */
  fit?: number;
  /** B4 (KNOWLEDGE_ENGINE_V2): the signals that led to this idea ("picked", "bridge:craft+sound", "chain:a>b>c", ...). */
  reasons?: string[];
  // Set by the seed pipeline (src/lib/claude/generateFromSeeds.ts): which library activity this
  // idea is about and the path from the person's own pick to it (activity ids). Absent on books
  // made before that pipeline existed.
  activity_id?: string;
  chain?: string[];
  // B5 / V1 (only with KNOWLEDGE_ENGINE_V2 on): the PDF's "way to spend it", "take away" and "make it yours"
  // lines written for this idea. Absent = the PDF uses its per-kind templates, as before.
  fill?: IdeaFill;
}

export interface GeneratedIdeaBook {
  profile_summary: string;
  must_haves: string[];
  preferences: string[];
  ideas: IdeaBookEntry[];
  wildcard: IdeaBookEntry;
  labels: {
    steps_heading: string;
    first_action_heading: string;
    wildcard_heading: string;
    time_label: string;
    cost_label: string;
    location_heading: string;
    requirements_heading: string;
  };
}
