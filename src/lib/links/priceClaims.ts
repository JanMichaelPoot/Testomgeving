// Which price a reader may see (Step 248). A writer that has no price guesses one, and a guess next to "within your budget" sold a EUR 775
// course to somebody with EUR 50. So an amount is shown only when the research found it for a provider of this very idea: it stands in the
// note of one of its places, and neither that note nor the price is marked as an estimate (verifyBook marks what is not on the checked page).
// Anything else reads "ask the price", which no budget line or "it fits your budget" sentence can be built on.
//
// Pure. Applied before a new book is saved (verifyBook) and again wherever a stored book is shown, so older books follow the same rule.
import type { IdeaBookEntry } from "@/lib/claude/ideaBookTypes";
import { getActivity } from "@/lib/discovery/library";
import { amountOf } from "@/lib/links/prices";
import type { Locale } from "@/lib/locale";

export const ASK_PRICE: Record<Locale, string> = { nl: "Prijs navragen", en: "Ask the price" };

export function askPrice(locale: string): string {
  return locale === "en" ? ASK_PRICE.en : ASK_PRICE.nl;
}

const ESTIMATE = /schatting|estimate|indicatie|indication|richtprijs|±|~|\b(?:ca\.|circa|ongeveer|zo'n|about|around|approx|roughly)/i;
const FREE = /\b(?:gratis|free)\b/i;
const NUMBER = /\d+(?:[.']\d{3})*(?:[.,]\d{2}|,-)?/g;
// An amount of money in a running text: a currency before it ("€ 19,50", "EUR 12") or after it ("12 euro").
const MONEY = /(?:€|EUR\b|CHF\b|£|\$)\s?(\d+(?:[.']\d{3})*(?:[.,]\d{2}|,-)?)|(\d+(?:[.,]\d{2})?)\s?(?:€|euro\b|EUR\b)/gi;

const amountsIn = (text: string) => (text.match(NUMBER) ?? []).map(amountOf);
const moneyIn = (text: string) => [...text.matchAll(MONEY)].map((m) => amountOf(m[1] ?? m[2]));

type Priced = Pick<IdeaBookEntry, "places" | "activity_id">;

export type PriceKind = "found" | "free" | "unconfirmed";

/** What is known about a price text of this idea: found at a provider, free as far as we know, or not something we can show. */
export function priceKind(cost: string, entry: Priced): PriceKind {
  const notes = (entry.places ?? []).map((p) => p.note ?? "").filter(Boolean);
  const amounts = amountsIn(cost);
  if (FREE.test(cost) && amounts.every((a) => a === 0)) {
    // Free is a claim too: a provider says so, or the library knows the activity costs nothing.
    const activity = entry.activity_id ? getActivity(entry.activity_id) : undefined;
    return notes.some((n) => FREE.test(n)) || activity?.cost === 0 ? "free" : "unconfirmed";
  }
  if (amounts.length === 0 || ESTIMATE.test(cost)) return "unconfirmed";
  // All of it from one and the same provider: a range put together from two places is not a price anybody asks.
  const found = notes.some((note) => {
    if (ESTIMATE.test(note)) return false;
    const stated = moneyIn(note);
    return amounts.every((a) => stated.includes(a));
  });
  return found ? "found" : "unconfirmed";
}

/** The price text as the reader may see it. An empty field stays empty. */
export function shownPrice(cost: string, entry: Priced, locale: string): string {
  if (!cost.trim()) return cost;
  return priceKind(cost, entry) === "unconfirmed" ? askPrice(locale) : cost;
}

/** The entry with every price field (the idea's own and its three sizes) brought under the rule. */
export function withCheckedPrices<T extends IdeaBookEntry>(entry: T, locale: string): T {
  return {
    ...entry,
    ...(entry.practical ? { practical: { ...entry.practical, estimated_cost: shownPrice(entry.practical.estimated_cost ?? "", entry, locale) } } : {}),
    ...(entry.sizes ? { sizes: entry.sizes.map((s) => ({ ...s, estimated_cost: shownPrice(s.estimated_cost, entry, locale) })) } : {}),
  };
}
