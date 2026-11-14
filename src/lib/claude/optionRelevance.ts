import { ALL_ACTIVITIES, getActivity } from "@/lib/discovery/library";
import { searchHint } from "@/lib/discovery/searchHints";
import type { Activity } from "@/lib/discovery/types";
import type { LocalOption } from "@/lib/claude/localResearch";

// Is a found place really about the activity it was found for? (Jan, 14 Nov 2026: a book offered two make-up courses as "real places" for "Een avond je
// eigen bordspel schetsen". It must never happen again.)
//
// How it happened: the online round asks for several activities in ONE call. For two of them it found nothing that fits, and the model put the same
// two make-up courses (found for the make-up idea) under the board-game idea as well. Nothing checked that an option belongs to its activity: the
// answer was verified for existing (the website answers) and for being open, not for being RIGHT, cached for 30 days and written into the book.
//
// The check is local and free. What an activity is called and how it is looked for (its names in both languages, its aliases and the search terms the research
// is given; not its usual-way-in sentence, which is full of words like "make" and "three") is compared with what an option says about itself (name, what it is, note, site):
//   1. an option that shares a word with its activity is about it;
//   2. one that shares nothing is refused when it clearly belongs to ANOTHER activity of the library, one from another sub-group (the make-up course under
//      the board game; a woodworking course under painting). A place of a kindred activity stays (the same sub-group, or the same world with two abstract connections in
//      common: a salsa school for ballroom, a boulder hall for a climbing park),
//      and so does one that matches nothing in the library at all (a basilica for "monuments": the benefit of the doubt, a place need not echo its activity);
//   3. an ONLINE provider is named after what it teaches or sells, so for it the whole text counts when looking for the other activity; for a physical place only
//      the name and what it says it is (its note is about hours and prices);
//   4. the same option given to two activities of one answer stays only with the one it fits best.
// A refused option leaves its idea without one, which the pipeline already repairs (another round, another idea, or an honest "look it up yourself").
// Applied when an answer is read (fresh, cached or borrowed from another radius) and once more where the book takes its options (seedResearch in generateFromSeeds.ts).

/** Words that name a kind of provider or of lesson, a place or a function word: they prove nothing about what is taught, offered or visited. */
const GENERIC = new Set(
  (
    "cursus cursussen workshop workshops proefles proeflessen les lessen leren leer kennismaking kennismakingsles beginners beginner beginnerscursus starters starter " +
    "online webshop webwinkel atelier ateliers studio studios club clubs vereniging verenigingen school scholen academie academy instituut institute centrum center centre " +
    "course courses class classes lesson lessons learn learning intro introduction trial open dag middag avond weekend nederland holland amsterdam utrecht rotterdam " +
    "voor naar door over onder tussen binnen buiten bij met zonder maken maak doen doe samen eigen echte goede beste nieuwe nieuw groot grote klein kleine " +
    "with your from into that this have make made own more best good great real about activity activities place places group groups people person things thing " +
    "gemeente stichting genootschap van een het der den des als dan dit dat ook niet wel zij hij wij jij onze ons uit aan the and for are you our all " +
    "huis plein straat laan weg park centrale algemeen basis basic beginners praktijk praktisch praktische professionele gecertificeerde uitgebreide " +
    "uur uren dag dagen week weken maand maanden jaar jaren per elke elk alle volgen volg nemen neem bekijken kijken proberen probeer ontdekken"
  ).split(/\s+/),
);

/** The words of a text as they are compared: lowercase, no accents, letters only, three letters or more, nothing generic. */
function wordsOf(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/make[\s-]?up/g, "makeup") // one word: otherwise "make" meets every "-maken" activity
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z]+/)
    .filter((w) => w.length >= 3 && !GENERIC.has(w));
}

const commonPrefix = (a: string, b: string) => {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
};

/** Two words meet when they are the same, when one contains the other (at least four letters: "make" in "theatermake", "walk" in "walking"), or share a start of five letters ("pottenbakken", "pottenbakker"). */
function meet(a: string, b: string): boolean {
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (short.length >= 4 && long.includes(short)) return true;
  return commonPrefix(a, b) >= 5;
}

const vocabularyCache = new Map<string, string[]>();

/** What an activity is called and how it is looked for, as words. Empty for an activity that does not exist. */
export function activityVocabulary(activityId: string): string[] {
  const cached = vocabularyCache.get(activityId);
  if (cached) return cached;
  const a = getActivity(activityId);
  const out = new Set<string>();
  if (a) {
    const texts = [
      activityId.replace(/-/g, " "),
      a.label.nl,
      a.label.en,
      ...(a.aliases?.nl ?? []),
      ...(a.aliases?.en ?? []),
      searchHint(activityId)?.terms ?? "",
    ];
    for (const t of texts) for (const w of wordsOf(t)) out.add(w);
  }
  const list = [...out];
  vocabularyCache.set(activityId, list);
  return list;
}

/** Does the activity's own name (both languages, aliases) contain a word that says what it is? "Een online cursus volgen" does not. */
function hasSpecificName(activityId: string): boolean {
  const a = getActivity(activityId);
  if (!a) return false;
  return [activityId.replace(/-/g, " "), a.label.nl, a.label.en, ...(a.aliases?.nl ?? []), ...(a.aliases?.en ?? [])].some((t) => wordsOf(t).length > 0);
}

