// The output quality gate (Fase 3 of the A-D brief): deterministic checks on a finished book, and the repairs that need no model.
// What it looks for, each with a stable code that is logged per book:
//   exposed_reasoning   the machinery shows: arrows, "Onderweg kwamen we langs ...", "dat leiden wij uit je beelden af"
//   repeated_sentence   the same sentence on more than one idea (it reads as a template)
//   season              something that cannot be done this month (picking flowers in winter, skating in July)
//   type_setting        the type chip contradicts the activity (an "outdoor" idea that is done indoors)
//   time_chip           the time chip contradicts what the idea says about its own length
//   related             an "also in this direction" item that has nothing to do with the idea
//   title_place         the title names a kind of place (a country house, a beach, a rooftop ...) that none of the places found for the idea is
//   coverage_time / coverage_budget   the book does not use the time or budget the person gave
// Pure functions, no network: the repair calls to the model live in qualityRepair.ts and only run for what this file cannot fix.

import type { GeneratedIdeaBook, IdeaBookEntry } from "@/lib/claude/ideaBookTypes";
import { AVAILABLE_HOURS, BUDGET_CAP, parseDurationHours, parseMaxCost } from "@/lib/pdf/ideaContent";
import { getActivity } from "@/lib/discovery/library";
import { isOnlineCity } from "@/lib/maps";
import type { Activity } from "@/lib/discovery/types";

export type QaLocale = "nl" | "en";

export type QaCode =
  | "exposed_reasoning"
  | "repeated_sentence"
  | "season"
  | "type_setting"
  | "time_chip"
  | "related"
  | "online_start"
  | "title_place"
  | "coverage_time"
  | "coverage_budget";

