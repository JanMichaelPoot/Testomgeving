// Two kinds of amount that are not "what you pay" (Step 254): a price that only holds from a minimum number of people (a ghost walk at
// EUR 15 from 12 people costs one person about EUR 180), and the price of an app or a paid version on the side (EUR 4 for the premium app
// next to a cycle route that is also offered as a download).
//
// Pure and client-safe.

/** From this many people on, a price is a group's price and not one the reader can pay on their own (two is a pair; that still counts). */
export const GROUP_FROM = 3;

const PEOPLE = "(?:personen|persoon|pers\\b|deelnemers|people|persons|participants)";
const MINIMUM = new RegExp(
  `(?:vanaf|v\\.a\\.?|min(?:imaal|imum|\\.)?|from|at least|minimum of|groepen van)\\s*(\\d{1,3})\\s*\\+?\\s*${PEOPLE}|(\\d{1,3})\\s*\\+?\\s*${PEOPLE}\\s*(?:of meer|or more)|groepen van\\s*(\\d{1,3})\\s*\\+`,
  "gi",
);

/** The smallest number of people a text asks for ("vanaf 12 personen"), or null when it asks for none. */
export function minimumPeople(text: string): number | null {
  const found = [...text.matchAll(MINIMUM)].map((m) => Number(m[1] ?? m[2] ?? m[3])).filter((n) => n >= 2 && n <= 200);
  return found.length ? Math.min(...found) : null;
}

// Another amount of money, or the start of a new sentence: what stands beyond it is not about our amount.
const OTHER_AMOUNT = /(?:€|\bEUR)\s?\d|\d\s?(?:€|euro\b)|\d+[.,]\d{2}\b|\d,-/i;
const NEW_SENTENCE = /[.!?]\s+(?=\p{Lu})/u;
// "from 15 people EUR 10": a minimum that is followed by its own price belongs to that price.
const OWN_AMOUNT = /^\s*[,:]?[^.,;()!?|]{0,25}?(?:(?:€|\bEUR)\s?\d|\d+(?:[.,]\d{2})?\s?(?:€|euro\b))/i;

/**
 * The smallest group the text around one amount asks for with that very amount (at `at`, `length` long): "from 12 people" next to it, with
 * no other price and no new sentence in between. A price table puts the group rate right after the single ticket.
 */
export function minimumForAmount(snippet: string, at: number, length: number, reach = 90): number | null {
  const found: number[] = [];
  for (const m of snippet.matchAll(MINIMUM)) {
    const people = Number(m[1] ?? m[2] ?? m[3]);
    const end = m.index + m[0].length;
    const before = end <= at;
    const between = before ? snippet.slice(end, at) : snippet.slice(at + length, Math.max(at + length, m.index));
    if (people < 2 || people > 200 || between.length > reach || OTHER_AMOUNT.test(between) || NEW_SENTENCE.test(between)) continue;
    if (!before && OWN_AMOUNT.test(snippet.slice(end))) continue;
    found.push(people);
  }
  return found.length ? Math.min(...found) : null;
}

export const isGroupPrice = (price: { minPeople?: number } | null | undefined): boolean => (price?.minPeople ?? 0) >= GROUP_FROM;

export const groupLabel = (people: number, locale: string): string => (locale === "en" ? `from ${people} people` : `vanaf ${people} personen`);

/** A page that sells an app or a paid version: its amounts are not the price of the activity. */
export function isAppPage(url: string): boolean {
  try {
    // "/fiets-app/" and "/premium" are; a "self-guided tour with the app" is the activity itself.
    return new URL(url).pathname.split("/").some((part) => /(^|[-_])(apps?|premium)(\.\w+)?$/i.test(part) && !/(^|-)(met|with)-(de-|een-|the-|an-)?apps?(\.\w+)?$/i.test(part));
  } catch {
    return false;
  }
}
