import { truncateAtWord } from "@/lib/planEcho";
import type { Dictionary, Option } from "@/lib/i18n/dictionaries";
import type { IntakeAnswers } from "@/app/intake/actions";

// What the intake's "Jouw venster" panel shows for the answers given so far.
// Pure and derived — nothing here is stored (see IntakeWindowPanel).

export interface WindowPaneValue {
  id: string;
  label: string;
  value: string | null;
  // Spans both columns of the window (room for a longer answer, e.g. the picks).
  wide?: boolean;
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

function joined(parts: (string | null)[]): string | null {
  const present = parts.filter((p): p is string => !!p);
  return present.length > 0 ? present.join(" · ") : null;
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

  // The follow-up to the purpose question stands in until they've told us
  // their situation in their own words.
  const situation = { id: "situation", label: t.situation, value: clean(answers.situation) ?? clean(answers.purposeFollowUp) };
  const where = { id: "where", label: t.where, value: clean(answers.location) };
  const surprise = { id: "surprise", label: t.surprise, value: slider("practicalToWild", dict.practicalToWild.options) };
  const effort = { id: "effort", label: t.effort, value: slider("effort", dict.effort.options) };
  const companyLabels = (answers.company ?? []).map((v) => labelFor(dict.company.options, v));

  // The card wizard: the picks get a wide pane, and the last page's answers (how, with
  // whom) and the two "how much" dials share panes so that every page fills something.
  if (extras) {
    const socialLabels = (answers.socialFormats ?? []).map((v) => labelFor(dict.discovery.social.options, v));
    return [
      situation,
      where,
      { id: "interests", label: t.interests, value: interestsPane(answers, dict, extras), wide: true },
      { id: "how", label: t.how, value: joined([joined(socialLabels), joined(companyLabels)]) },
      surprise,
      {
        id: "timeBudget",
        label: t.timeBudget,
        value: joined([slider("timeAvailable", dict.timeAvailable.options), slider("budget", dict.budget.options)]),
      },
      effort,
    ];
  }

  return [
    situation,
    where,
    { id: "saturday", label: t.saturday, value: labelFor(dict.freeTimePattern.options, answers.freeTimePattern) },
    surprise,
    { id: "time", label: t.time, value: slider("timeAvailable", dict.timeAvailable.options) },
    { id: "budget", label: t.budget, value: slider("budget", dict.budget.options) },
    effort,
    { id: "company", label: t.company, value: joined(companyLabels) },
  ];
}