type Text = Pick<LocalOption, "name" | "note" | "kind" | "url">;

const hostOf = (url: string | null | undefined) => (url ?? "").replace(/^https?:\/\/(www\.)?/i, "");

/** How many of the activity's words the given words meet. */
function score(words: readonly string[], vocabulary: readonly string[]): number {
  let n = 0;
  for (const v of vocabulary) if (words.some((w) => meet(w, v))) n++;
  return n;
}

/** How many words the option shares with the activity (0 = nothing in common). Everything the option says about itself counts: name, what it is, note and site. */
export function relevanceScore(o: Text, activityId: string): number {
  return score(wordsOf(`${o.name} ${o.kind ?? ""} ${o.note} ${hostOf(o.url)}`), activityVocabulary(activityId));
}

/** The activities of the library, other than `exceptId`, whose words the option meets: by its name and what it says it is, or with `wholeText` by everything it says. */
export function otherActivitiesMatching(o: Text, exceptId: string, wholeText: boolean): { activityId: string; score: number }[] {
  const words = wordsOf(wholeText ? `${o.name} ${o.kind ?? ""} ${o.note} ${hostOf(o.url)}` : `${o.name} ${o.kind ?? ""}`);
  if (words.length === 0) return [];
  const out: { activityId: string; score: number }[] = [];
  for (const a of ALL_ACTIVITIES) {
    if (a.id === exceptId) continue;
    const s = score(words, activityVocabulary(a.id));
    if (s > 0) out.push({ activityId: a.id, score: s });
  }
  return out;
}

/**
 * Is this option about this activity? Yes when it shares a word with it. Otherwise no when it clearly belongs to another activity of the library from another
 * sub-group, not kindred (see the top of this file), and yes when it matches no activity at all or only a kindred one. `online`: look at the whole text.
 */
export function isRelevant(o: Text, activityId: string, online = false): boolean {
  if (relevanceScore(o, activityId) > 0) return true;
  // An activity whose names say nothing specific ("an online course") cannot be told apart from the rest: nothing to judge against.
  if (!hasSpecificName(activityId)) return true;
  const own = getActivity(activityId);
  const others = otherActivitiesMatching(o, activityId, online);
  if (others.length === 0) return true;
  // It belongs to the activity it resembles most; only when that one is kindred to this one does it stay (a stray word like "theater" matches many activities weakly).
  const top = Math.max(...others.map((m) => m.score));
  return others.filter((m) => m.score === top).some((m) => akin(own, getActivity(m.activityId)));
}

/**
 * Two activities that belong together: the same sub-group, or the same world with at least two abstract connections in common (a boulder hall for a climbing park).
 * Sharing connections alone is not enough: nearly every craft shares one with every other (make-up and board games both "craft"), and that is exactly the mistake.
 */
function akin(a: Activity | undefined, b: Activity | undefined): boolean {
  if (!a || !b) return false;
  return a.sub === b.sub || (a.domain === b.domain && a.tags.filter((t) => b.tags.includes(t)).length >= 2);
}

export interface RelevanceDrop {
  activityId: string;
  option: LocalOption;
  reason: "unrelated" | "fits_another_activity";
}

/**
 * The options of one answer, per activity, with what is not about its activity taken out (see isRelevant). One that two or more activities of the answer
 * were all given stays only with the activity it fits best, and with none when they fit it equally badly.
 */
export function filterRelevant(answer: ReadonlyMap<string, LocalOption[]>, opts: { online?: boolean } = {}): { kept: Map<string, LocalOption[]>; dropped: RelevanceDrop[] } {
  const dropped: RelevanceDrop[] = [];
  const key = (o: LocalOption) => `${o.name}|${o.city}`.toLowerCase();
  const claims = new Map<string, { activityId: string; score: number }[]>();
  for (const [id, options] of answer) {
    for (const o of options) claims.set(key(o), [...(claims.get(key(o)) ?? []), { activityId: id, score: relevanceScore(o, id) }]);
  }
  const kept = new Map<string, LocalOption[]>();
  for (const [id, options] of answer) {
    const keep: LocalOption[] = [];
    for (const o of options) {
      if (!isRelevant(o, id, opts.online)) {
        dropped.push({ activityId: id, option: o, reason: "unrelated" });
        continue;
      }
      const all = claims.get(key(o)) ?? [];
      const mine = relevanceScore(o, id);
      const best = Math.max(...all.map((c) => c.score));
      // Given to several activities: only the best fit keeps it (an equal fit keeps it for all, unless it fits none of them).
      if (all.length > 1 && mine < best) {
        dropped.push({ activityId: id, option: o, reason: "fits_another_activity" });
        continue;
      }
      if (all.length > 1 && best === 0) {
        dropped.push({ activityId: id, option: o, reason: "unrelated" });
        continue;
      }
      keep.push(o);
    }
    kept.set(id, keep);
  }
  return { kept, dropped };
}

/** The options that are about this activity (or its partner in a curated combination); the rest is left out. */
export function relevantOptions(options: readonly LocalOption[], activityId: string, opts: { partnerId?: string | null; online?: boolean } = {}): LocalOption[] {
  return options.filter((o) => isRelevant(o, activityId, opts.online) || (!!opts.partnerId && isRelevant(o, opts.partnerId, opts.online)));
}
