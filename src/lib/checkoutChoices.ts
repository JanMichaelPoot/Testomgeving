import { truncateAtWord } from "@/lib/planEcho";
import type { Dictionary, Option } from "@/lib/i18n/dictionaries";
import type { IntakeAnswers } from "@/app/intake/actions";

// "Jouw keuzes" on the checkout page (fase 5): the answers as they will be used, grouped
// per wizard page, each with the page it can be changed on. Pure: labels come from the
// dictionary and the caller (which knows the activity library), nothing is stored.

export interface ChoiceGroup {
  id: "situation" | "about" | "dials" | "interests" | "final";
  /** The wizard page (0-based) that holds these answers, for "Wijzig". */
  page: number;
  label: string;
  lines: string[];
}

export interface ChoiceLabels {
  activity: (id: string) => string | null;
  domain: (id: string) => string | null;
}

const MAX_TEXT = 110;
const MAX_ITEMS_SHOWN = 6;

/** The card wizard stores interest ids; the legacy wizard never does. */
export function usesCardWizard(answers: Pick<IntakeAnswers, "interests" | "interestDomains" | "surpriseMe">): boolean {
  return (
    (answers.interests?.length ?? 0) > 0 || (answers.interestDomains?.length ?? 0) > 0 || answers.surpriseMe === true
  );
}

function label(options: Option[], value: string | undefined): string | null {
  return value ? (options.find((o) => o.value === value)?.label ?? null) : null;
}

function text(value: string | undefined): string | null {
  const t = (value ?? "").replace(/\s+/g, " ").trim();
  return t ? truncateAtWord(t, MAX_TEXT) : null;
}

const present = (list: (string | null | undefined)[]): string[] => list.filter((x): x is string => !!x);

function joinLimited(items: string[]): string {
  const shown = items.slice(0, MAX_ITEMS_SHOWN).join(", ");
  return items.length > MAX_ITEMS_SHOWN ? `${shown} +${items.length - MAX_ITEMS_SHOWN}` : shown;
}

export function buildChoiceGroups(
  answers: IntakeAnswers,
  dict: Dictionary["intake"],
  groupLabels: Dictionary["checkout"]["choicesGroups"],
  surpriseLabel: string,
  labels: ChoiceLabels,
): ChoiceGroup[] {
  const cards = usesCardWizard(answers);

  // Both wizards keep must-haves and preferences, but on different pages.
  const limits = present([text(answers.mustHaves), text(answers.preferences)]);
  const limitsPage = cards ? 4 : 3;

  const interestLabels = present((answers.interests ?? []).map((id) => labels.activity(id)));
  const domainLabels = present((answers.interestDomains ?? []).map((id) => labels.domain(id)));
  const social = present((answers.socialFormats ?? []).map((v) => label(dict.discovery.social.options, v)));
  const company = present((answers.company ?? []).map((v) => label(dict.company.options, v)));

  const interestLines = cards
    ? present([
        interestLabels.length > 0 ? joinLimited(interestLabels) : null,
        interestLabels.length === 0 && domainLabels.length > 0 ? joinLimited(domainLabels) : null,
        answers.surpriseMe ? surpriseLabel : null,
      ])
    : present([joinLimited(present((answers.solutionTypes ?? []).map((v) => label(dict.solutionTypes.options, v))))]);

  const groups: ChoiceGroup[] = [
    {
      id: "situation",
      page: 0,
      label: groupLabels.situation,
      lines: present([label(dict.purpose.options, answers.purpose), text(answers.situation) ?? text(answers.purposeFollowUp)]),
    },
    {
      id: "about",
      page: 1,
      label: groupLabels.about,
      lines: present([
        label(dict.ageCategory.options, answers.ageCategory),
        text(answers.location),
        label(dict.searchDistance.options, answers.searchDistance),
      ]),
    },
    {
      id: "dials",
      page: 2,
      label: groupLabels.dials,
      lines: present([
        [
          label(dict.practicalToWild.options, answers.practicalToWild),
          label(dict.timeAvailable.options, answers.timeAvailable),
          label(dict.budget.options, answers.budget),
          label(dict.effort.options, answers.effort),
        ]
          .filter((x): x is string => !!x)
          .join(" · ") || null,
      ]),
    },
    {
      id: "interests",
      page: 3,
      label: groupLabels.interests,
      lines: [...interestLines, ...(limitsPage === 3 ? limits : [])],
    },
    {
      id: "final",
      page: 4,
      label: groupLabels.final,
      lines: [...present([social.join(", ") || null, company.join(", ") || null]), ...(limitsPage === 4 ? limits : [])],
    },
  ];
  return groups;
}