export interface QaContext {
  locale: QaLocale;
  /** 1-12, the month the book is made in (the Netherlands). */
  month: number;
  /** The wizard's budget value ("10", "25", "50", "100", "200", "allin", legacy "free"), if the person gave one. */
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
  /uit (je|jouw) beelden af\b/i,
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

// --- an online start ------------------------------------------------------------------------------------

/**
 * Physical first (Jan, 13 Nov 2026): when an idea lists a place to go to, its first steps visit, call or book. A first step or detail that then sends the person to
 * a download, an app, an account, an online course or lesson, a video or a webshop is an online start. "Open Google Maps" (to find the nearest place) is not.
 * An idea whose only options are online providers starts online on purpose, and is not checked.
 */
const ONLINE_START: RegExp[] = [
  /\b(download|downloaden|installeer|installeren|install)\b/i,
  /\b(maak|maken|create|set up|sign up for|meld je aan voor)\b[^.]{0,30}\b(account|profiel|profile)\b/i,
  /\b(gratis )?account (aan)?maken\b/i,
  /\bonline (cursus|course|les|lessen|class|classes|workshop|module)\b/i,
  /\b(webshop|web shop|bouwpakket bestellen|bestel (een|het|de) [^.]{0,30}(kit|set|pakket|startset))\b/i,
  /\b(video ?(les|lessen|cursus|lessons?|course|tutorial))\b/i,
  /\b(de|een|gratis|free|the|an?) app\b/i,
];

/** Whether an idea lists at least one place that is a town to go to (not an online provider). */
export function hasPhysicalPlace(entry: Pick<IdeaBookEntry, "places" | "location">): boolean {
  const physical = (city: string) => city.trim() !== "" && !isOnlineCity(city);
  return (entry.places ?? []).some((p) => physical(p.city)) || !!(entry.location && physical(entry.location.city));
}

/** The first online start in the idea's first step or details, or null. Only when the idea lists a physical place; otherwise an online start is the way in. */
export function onlineStart(entry: Pick<IdeaBookEntry, "first_action" | "details" | "places" | "location">): { field: string; match: string } | null {
  if (!hasPhysicalPlace(entry)) return null;
  const fields: [string, string][] = [["first_action", entry.first_action ?? ""], ...(entry.details ?? []).map((d, i) => [`details[${i}]`, d] as [string, string])];
  for (const [field, text] of fields) {
    for (const re of ONLINE_START) {
      const m = text.match(re);
      if (m) return { field, match: m[0].trim().slice(0, 40) };
    }
  }
  return null;
}

// --- the title must be true of the places found (Jan, 14 Nov 2026) -------------------------------------------------

/**
 * Kinds of place that a title can claim and that a real venue either is or is not. A title that claims one needs a found place that shows
 * it (in its name or its note); otherwise the title promises something the book cannot deliver (a "high tea in a country house" when the
 * only place found is a café on the heath). Deliberately short and concrete: a false alarm only costs a plainer title.
 */
export const TITLE_PLACE_KINDS: { label: string; title: RegExp; shows: RegExp }[] = [
  { label: "country house", title: /\b(landhuis|landhuizen|landgoed|buitenplaats|kasteel|villa|herenhuis|country house|manor|castle|mansion|estate)\b/i, shows: /(landhuis|landgoed|buitenplaats|kasteel|villa|herenhuis|country house|manor|castle|mansion|estate|slot\b|havezate)/i },
  { label: "farm", title: /\b(boerderij|hoeve|farm|farmhouse)\b/i, shows: /(boerderij|hoeve|farm|boer\b|erf\b)/i },
  { label: "rooftop", title: /\b(dakterras|rooftop|roof terrace)\b/i, shows: /(dakterras|rooftop|roof terrace|dak\b)/i },
  { label: "beach", title: /\b(strand|beach)\b/i, shows: /(strand|beach|boulevard|zee\b|sea\b)/i },
  { label: "heath or woods", title: /\b(op de hei|op de heide|heide|heath|in het bos|in de bossen|woods|forest)\b/i, shows: /(\bhei\b|heide|heath|\bbos\b|bossen|woods|forest|veluwe|duin)/i },
  { label: "church or abbey", title: /\b(kerk|klooster|abdij|church|abbey|monastery)\b/i, shows: /(kerk|klooster|abdij|church|abbey|monastery|kapel|chapel)/i },
  { label: "brewery", title: /\b(brouwerij|brewery)\b/i, shows: /(brouwerij|brewery|bierbrouwer)/i },
  { label: "harbour", title: /\b(jachthaven|haven|harbour|harbor|marina)\b/i, shows: /(jachthaven|haven|harbour|harbor|marina|werf\b)/i },
  { label: "tea house", title: /\b(theehuis|theesalon|tea house|tearoom|tea room)\b/i, shows: /(theehuis|theesalon|tea house|tearoom|tea room|theetuin|tuinkamer)/i },
  { label: "garden room", title: /\b(tuinkamer|serre|orangerie|orangery|conservatory)\b/i, shows: /(tuinkamer|serre|orangerie|orangery|conservatory|kas\b|tuin)/i },
];

/** The text a found place can show a kind of place in: its name, city and note (what the research read about it), and the idea's own location name. */
function placeEvidence(entry: Pick<IdeaBookEntry, "places" | "location">): string {
  const places = (entry.places ?? []).map((p) => `${p.name} ${p.city} ${p.note}`);
  if (entry.location) places.push(`${entry.location.name} ${entry.location.city}`);
  return places.join(" | ");
}

/** Words after "in / op / bij / at ..." that say nothing about a kind of place. */
const SETTING_STOP = new Set(["buurt", "stad", "natuur", "regio", "omgeving", "avond", "ochtend", "middag", "weekend", "groep", "groepje", "kleine", "vrije", "eigen", "tempo", "nature", "evening", "morning", "group", "small", "area", "town", "city", "week", "dag", "sfeer", "style", "kring"]);

/** The setting a title names after a preposition ("in a wine cellar" gives "wine cellar"), or null. */
export function titleSetting(title: string): string | null {
  const m = title.match(/\b(?:in|op|bij|aan|onder|at|on|by|inside|under)\s+(?:(?:een|de|het|the|a|an)\s+)?([^,.:;]+)$/i);
  return m ? m[1].trim() : null;
}

/** The 5-letter stems of the words of five letters or more, lower case. */
function stemsOf(text: string): Set<string> {
  return new Set((text.toLowerCase().match(/[\p{L}]{5,}/gu) ?? []).map((w) => w.slice(0, 5)));
}

/**
 * The kinds of place the title claims that no found place shows. Only for an idea that has found places (without any, the writer is told to
 * keep to the plain activity, and there is nothing to compare with).
 */
export function titlePlaceConflicts(entry: Pick<IdeaBookEntry, "title" | "places" | "location">): string[] {
  const evidence = placeEvidence(entry);
  if (!evidence.replace(/[|\s]/g, "")) return [];
  const kinds = TITLE_PLACE_KINDS.filter((k) => k.title.test(entry.title) && !k.shows.test(evidence)).map((k) => k.label);
  // Any other setting the title names after "in / op / bij / at" has to turn up in what the found places say (their name, city or note).
  const setting = titleSetting(entry.title);
  if (setting && kinds.length === 0) {
    const have = stemsOf(evidence);
    const unsupported = (setting.match(/[\p{L}]{5,}/gu) ?? []).filter((w) => !SETTING_STOP.has(w.toLowerCase()) && !have.has(w.toLowerCase().slice(0, 5)));
    if (unsupported.length > 0) kinds.push(`"${setting}"`);
  }
  return kinds;
}

/** A plain title that is true of the first found place: the activity's own name, "bij" / "at" the place (or in its city when the name is long). */
export function plainTitleFor(entry: Pick<IdeaBookEntry, "places" | "location" | "activity_id" | "title" | "reasons">, locale: QaLocale): string {
  // A combination ("hybrid:high-tea") is found through its first half: that half is what the places are, so that is the plain title.
  const hybridId = (entry.reasons ?? []).find((r) => r.startsWith("hybrid:"))?.slice("hybrid:".length);
  const activityId = hybridId || entry.activity_id;
  const activity = activityId ? getActivity(activityId) : undefined;
  // The label of an activity can carry a clause ("Detective box: solving a case at the table"): the plain title is the part before it.
  const base = activity ? activity.label[locale].split(/s*[:—–]s*/)[0] : entry.title;
  const first = (entry.places ?? [])[0];
  // The place the idea itself names (its location) when there is one, else the first found place.
  const name = entry.location?.name || first?.name || "";
  const city = entry.location?.city || first?.city || "";
  const at = locale === "nl" ? "bij" : "at";
  if (name && name.toLowerCase().includes(base.toLowerCase())) return name.length <= 52 ? name : base;
  if (name && `${base} ${at} ${name}`.length <= 52) return `${base} ${at} ${name}`;
  if (city && !isOnlineCity(city)) return `${base} in ${city}`;
  return base;
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
    const online = onlineStart(entry);
    if (online) push("online_start", where, `${online.field}: "${online.match}"`, true);
    const titleKinds = titlePlaceConflicts(entry);
    if (titleKinds.length > 0) push("title_place", where, `the title "${entry.title}" claims ${titleKinds.join(", ")}, which none of the found places shows`, false);
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
    if (titlePlaceConflicts(next).length > 0) {
      next = { ...next, title: plainTitleFor(next, locale) };
      fixes.push(`${where}:title_from_found_place`);
    }
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
