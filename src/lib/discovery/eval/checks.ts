import { repeatedOpenings } from "@/lib/claude/ideaFill";
import type { GeneratedIdeaBook, IdeaBookEntry } from "@/lib/claude/ideaBookTypes";
import { getActivity } from "@/lib/discovery/library";
import { evaluate, type Run } from "@/lib/discovery/engine/evaluate";
import type { EngineLibrary } from "@/lib/discovery/engine/select";
import { photoCategoryFor } from "@/lib/discovery/engine/photo";
import type { Activity } from "@/lib/discovery/types";

// Deterministic checks of the evaluation harness. Two layers:
//   - checkSeedRun: on what the selection engine returned for one profile (free, runs in `npm test`);
//   - checkBook: on a finished, generated book (used by `--full` runs and tested with mock books).
// A finding with severity "error" fails a test; "warn" is reported and counted but never fails.

export interface Finding {
  check: string;
  severity: "error" | "warn";
  profile?: string;
  where?: string;
  message: string;
}

/** Floors for the spread of one book. The baseline averages are 6.0 worlds and about 5 photo categories. */
export const MIN_DOMAINS_PER_BOOK = 4;
export const MIN_PHOTO_CATEGORIES_PER_BOOK = 3;

const normalise = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** `lookup` resolves an activity id; it is the shipped library unless a test plants something else. */
export function checkSeedRun(run: Run, lib: EngineLibrary, lookup: (id: string) => Activity | undefined = getActivity): Finding[] {
  const out: Finding[] = [];
  const profile = run.profile.id;
  const push = (check: string, message: string, severity: Finding["severity"] = "error") => out.push({ check, severity, profile, message });

  // 1. Hard limits. engine/evaluate.ts writes them out again from the input, so a bug in the engine's own filter cannot hide itself.
  const report = evaluate([run], lib);
  for (const [rule, list] of Object.entries(report.violations)) for (const m of list) push(`hard:${rule}`, m);

  const seeds = run.result.seeds;
  const activities = seeds.map((s) => lookup(s.activityId));
  if (activities.some((a) => !a)) push("seeds:unknown_activity", "a seed refers to an activity that is not in the library");
  const known = activities.filter((a): a is NonNullable<typeof a> => !!a);

  // 2. Duplicates: the same id, or the same name once spelling, accents and punctuation are ignored.
  const ids = new Set<string>();
  for (const s of seeds) {
    if (ids.has(s.activityId)) push("duplicates:id", `activity ${s.activityId} appears twice in one book`);
    ids.add(s.activityId);
  }
  const names = new Map<string, string>();
  for (const a of known) {
    for (const lang of ["nl", "en"] as const) {
      const key = `${lang}:${normalise(a.label[lang])}`;
      const other = names.get(key);
      if (other && other !== a.id) push("duplicates:name", `${a.id} and ${other} have the same ${lang} name`);
      names.set(key, a.id);
    }
  }

  // 3. Spread across worlds and photo categories.
  const domains = new Set(known.map((a) => a.domain)).size;
  const categories = new Set(known.map((a) => photoCategoryFor(a))).size;
  if (known.length >= 6 && domains < MIN_DOMAINS_PER_BOOK) push("spread:domains", `only ${domains} worlds in one book (minimum ${MIN_DOMAINS_PER_BOOK})`);
  if (known.length >= 6 && categories < MIN_PHOTO_CATEGORIES_PER_BOOK) push("spread:categories", `only ${categories} photo categories in one book (minimum ${MIN_PHOTO_CATEGORIES_PER_BOOK})`);

  // 4. Exactly one wildcard, and seven seeds unless the pool was tiny (the engine notes that itself).
  if (seeds.filter((s) => s.direction === "wildcard").length !== 1 && !run.result.notes.includes("pool_small")) push("seeds:wildcard", "a book needs exactly one wildcard");
  if (seeds.length < 7 && !run.result.notes.includes("pool_small")) push("seeds:count", `${seeds.length} seeds instead of 7`, "warn");
  return out;
}

// --- book level ----------------------------------------------------------------------------

const VAGUE = /\b(overweeg|consider|kijk eens|look online|zoek online naar iets|have a look|take a look around)\b/i;

/** "Do this in 60 seconds": at least four words, nothing vague, and something to anchor on (a site, a quoted term, a number or a name). */
export function isConcreteAction(text: string): boolean {
  const t = text.trim();
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length < 4 || words.length > 45 || VAGUE.test(t)) return false;
  const anchored =
    /https?:\/\/|\b[a-z0-9-]+\.(nl|com|org|eu|be|de|net|io)\b/i.test(t) || /["“”‘’«»']/.test(t) || /\d/.test(t) || words.slice(1).some((w) => /^[A-ZÀ-Ý]/.test(w));
  return anchored;
}

