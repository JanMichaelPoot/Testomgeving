import type { Dictionary, Option } from "@/lib/i18n/dictionaries";

// The "echo" at the top of /plan: the buyer's own words from the intake,
// quoted back ("Je zei: ‘ik verveel me al weken.’") plus the handful of
// answers the book was built on, as chips. Pure functions only — the page
// (server) does the database read and hands the result to the client
// component as plain strings.

export const MAX_ECHO_SITUATION_LENGTH = 90;

export interface PlanEcho {
  // The situation, ready to sit between quotes (whitespace normalised, cut
  // at a word boundary when long, terminal punctuation ensured). Null when
  // the person left it empty — the page then shows a fallback headline.
  situation: string | null;
  // Localised labels of the answers the book was based on, e.g.
  // ["Haarlem", "Een halve dag", "Tot €25", "Alleen ik"].
  chips: string[];
}

export function truncateAtWord(text: string, max: number): string {
  if (text.length <= max) return text;
  const slice = text.slice(0, max);
  const lastSpace = slice.lastIndexOf(" ");
  // No space at all (one giant token): hard cut rather than returning "".
  const cut = lastSpace > 0 ? slice.slice(0, lastSpace) : slice;
  return `${cut.replace(/[\s.,;:!?…-]+$/u, "")}…`;
}

export function formatSituationForEcho(raw: string | null | undefined): string | null {
  const normalised = (raw ?? "").replace(/\s+/g, " ").trim();
  if (!normalised) return null;
  const shortened = truncateAtWord(normalised, MAX_ECHO_SITUATION_LENGTH);
  return /[.!?…]$/u.test(shortened) ? shortened : `${shortened}.`;
}

function labelFor(options: Option[], value: string | undefined): string | null {
  if (!value) return null;
  return options.find((o) => o.value === value)?.label ?? null;
}

export interface EchoSource {
  situation?: string;
  location?: string;
  timeAvailable?: string;
  budget?: string;
  company?: string[];
}

export function buildPlanEcho(source: EchoSource | null, dict: Dictionary["intake"]): PlanEcho {
  if (!source) return { situation: null, chips: [] };

  const location = (source.location ?? "").replace(/\s+/g, " ").trim();
  const companyLabels = (source.company ?? [])
    .map((value) => labelFor(dict.company.options, value))
    .filter((label): label is string => Boolean(label));

  const chips = [
    location || null,
    labelFor(dict.timeAvailable.options, source.timeAvailable),
    labelFor(dict.budget.options, source.budget),
    companyLabels.length > 0 ? companyLabels.join(", ") : null,
  ].filter((chip): chip is string => Boolean(chip));

  return { situation: formatSituationForEcho(source.situation), chips };
}
