import { DOMAINS, getActivity } from "@/lib/discovery/library";
import { SOCIAL_FORMATS } from "@/lib/discovery/types";

// What the card wizard adds to the intake, and how it is checked on the server.
// The client is never trusted: ids go into a prompt later, so every id must be a
// real one and the lists are capped.

/** The explicit "how do you like to do this" answers: the seven forms, plus two neutral ones. */
export const SOCIAL_CHOICES = [...SOCIAL_FORMATS, "any", "varies"] as const;

const MAX_INTERESTS = 60;

export interface DiscoveryAnswers {
  interests: string[];
  interestDomains: string[];
  socialFormats: string[];
  surpriseMe: boolean;
}

const unique = <T,>(list: T[]) => [...new Set(list)];

export function sanitizeDiscoveryAnswers(raw: {
  interests?: unknown;
  interestDomains?: unknown;
  socialFormats?: unknown;
  surpriseMe?: unknown;
}): DiscoveryAnswers {
  const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  const domainIds = new Set(DOMAINS.map((d) => d.id));
  const social = new Set<string>(SOCIAL_CHOICES);

  let socialFormats = unique(strings(raw.socialFormats).filter((s) => social.has(s)));
  // "No preference" and "depends on the day" stand alone: a list mixing them with
  // specific forms would contradict itself.
  const neutral = socialFormats.filter((s) => s === "any" || s === "varies");
  if (neutral.length > 0) socialFormats = neutral.slice(0, 1);

  return {
    interests: unique(strings(raw.interests).filter((id) => getActivity(id) && getActivity(id)?.status !== "retired")).slice(0, MAX_INTERESTS),
    interestDomains: unique(strings(raw.interestDomains).filter((d) => domainIds.has(d))),
    socialFormats,
    surpriseMe: raw.surpriseMe === true,
  };
}

const FORMAT_EN: Record<string, string> = {
  solo: "alone",
  drop_in_alone: "coming alone and doing it together with others (everyone is welcome/new)",
  duo: "with one other person",
  small_group: "in a small group",
  large_group: "in a larger group",
  with_known: "with people they already know",
  online: "online",
  any: "no preference",
  varies: "depends on the day",
};

/**
 * The lines the idea generator receives about the card answers (English, whatever
 * the site language is; the model writes the book in the person's language).
 * Empty when the person used the legacy wizard or skipped the step.
 */
export function describeDiscoveryForPrompt(a: Partial<DiscoveryAnswers>): string {
  const lines: string[] = [];
  const interests = (a.interests ?? []).map((id) => getActivity(id)?.label.en).filter((x): x is string => !!x);
  if (interests.length > 0) {
    lines.push(`Concrete activities they picked as interests (from a visual card library): ${interests.join("; ")}`);
    const domains = (a.interestDomains ?? []).map((id) => DOMAINS.find((d) => d.id === id)?.label.en).filter(Boolean);
    if (domains.length > 0) lines.push(`Worlds they were drawn to: ${domains.join("; ")}`);
  } else if (a.surpriseMe) {
    lines.push("They asked to be surprised and deliberately picked no interests. That is a choice, not missing data.");
  }
  const forms = (a.socialFormats ?? []).map((s) => FORMAT_EN[s]).filter(Boolean);
  if (forms.length > 0) {
    lines.push(`How they like to take part (their explicit answer; treat it as a strong preference): ${forms.join("; ")}`);
  }
  return lines.join("\n");
}
