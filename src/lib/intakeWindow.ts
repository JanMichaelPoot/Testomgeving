import { truncateAtWord } from "@/lib/planEcho";
import type { Dictionary, Option } from "@/lib/i18n/dictionaries";
import type { IntakeAnswers } from "@/app/intake/actions";

// What the intake's "Jouw venster" panel shows for the answers given so far.
// Pure and derived — nothing here is stored (see IntakeWindowPanel).

// The wizard page a pane belongs to (a page's id): the colour of the pane, and which
// panes light up while that page is open, so a person sees where an answer lands.
export type PaneGroup = "situation" | "about" | "dials" | "openness" | "interests" | "final";

export interface WindowPaneValue {
  id: string;
  label: string;
  value: string | null;
  group: PaneGroup;
  // Spans both columns of the window (room for a longer answer, e.g. the picks).
  wide?: boolean;
}

const MAX_PANE_TEXT_LENGTH = 40;
const MAX_WIDE_PANE_TEXT_LENGTH = 84;

// Rough time still needed after finishing page `pageIndex` (0-based) of the
// 5-page wizard, in minutes — a constant per page, not a measurement.
const MINUTES_LEFT_BY_PAGE = [3, 2, 2, 1, 0] as const;

export function minutesLeft(pageIndex: number): number {
  return MINUTES_LEFT_BY_PAGE[Math.min(Math.max(pageIndex, 0), MINUTES_LEFT_BY_PAGE.length - 1)];
}

function clean(text: string | undefined, max: number = MAX_PANE_TEXT_LENGTH): string | null {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  return t ? truncateAtWord(t, max) : null;
}

function labelFor(options: Option[], value: string | undefined): string | null {
  if (!value) return null;
  return options.find((o) => o.value === value)?.label ?? null;
}

type SliderId = "ageCategory" | "searchDistance" | "practicalToWild" | "timeAvailable" | "budget" | "effort";

// Every slider starts on a sensible default, so "has a value" says nothing
// about whether the person has actually answered: it counts once they've
// touched it, or once its value differs from that default (which also
// covers a draft restored after a refresh, where the touched set is gone).
function sliderAnswered(
  id: SliderId,
  answers: IntakeAnswers,
  defaults: IntakeAnswers,
  touched: ReadonlySet<string>
): boolean {
  return touched.has(id) || answers[id] !== defaults[id];
}

// What the card wizard adds: labels (visitor's language) of what they picked.
export interface WindowPaneExtras {
  /** The picked activities, in the order picked. */
  interestLabels?: string[];
  /** The picked worlds, shown until specific activities have been picked. */
  domainLabels?: string[];
}

// The wide pane has room for about two lines; add labels until that is full.
const MAX_INTERESTS_TEXT = 78;

function fitLabels(labels: string[]): string | null {
  if (labels.length === 0) return null;
  let text = "";
  let shown = 0;
  for (const label of labels) {
    const next = shown === 0 ? label : `${text}, ${label}`;
    if (shown > 0 && next.length > MAX_INTERESTS_TEXT) break;
    text = next;
    shown += 1;
  }
  if (shown === 0 || text.length > MAX_INTERESTS_TEXT + 12) text = truncateAtWord(labels[0], MAX_INTERESTS_TEXT);
  const more = labels.length - shown;
  return more > 0 ? `${text} +${more}` : text;
}

function interestsPane(answers: IntakeAnswers, dict: Dictionary["intake"], extras: WindowPaneExtras): string | null {
  // Specific picks say more than the worlds they came from.
  const picked = fitLabels(extras.interestLabels ?? []);
  if (picked) return picked;
  const worlds = fitLabels(extras.domainLabels ?? []);
  if (worlds) return worlds;
  return answers.surpriseMe ? dict.discovery.panePlaceholder : null;
}

function joined(parts: (string | null)[], separator = " · "): string | null {
  const present = parts.filter((p): p is string => !!p);
  return present.length > 0 ? present.join(separator) : null;
}

// Every answer the wizard asks for has its own pane, so that nothing a person picks
// leaves the window unchanged. Two per row, or one wide pane for longer answers.
export function buildWindowPanes(
  answers: IntakeAnswers,
  dict: Dictionary["intake"],
  defaults: IntakeAnswers,
  touchedSliders: ReadonlySet<string>,
  extras?: WindowPaneExtras
): WindowPaneValue[] {
  const t = dict.window.panes;
  const slider = (id: SliderId, options: Option[]) =>
    sliderAnswered(id, answers, defaults, touchedSliders) ? labelFor(options, answers[id]) : null;
  const list = (values: string[] | undefined, options: Option[]) =>
    joined((values ?? []).map((v) => labelFor(options, v)), ", ");

  const cards = !!extras;
  const common: WindowPaneValue[] = [
    // The follow-up to the purpose question stands in until they've told us
    // their situation in their own words.
    {
      id: "situation",
      label: t.situation,
      value: clean(answers.situation, MAX_WIDE_PANE_TEXT_LENGTH) ?? clean(answers.purposeFollowUp, MAX_WIDE_PANE_TEXT_LENGTH),
      group: "situation",
      wide: true,
    },
    { id: "purpose", label: t.purpose, value: labelFor(dict.purpose.options, answers.purpose), group: "situation" },
    { id: "age", label: t.age, value: slider("ageCategory", dict.ageCategory.options), group: "about" },
    { id: "where", label: t.where, value: clean(answers.location), group: "about" },
    { id: "distance", label: t.distance, value: slider("searchDistance", dict.searchDistance.options), group: "about" },
    {
      id: "saturday",
      label: t.saturday,
      value: labelFor(dict.freeTimePattern.options, answers.freeTimePattern),
      group: "about",
      wide: true,
    },
    { id: "surprise", label: t.surprise, value: slider("practicalToWild", dict.practicalToWild.options), group: "dials" },
    { id: "effort", label: t.effort, value: slider("effort", dict.effort.options), group: "dials" },
    { id: "time", label: t.time, value: slider("timeAvailable", dict.timeAvailable.options), group: "dials" },
    { id: "budget", label: t.budget, value: slider("budget", dict.budget.options), group: "dials" },
  ];
  const company = { id: "company", label: t.company, value: list(answers.company, dict.company.options), group: "final" as const };
  const limits = (wide: boolean): WindowPaneValue => ({
    id: "limits",
    label: t.limits,
    value: clean(answers.mustHaves, MAX_WIDE_PANE_TEXT_LENGTH),
    group: cards ? "final" : "openness",
    wide,
  });

  if (cards) {
    return [
      ...common,
      { id: "interests", label: t.interests, value: interestsPane(answers, dict, extras), group: "interests", wide: true },
      { id: "how", label: t.how, value: list(answers.socialFormats, dict.discovery.social.options), group: "final" },
      company,
      limits(true),
    ];
  }

  return [
    ...common,
    {
      id: "open",
      label: t.open,
      value: list(answers.solutionTypes, dict.solutionTypes.options),
      group: "openness",
      wide: true,
    },
    { ...company, group: "final" },
    limits(false),
  ];
}
