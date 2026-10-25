import type { GeneratedIdeaBook, IdeaBookEntry } from "@/lib/claude/ideaBookTypes";
import { freeWord } from "@/lib/locale";

// The writing prompts say which language to write in, but a few Dutch habits still slip into an English
// book ("Gratis" for no cost, "vanaf" for a starting price), and the other way round. This is the safety net,
// applied once to a finished book. It only touches the short cost and duration fields, never running text.

const TO_EN: [RegExp, string][] = [
  [/\bgratis\b/gi, "Free"],
  [/\bvanaf\b/gi, "from"],
  [/\bprijs varieert\b/gi, "price varies"],
  [/\bper sessie\b/gi, "per session"],
  [/\buur\b/gi, "hour"],
  [/\bhalve dag\b/gi, "half a day"],
  [/\bdagdeel\b/gi, "half a day"],
];
const TO_NL: [RegExp, string][] = [
  [/\bfree\b/gi, "Gratis"],
  [/\bprice varies\b/gi, "prijs varieert"],
  [/\bper session\b/gi, "per sessie"],
];

export function localizeShort(text: string, locale: string): string {
  const rules = locale === "nl" ? TO_NL : TO_EN;
  let out = text;
  for (const [re, to] of rules) out = out.replace(re, to);
  // keep a leading capital where the field starts with the replaced word
  return out.length > 0 ? out[0].toUpperCase() + out.slice(1) : out;
}

function entry(e: IdeaBookEntry, locale: string): IdeaBookEntry {
  const next: IdeaBookEntry = {
    ...e,
    practical: e.practical
      ? { ...e.practical, estimated_cost: localizeShort(e.practical.estimated_cost, locale), duration: localizeShort(e.practical.duration, locale) }
      : e.practical,
  };
  if (e.sizes) next.sizes = e.sizes.map((s) => ({ ...s, estimated_cost: localizeShort(s.estimated_cost, locale), duration: localizeShort(s.duration, locale) }));
  return next;
}

export function localizeBook(book: GeneratedIdeaBook, locale: string): GeneratedIdeaBook {
  return { ...book, ideas: book.ideas.map((e) => entry(e, locale)), wildcard: entry(book.wildcard, locale) };
}

export { freeWord };
