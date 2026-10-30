// The output quality gate (Fase 3 of the A-D brief): deterministic checks on a finished book, and the repairs that need no model.
// What it looks for, each with a stable code that is logged per book:
//   exposed_reasoning   the machinery shows: arrows, "Onderweg kwamen we langs ...", "dat leiden wij uit je beelden af"
//   repeated_sentence   the same sentence on more than one idea (it reads as a template)
//   season              something that cannot be done this month (picking flowers in winter, skating in July)
//   type_setting        the type chip contradicts the activity (an "outdoor" idea that is done indoors)
//   time_chip           the time chip contradicts what the idea says about its own length
//   related             an "also in this direction" item that has nothing to do with the idea
//   coverage_time / coverage_budget   the book does not use the time or budget the person gave
// Pure functions, no network: the repair calls to the model live in qualityRepair.ts and only run for what this file cannot fix.

import type { GeneratedIdeaBook, IdeaBookEntry } from "@/lib/claude/ideaBookTypes";
import { AVAILABLE_HOURS, BUDGET_CAP, parseDurationHours, parseMaxCost } from "@/lib/pdf/ideaContent";
import { getActivity } from "@/lib/discovery/library";
import type { Activity } from "@/lib/discovery/types";

export type QaLocale = "nl" | "en";

export type QaCode =
  | "exposed_reasoning"
  | "repeated_sentence"
  | "season"
  | "type_setting"
  | "time_chip"
  | "related"
  | "coverage_time"
  | "coverage_budget";

export interface QaContext {
  locale: QaLocale;
  /** 1-12, the month the book is made in (the Netherlands). */
  month: number;
  /** The wizard's budget value ("25", "100", "allin", legacy "free"), if the person gave one. */
  budget?: string;
  /** The wizard's time value ("hour", "halfday", "fullday", "weekend"), if given. */
  timeAvailable?: string;
}

export interface QaIssue {
  code: QaCode;
  /** "idea1" ... "idea6", "wildcard", or "book" for something that spans the book. */
  where: string;
  detail: string;
  /** Whether a model call is needed to fix it (false = the deterministic repair can). */
  needsRewrite: boolean;
}

export function entriesOf(book: GeneratedIdeaBook): [IdeaBookEntry, string][] {
  return [...book.ideas.map((e, i): [IdeaBookEntry, string] => [e, `idea${i + 1}`]), [book.wildcard, "wildcard"]];
}

// --- text of an idea --------------------------------------------------------------------------

/** Every sentence-bearing field of an idea, with a path so a repair can write it back. */
export function proseFields(entry: IdeaBookEntry): [string, string][] {
  const out: [string, string][] = [
    ["intro", entry.intro],
    ["why_it_fits", entry.why_it_fits],
    ["first_action", entry.first_action],
    ...entry.details.map((d, i): [string, string] => [`details[${i}]`, d]),
    ...entry.requirements.map((r, i): [string, string] => [`requirements[${i}]`, r]),
  ];
  if (entry.feels_like) out.push(["feels_like", entry.feels_like]);
  if (entry.next_step) out.push(["next_step", entry.next_step]);
  entry.sizes?.forEach((s, i) => out.push([`sizes[${i}].description`, s.description]));
  for (const k of ["timeline", "takeaways", "suggestions"] as const) entry.fill?.[k]?.forEach((t, i) => out.push([`fill.${k}[${i}]`, t]));
  return out.filter(([, text]) => typeof text === "string" && text.trim().length > 0);
}

