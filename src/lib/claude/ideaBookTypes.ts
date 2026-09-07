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

export interface IdeaBookEntry {
  title: string;
  intro: string;
  why_it_fits: string;
  details: string[];
  first_action: string;
  practical: IdeaPractical;
  location: IdeaLocation | null;
  requirements: string[];
  image_suggestion: string;
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