const PRICE = /(€\s?\d|\b\d+(?:[.,]\d+)?\s?(?:euro|eur)\b)/gi;
const HOURS =
  /(\b\d{1,2}[:.]\d{2}\s?(?:-|–|tot|to|until)\s?\d{1,2}[:.]\d{2}\b|\b(?:openingstijden|opening hours|geopend van|open van|open from)\b|\b(?:ma|maandag|mon|monday)\s?(?:t\/m|-|–|to)\s?(?:vr|vrijdag|fri|friday|zo|zondag|sun|sunday)\b)/gi;
const ADDRESS = /\b[A-ZÀ-Ý][\p{L}'’-]+(?:straat|laan|weg|plein|gracht|kade|singel|dreef|steeg)\s+\d+[a-z]?\b/gu;

/** The only facts that come from research: the real places of this idea and the address of the chosen location. */
function sourceText(entry: IdeaBookEntry): string {
  return [...(entry.places ?? []).map((p) => `${p.name} ${p.note ?? ""}`), entry.location?.name ?? "", entry.location?.address ?? ""].join(" ").toLowerCase();
}

function proseOf(entry: IdeaBookEntry): [string, string][] {
  return [
    ["intro", entry.intro],
    ["why_it_fits", entry.why_it_fits],
    ["first_action", entry.first_action],
    ...entry.details.map((d, i): [string, string] => [`details[${i}]`, d]),
    ...entry.requirements.map((r, i): [string, string] => [`requirements[${i}]`, r]),
    // B5: the activity-specific lines are prose as well; an exact price or opening time in them needs a source too.
    ...(["timeline", "takeaways", "suggestions"] as const).flatMap((k) => (entry.fill?.[k] ?? []).map((t, i): [string, string] => [`fill.${k}[${i}]`, t])),
  ];
}

export function checkEntry(entry: IdeaBookEntry, label: string): Finding[] {
  const out: Finding[] = [];
  const push = (check: string, message: string, severity: Finding["severity"] = "error", where?: string) => out.push({ check, severity, where: where ?? label, message });

  if (!entry.first_action?.trim()) push("first_action:missing", "no first action");
  else if (!isConcreteAction(entry.first_action)) push("first_action:vague", `first action is not concrete: "${entry.first_action.slice(0, 80)}"`, "warn");

  const sources = sourceText(entry);
  for (const [field, text] of proseOf(entry)) {
    for (const m of text.matchAll(PRICE)) {
      const figure = (m[0].match(/\d+(?:[.,]\d+)?/) ?? [""])[0];
      if (!sources.includes(figure)) push("facts:price_without_source", `"${m[0]}" in ${field} has no source in this idea's research`, "error", `${label}.${field}`);
    }
    for (const m of text.matchAll(HOURS)) {
      if (!sources.includes(m[0].toLowerCase())) push("facts:hours_without_source", `opening times "${m[0]}" in ${field} have no source`, "error", `${label}.${field}`);
    }
    for (const m of text.matchAll(ADDRESS)) {
      if (!sources.includes(m[0].toLowerCase())) push("facts:address_without_source", `address "${m[0]}" in ${field} has no source`, "error", `${label}.${field}`);
    }
  }
  return out;
}

export function checkBook(book: GeneratedIdeaBook, profile?: string): Finding[] {
  const entries: [IdeaBookEntry, string][] = [...book.ideas.map((e, i): [IdeaBookEntry, string] => [e, `idea${i + 1}`]), [book.wildcard, "wildcard"]];
  const out = entries.flatMap(([e, label]) => checkEntry(e, label));
  const seen = new Set<string>();
  for (const [e, label] of entries) {
    if (!e.activity_id) continue;
    if (seen.has(e.activity_id)) out.push({ check: "duplicates:id", severity: "error", where: label, message: `activity ${e.activity_id} appears twice in the book` });
    seen.add(e.activity_id);
  }
  // B5: one opening word on many of the "make it yours" suggestions reads as a template (a warning, never an error).
  for (const r of repeatedOpenings([...book.ideas, book.wildcard].map((e) => e.fill))) {
    out.push({ check: "fill:repetitive_opening", severity: "warn", where: "book", message: `${r.count} suggestions start with "${r.word}"` });
  }
  return out.map((f) => ({ ...f, profile }));
}
