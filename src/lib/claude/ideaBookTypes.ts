import type { Locale } from "@/lib/locale";

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

// A concrete, real, named alternative for actually doing an idea — a
// specific business, venue, platform, route, or event. Populated only from
// Claude's live web-search research pass (see generateIdeaBook.ts's
// researchGroundedOptions), never invented from the model's own training
// data, so every name here is meant to be a real, currently-findable thing
// rather than a plausible-sounding guess.
export interface IdeaOption {
  name: string;
  detail: string;
  url: string;
}

// Fase 3 (Possibility/Door Engine) — every idea belongs to exactly one
// "door," representing its distance from the person's comfort zone. The 6
// regular ideas use natural/discovery/unexpected/stretch; the separate
// wildcard slot always carries "wildcard". See the WindowInto master
// prompt, section 6 ("Open Doors").
export type IdeaDoor = "natural" | "discovery" | "unexpected" | "stretch" | "wildcard";

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

export interface IdeaBookEntry {
  title: string;
  intro: string;
  why_it_fits: string;
  details: string[];
  first_action: string;
  practical: IdeaPractical;
  location: IdeaLocation | null;
  options: IdeaOption[];
  requirements: string[];
  image_suggestion: string;
  door: IdeaDoor;
  scores: IdeaScores;
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
