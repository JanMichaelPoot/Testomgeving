import { truncateAtWord } from "@/lib/planEcho";
import type { Dictionary, Option } from "@/lib/i18n/dictionaries";
import type { IntakeAnswers } from "@/app/intake/actions";

// What the intake's "Jouw venster" panel shows for the answers given so far.
// Pure and derived — nothing here is stored (see IntakeWindowPanel).

export interface WindowPaneValue {
  id: string;
  label: string;
  value: string | null;
}

const MAX_PANE_TEXT_LENGTH = 48;

// Rough time still needed after finishing page `pageIndex` (0-based) of the
// 5-page wizard, in minutes — a constant per page, not a measurement.
const MINUTES_LEFT_BY_PAGE = [3, 2, 2, 1, 0] as const;

export function minutesLeft(pageIndex: number): number {
  return MINUTES_LEFT_BY_PAGE[Math.min(Math.max(pageIndex, 0), MINUTES_LEFT_BY_PAGE.length - 1)];
}

function clean(text: string | undefined): string | null {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  return t ? truncateAtWord(t, MAX_PANE_TEXT_LENGTH) : null;
}

function labelFor(options: Option[], value: string | undefined): string | null {
  if (!value) return null;
  return options.find((o) => o.value === value)?.label ?? null;
}

type SliderId = "practicalToWild" | "timeAvailable" | "budget" | "effort";

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

// The card wizard swaps the "on a Saturday" pane for what they picked.
export interface WindowPaneExtras {
  /** Labels (visitor's language) of the picked activities, in the order picked. */
  interestLabels?: string[];
}

function interestsPane(answers: IntakeAnswers, dict: Dictionary["intake"], labels: string[]): string | null {
  if (labels.length > 0) {
    const shown = labels.slice(0, 2).join(", ");
    const more = labels.length > 2 ? ` +${labels.length - 2}` : "";
    return truncateAtWord(`${shown}${more}`, MAX_PANE_TEXT_LENGTH);
  }
  return answers.surpriseMe ? dict.discovery.panePlaceholder : null;
}

export function buildWindowPanes(
  answers: IntakeAnswers,
  dict: Dictionary["intake"],
  defaults: IntakeAnswers,
  touchedSliders: ReadonlySet<string>,
  extras?: WindowPaneExtras
): WindowPaneValue[] {
  const t = dict.window.panes;
  const slider = (id: SliderId, options: Option[]) =>
    sliderAnswered(id, answers, defaults, touchedSliders)
      ? labelFor(options, answers[id])
      : null;

  return [
    // The follow-up to the purpose question stands in until they've told us
    // their situation in their own words.
    { id: "situation", label: t.situation, value: clean(answers.situation) ?? clean(answers.purposeFollowUp) },
    { id: "where", label: t.where, value: clean(answers.location) },
    extras?.interestLabels
      ? { id: "interests", label: t.interests, value: interestsPane(answers, dict, extras.interestLabels) }
      : { id: "saturday", label: t.saturday, value: labelFor(dict.freeTimePattern.options, answers.freeTimePattern) },
    { id: "surprise", label: t.surprise, value: slider("practicalToWild", dict.practicalToWild.options) },
    { id: "time", label: t.time, value: slider("timeAvailable", dict.timeAvailable.options) },
    { id: "budget", label: t.budget, value: slider("budget", dict.budget.options) },
    { id: "effort", label: t.effort, value: slider("effort", dict.effort.options) },
    { id: "secret", label: t.secret, value: clean(answers.personalReflection) },
  ];
}