export function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?…])\s+(?=[A-ZÀ-Ý"“‘'(€\d])/u)
    .map((s) => s.trim())
    .filter(Boolean);
}

export const normalizeSentence = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// --- exposed reasoning --------------------------------------------------------------------------

const ARROWS = /\s*(?:→|➔|➜|⇒|->|=>)\s*/g;
const EXPOSED_PHRASES: RegExp[] = [
  /onderweg kwamen we langs/i,
  /dat leiden wij .{0,40}af/i,
  /(het is )?niet iets dat je zelf koos/i,
  /uit (je|jouw) beelden af/i,
  /dit komt nergens uit je beelden/i,
  /we (leiden|leidden) (dit|dat) af/i,
  /reached from (their|your|the) images/i,
  /not (something )?(you|they) (picked|chose) (yourself|themselves)/i,
  /we (derive|derived|infer|inferred) (this|that)/i,
  /(from|in) (your|the) images we (read|inferred)/i,
];

/** What of the machinery shows in `text`; an empty list is clean. */
export function exposedReasoning(text: string): string[] {
  const hits: string[] = [];
  if (/[→➔➜⇒]|->|=>/.test(text)) hits.push("arrow");
  for (const re of EXPOSED_PHRASES) if (re.test(text)) hits.push(re.source.slice(0, 40));
  return hits;
}

/** The text without the machinery: arrows become a comma, a sentence that exposes its reasoning is dropped. */
export function stripExposed(text: string): string {
  const arrowless = text.replace(ARROWS, ", ").replace(/,\s*,/g, ",");
  const kept = splitSentences(arrowless).filter((sentence) => !EXPOSED_PHRASES.some((re) => re.test(sentence)));
  return kept.join(" ").trim();
}

// --- repeated sentences -------------------------------------------------------------------------

/** The shortest sentence that counts as "the same sentence": five words, so "Neem een jas mee." may repeat. */
const MIN_WORDS = 5;

export function repeatedSentences(book: GeneratedIdeaBook): { sentence: string; where: string[] }[] {
  const seen = new Map<string, { sentence: string; where: Set<string> }>();
  for (const [entry, where] of entriesOf(book)) {
    for (const [, text] of proseFields(entry)) {
      for (const sentence of splitSentences(text)) {
        if (sentence.split(/\s+/).length < MIN_WORDS) continue;
        const key = normalizeSentence(sentence);
        const row = seen.get(key) ?? { sentence, where: new Set<string>() };
        row.where.add(where);
        seen.set(key, row);
      }
    }
  }
  return [...seen.values()].filter((r) => r.where.size > 1).map((r) => ({ sentence: r.sentence, where: [...r.where] }));
}

// --- season ---------------------------------------------------------------------------------------

interface SeasonalTerm {
  pattern: RegExp;
  /** The months (1-12) in which it is fine to suggest. */
  months: number[];
  label: string;
}

const range = (from: number, to: number) => {
  const out: number[] = [];
  for (let m = from; ; m = (m % 12) + 1) {
    out.push(m);
    if (m === to) break;
  }
  return out;
};

/** Terms that only make sense in part of the year. Deliberately short and unambiguous: a false alarm costs a rewrite. */
export const SEASONAL_TERMS: SeasonalTerm[] = [
  { pattern: /\b(bloemen plukken|bloemen zelf plukken|pick(ing)? flowers|zelfpluk(tuin)?|pick[- ]your[- ]own)\b/i, months: range(5, 9), label: "picking flowers or fruit" },
  { pattern: /\b(aardbeien (plukken|zoeken)|strawberry picking|kersen plukken|cherry picking)\b/i, months: range(5, 8), label: "picking soft fruit" },
  { pattern: /\b(open water zwemmen|zwemmen in (open water|zee|een meer|het meer|een plas)|buitenzwemmen|outdoor swim|swim in (the )?(sea|lake|open water))\b/i, months: range(5, 9), label: "outdoor swimming" },
  { pattern: /\b(zonnebaden|sunbathing|zonnebank)\b/i, months: range(5, 9), label: "sunbathing" },
  { pattern: /\b(schaatsen|ice skating|schaatsbaan|natuurijs)\b/i, months: [11, 12, 1, 2, 3], label: "ice skating" },
  { pattern: /\b(kerstmarkt|christmas market|glühwein|gluhwein|oliebollen)\b/i, months: [11, 12, 1], label: "a winter market" },
  { pattern: /\b(paddenstoelen (zoeken|plukken)|mushroom (foraging|picking|hunting))\b/i, months: [9, 10, 11], label: "foraging mushrooms" },
  { pattern: /\b(tulpen(velden)?|tulip fields?|narcissen|daffodils)\b/i, months: [3, 4, 5], label: "spring bulbs" },
  { pattern: /\b(zonnebloemen|sunflowers?)\b/i, months: [7, 8, 9], label: "sunflowers" },
  { pattern: /\b(herfstkleuren|autumn colou?rs|herfstwandeling)\b/i, months: [9, 10, 11], label: "autumn colours" },
  { pattern: /\b(sneeuwwandeling|snow walk|rodelen|sledding|langlaufen|cross-country ski)\b/i, months: [12, 1, 2], label: "snow" },
  { pattern: /\b(sinterklaas|pakjesavond)\b/i, months: [11, 12], label: "Sinterklaas" },
];

export function seasonProblems(text: string, month: number): string[] {
  return SEASONAL_TERMS.filter((t) => t.pattern.test(text) && !t.months.includes(month)).map((t) => t.label);
}

// --- chips: type, setting, time ---------------------------------------------------------------------

const OUTDOOR_CATEGORIES = new Set(["nature_outdoor"]);

/** A type chip that says "outdoors" for an activity that is done indoors. */
export function typeSettingConflict(entry: IdeaBookEntry, activity: Activity | undefined): string | null {
  if (!activity || activity.setting === null || activity.setting === undefined) return null;
  if (activity.setting === "indoor" && OUTDOOR_CATEGORIES.has(entry.photo_category)) {
    return `the type says outdoors (${entry.photo_category}) but "${activity.id}" is done indoors`;
  }
  if (activity.setting === "outdoor" && entry.photo_category === "home_cozy") {
    return `the type says at home (${entry.photo_category}) but "${activity.id}" is done outdoors`;
  }
  return null;
}

// Hours a duration class can hold (src/lib/discovery/types.ts: 1 under an hour, 2 one to three hours, 3 half a day or more, 4 multi-day).
const CLASS_HOURS: Record<number, [number, number]> = { 1: [0, 1.5], 2: [0.5, 4], 3: [3, 10], 4: [8, 400] };
const CLASS_TEXT: Record<QaLocale, Record<number, string>> = {
  nl: { 1: "Minder dan een uur", 2: "Een paar uur", 3: "Een halve dag", 4: "Een weekend of langer" },
  en: { 1: "Under an hour", 2: "A few hours", 3: "Half a day", 4: "A weekend or longer" },
};

/** A time chip that cannot be right for this activity; null when it agrees, or when either side is unknown. */
export function timeChipConflict(entry: IdeaBookEntry, activity: Activity | undefined): { hours: number; expected: [number, number] } | null {
  const klass = activity?.duration;
  if (!klass) return null;
  const hours = parseDurationHours(entry.practical.duration);
  if (hours === null) return null;
  const [lo, hi] = CLASS_HOURS[klass];
  return hours < lo || hours > hi ? { hours, expected: [lo, hi] } : null;
}

export function durationTextFor(activity: Activity, locale: QaLocale): string | null {
  return activity.duration ? CLASS_TEXT[locale][activity.duration] : null;
}

// --- "also in this direction" -------------------------------------------------------------------------

/** A related item shares at least one real tag, or its sub-domain, with the idea it hangs on. */
export function relatedIsPlausible(ideaActivity: Activity | undefined, relatedId: string): boolean {
  const other = getActivity(relatedId);
  if (!ideaActivity || !other) return true; // nothing to judge by
  if (other.sub === ideaActivity.sub) return true;
  return other.tags.some((t) => ideaActivity.tags.includes(t));
}

// --- coverage of what the person gave -------------------------------------------------------------------

export interface Coverage {
  /** Ideas (any of its three sizes) that fill at least half of the time the person has. */
  timeFilled: number;
  timeApplicable: boolean;
  /** Ideas whose price for any size sits between 40% and 100% of the budget. */
  budgetUsed: number;
  budgetApplicable: boolean;
}

export const MIN_TIME_FILLED = 1;
export const MIN_BUDGET_USED = 2;

function costsOf(entry: IdeaBookEntry): string[] {
  return [entry.practical.estimated_cost, ...(entry.sizes ?? []).map((s) => s.estimated_cost)].filter(Boolean);
}
function durationsOf(entry: IdeaBookEntry): string[] {
  return [entry.practical.duration, ...(entry.sizes ?? []).map((s) => s.duration)].filter(Boolean);
}

export function coverageOf(book: GeneratedIdeaBook, ctx: Pick<QaContext, "budget" | "timeAvailable">): Coverage {
  const entries = entriesOf(book).map(([e]) => e);
  const available = ctx.timeAvailable ? AVAILABLE_HOURS[ctx.timeAvailable] : undefined;
  const cap = ctx.budget ? BUDGET_CAP[ctx.budget === "free" ? "25" : ctx.budget] : undefined;
  const timeApplicable = available !== undefined;
  const budgetApplicable = cap !== undefined && Number.isFinite(cap) && cap > 0;
  const timeFilled = timeApplicable
    ? entries.filter((e) =>
        durationsOf(e).some((d) => {
          const h = parseDurationHours(d);
          return h !== null && h >= available! * 0.5 && h <= available!;
        }),
      ).length
    : 0;
  const budgetUsed = budgetApplicable
    ? entries.filter((e) =>
        costsOf(e).some((c) => {
          const max = parseMaxCost(c);
          return max !== null && max >= cap! * 0.4 && max <= cap!;
        }),
      ).length
    : 0;
  return { timeFilled, timeApplicable, budgetUsed, budgetApplicable };
}

// --- the whole gate ---------------------------------------------------------------------------------------

export function qaBook(book: GeneratedIdeaBook, ctx: QaContext): QaIssue[] {
  const issues: QaIssue[] = [];
  const push = (code: QaCode, where: string, detail: string, needsRewrite: boolean) => issues.push({ code, where, detail, needsRewrite });

  for (const [entry, where] of entriesOf(book)) {
    const activity = entry.activity_id ? getActivity(entry.activity_id) : undefined;
    const all = [...proseFields(entry), ["title", entry.title] as [string, string]];
    for (const [field, text] of all) {
      const exposed = exposedReasoning(text);
      if (exposed.length > 0) push("exposed_reasoning", where, `${field}: ${exposed.join(", ")}`, false);
      const season = seasonProblems(text, ctx.month);
      if (season.length > 0) push("season", where, `${field}: ${season.join(", ")} (month ${ctx.month})`, true);
    }
    const typeProblem = typeSettingConflict(entry, activity);
    if (typeProblem) push("type_setting", where, typeProblem, false);
    const timeProblem = timeChipConflict(entry, activity);
    if (timeProblem) push("time_chip", where, `says ${timeProblem.hours} h, an idea of this kind takes ${timeProblem.expected[0]}-${timeProblem.expected[1]} h`, false);
    for (const r of entry.related ?? []) {
      if (!relatedIsPlausible(activity, r.id)) push("related", where, `${r.id} has nothing in common with ${entry.activity_id}`, false);
    }
  }
  for (const r of repeatedSentences(book)) push("repeated_sentence", r.where.join("+"), `"${r.sentence.slice(0, 80)}"`, true);

  const coverage = coverageOf(book, ctx);
  if (coverage.timeApplicable && coverage.timeFilled < MIN_TIME_FILLED) push("coverage_time", "book", "no idea fills the time the person has", false);
  if (coverage.budgetApplicable && coverage.budgetUsed < MIN_BUDGET_USED) push("coverage_budget", "book", `${coverage.budgetUsed} ideas use 40-100% of the budget (wanted ${MIN_BUDGET_USED})`, false);
  return issues;
}

// --- repairs that need no model -------------------------------------------------------------------------------

function mapEntry(entry: IdeaBookEntry, fn: (text: string) => string): IdeaBookEntry {
  const sameFill = entry.fill
    ? { timeline: entry.fill.timeline.map(fn), takeaways: entry.fill.takeaways.map(fn), suggestions: entry.fill.suggestions.map(fn) }
    : undefined;
  return {
    ...entry,
    title: fn(entry.title),
    intro: fn(entry.intro),
    why_it_fits: fn(entry.why_it_fits),
    first_action: fn(entry.first_action),
    details: entry.details.map(fn),
    requirements: entry.requirements.map(fn),
    ...(entry.feels_like ? { feels_like: fn(entry.feels_like) } : {}),
    ...(entry.next_step ? { next_step: fn(entry.next_step) } : {}),
    ...(entry.sizes ? { sizes: entry.sizes.map((s) => ({ ...s, description: fn(s.description) })) } : {}),
    ...(sameFill ? { fill: sameFill } : {}),
  };
}

/**
 * The fixes that are safe without asking a model: the machinery is taken out of the text, a time chip that contradicts the
 * activity is replaced by the activity's own duration, an unrelated "also in this direction" item is dropped.
 */
export function autoFix(book: GeneratedIdeaBook, locale: QaLocale): { book: GeneratedIdeaBook; fixes: string[] } {
  const fixes: string[] = [];
  const fix = (entry: IdeaBookEntry, where: string): IdeaBookEntry => {
    let next = mapEntry(entry, (t) => {
      if (exposedReasoning(t).length === 0) return t;
      const cleaned = stripExposed(t);
      if (cleaned !== t) fixes.push(`${where}:exposed_reasoning_removed`);
      return cleaned;
    });
    const activity = entry.activity_id ? getActivity(entry.activity_id) : undefined;
    if (activity && timeChipConflict(next, activity)) {
      const text = durationTextFor(activity, locale);
      if (text) {
        next = { ...next, practical: { ...next.practical, duration: text } };
        fixes.push(`${where}:time_chip_from_activity`);
      }
    }
    if (next.related && next.related.length > 0) {
      const kept = next.related.filter((r) => relatedIsPlausible(activity, r.id));
      if (kept.length !== next.related.length) {
        fixes.push(`${where}:related_dropped`);
        next = { ...next, related: kept.length > 0 ? kept : undefined };
        if (!next.related) delete next.related;
      }
    }
    return next;
  };
  const ideas = book.ideas.map((e, i) => fix(e, `idea${i + 1}`));
  const wildcard = fix(book.wildcard, "wildcard");
  return { book: { ...book, ideas, wildcard }, fixes };
}

/** The labels of the issues that a model has to rewrite, grouped by idea ("idea3" -> [issues]). */
export function rewriteTargets(issues: QaIssue[]): Map<string, QaIssue[]> {
  const out = new Map<string, QaIssue[]>();
  for (const issue of issues) {
    if (!issue.needsRewrite) continue;
    // A repeated sentence names several ideas: rewrite every one but the first, so the first keeps its sentence.
    const wheres = issue.code === "repeated_sentence" ? issue.where.split("+").slice(1) : [issue.where];
    for (const w of wheres) out.set(w, [...(out.get(w) ?? []), issue]);
  }
  return out;
}
