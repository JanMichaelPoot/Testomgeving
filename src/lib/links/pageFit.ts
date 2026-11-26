// Does a page fit the reader? (fix round "country, language and audience"). Judged from the page itself and its address, free of any model call:
//  - language: the page is in the reader's language or in English, or offers one of them (hreflang): then that version is linked. For a venue in the
//    reader's own country the country's own languages count too (a Basel observatory writes German whatever language the book is in);
//  - country: not a website of another country (its country ending, or a region in its path such as /fr-fr/ or etsy.com/ch/);
//  - audience: for adults, not a page whose title is about children ("anniversaire enfant", "kinderfeestje") without a word about adults.
// What cannot be told (a page without a language, a general ending such as .com) is not held against it.
//
// Pure: it gets the HTML and the headers, it fetches nothing.

import { COUNTRY_CODES } from "@/lib/countries";

export interface FitPolicy {
  /** The reader's country (ISO code, upper case). */
  country: string;
  /** The language of the book. */
  language: "nl" | "en";
  /** The option is a place in a town (not an online provider): the country's own languages count too. */
  localVenue: boolean;
  /** The ideas are for adults (no children in the company, not a search for a child). */
  adultsOnly: boolean;
}

export type FitProblem = "wrong_language" | "foreign_country" | "child_focused";

/** The languages a venue of this country may reasonably write its own website in. A country that is not listed: its language cannot be judged. */
const COUNTRY_LANGUAGES: Record<string, readonly string[]> = {
  NL: ["nl"], BE: ["nl", "fr", "de"], LU: ["fr", "de", "lb"], DE: ["de"], AT: ["de"], CH: ["de", "fr", "it", "rm"], LI: ["de"], FR: ["fr"],
  MC: ["fr"], ES: ["es", "ca", "eu", "gl"], IT: ["it"], PT: ["pt"], GB: ["en", "cy"], IE: ["en", "ga"], US: ["en", "es"], CA: ["en", "fr"],
  AU: ["en"], NZ: ["en"], DK: ["da"], SE: ["sv"], NO: ["no", "nb", "nn"], FI: ["fi", "sv"], IS: ["is"], PL: ["pl"], CZ: ["cs"], SK: ["sk"],
  HU: ["hu"], SI: ["sl"], HR: ["hr"], RO: ["ro"], BG: ["bg"], GR: ["el"], CY: ["el", "tr"], EE: ["et"], LV: ["lv"], LT: ["lt"], JP: ["ja"],
  CN: ["zh"], TW: ["zh"], HK: ["zh", "en"], KR: ["ko"], BR: ["pt"], MX: ["es"], AR: ["es"], CO: ["es"], CL: ["es"], PE: ["es"], TR: ["tr"],
  ZA: ["en", "af"], SR: ["nl"], AW: ["nl", "pap", "en"], CW: ["nl", "pap", "en"],
};

/** Country endings that are in use as general endings all over the world: they say nothing about the country. */
const GENERIC_CC = new Set(["ac", "ai", "bz", "cc", "co", "fm", "gg", "io", "ly", "me", "sh", "tv", "to", "ws", "la", "gl", "am", "dj", "st", "vc", "im", "eu", "so"]);

const CC = new Set<string>(COUNTRY_CODES.map((c) => c.toLowerCase()));

/** The country a host belongs to, from its ending; null for a general ending. */
export function countryOfHost(host: string): string | null {
  const tld = host.toLowerCase().split(".").pop() ?? "";
  if (tld === "uk") return "GB";
  if (!CC.has(tld) || GENERIC_CC.has(tld)) return null;
  return tld.toUpperCase();
}

/** A country that the path says this version is for: "/fr-fr/", "/en_GB/", or a shop's "/ch/". Null when the path says nothing. */
export function regionOfPath(pathname: string): string | null {
  const parts = pathname.toLowerCase().split("/").filter(Boolean).slice(0, 2);
  for (const part of parts) {
    const locale = /^([a-z]{2})[-_]([a-z]{2})$/.exec(part);
    if (locale) return locale[2] === "uk" ? "GB" : CC.has(locale[2]) ? locale[2].toUpperCase() : null;
  }
  // A bare "/ch/", "/at/", "/uk/" as the first part is a country shop. Codes that are also common words or language codes are not read ("/de/", "/nl/", "/fr/").
  const first = parts[0] ?? "";
  if (first === "uk") return "GB";
  if (["ch", "at", "us", "au", "ie"].includes(first)) return first.toUpperCase();
  return null;
}

const primaryTag = (value: string) => value.trim().toLowerCase().split(/[-_]/)[0];

const attr = (tag: string, name: string): string | null => new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(tag)?.slice(1).find((v) => v !== undefined) ?? null;

/** The language the page says it is in: <html lang>, the content-language header or meta, og:locale. Null when it does not say. */
export function pageLanguage(html: string, contentLanguage?: string | null): string | null {
  const htmlTag = /<html\b[^>]*>/i.exec(html)?.[0];
  const fromHtml = htmlTag ? attr(htmlTag, "lang") : null;
  const meta = [...html.matchAll(/<meta\b[^>]*>/gi)].map((m) => m[0]);
  const fromMeta = meta.find((t) => /http-equiv\s*=\s*["']?content-language/i.test(t));
  const og = meta.find((t) => /property\s*=\s*["']?og:locale["'\s>]/i.test(t));
  const raw = fromHtml || contentLanguage?.split(",")[0] || (fromMeta ? attr(fromMeta, "content") : null) || (og ? attr(og, "content") : null);
  const tag = raw ? primaryTag(raw) : "";
  return /^[a-z]{2,3}$/.test(tag) ? tag : null;
}

/** The other language versions the page offers (hreflang), as language (and region, when given) to address. */
export function alternates(html: string): { lang: string; region: string | null; href: string }[] {
  const out: { lang: string; region: string | null; href: string }[] = [];
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0];
    const hreflang = attr(tag, "hreflang");
    const href = attr(tag, "href");
    if (!hreflang || !href || hreflang.toLowerCase() === "x-default") continue;
    const [lang, region] = hreflang.toLowerCase().split(/[-_]/);
    out.push({ lang, region: region ? region.toUpperCase() : null, href: href.replace(/&amp;/g, "&") });
  }
  return out;
}

/** The languages that fit this reader, best first. */
export function acceptedLanguages(policy: FitPolicy): string[] {
  const own = [policy.language, "en"];
  const local = policy.localVenue ? (COUNTRY_LANGUAGES[policy.country] ?? []) : [];
  return [...new Set([...own, ...local])];
}

/** A better version of this page for the reader, from its own hreflang list: the reader's language (their own country first), else English. */
export function preferredAlternate(html: string, policy: FitPolicy): string | null {
  const list = alternates(html);
  for (const lang of [policy.language, "en"]) {
    const same = list.filter((a) => a.lang === lang && (!a.region || a.region === policy.country));
    const best = same.find((a) => a.region === policy.country) ?? same[0];
    if (best) return best.href;
  }
  return null;
}

const CHILD_WORDS = /\b(kinderfeest(?:je)?|kinderpartijtje|voor kinderen|kinderactiviteit(?:en)?|speelgoed|peuters?|kleuters?|for kids|for children|kids'? part(?:y|ies)|children'?s (?:party|parties|activities|toys)|toddlers?|enfants?|anniversaire enfant|pour (?:les )?enfants|für kinder|kindergeburtstag|para niños|per bambini)\b/i;
const ADULT_WORDS = /\b(volwassenen|adults?|adultes?|erwachsene|adultos|adulti|alle leeftijden|all ages|tous les âges)\b/i;

const textOf = (fragment: string) => fragment.replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ").trim();

/** The page presents itself as something for children (its title or main heading), without a word about adults. */
export function isChildFocused(html: string): boolean {
  const title = textOf(/<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "");
  const heading = textOf(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1] ?? "");
  const head = `${title} · ${heading}`;
  return CHILD_WORDS.test(head) && !ADULT_WORDS.test(head);
}

export interface FitPage {
  url: string;
  html: string;
  contentLanguage?: string | null;
}

/** Why this page does not fit the reader, or null. A page in a wrong language that offers a fitting version is reported with that version. */
export function judgeFit(page: FitPage, policy: FitPolicy): { problem: FitProblem | null; better: string | null } {
  const url = new URL(page.url);
  const hostCountry = countryOfHost(url.hostname);
  if (hostCountry && hostCountry !== policy.country) return { problem: "foreign_country", better: null };
  const region = regionOfPath(url.pathname);
  if (region && region !== policy.country) {
    const better = preferredAlternate(page.html, policy);
    return { problem: "foreign_country", better };
  }
  const language = pageLanguage(page.html, page.contentLanguage);
  const known = COUNTRY_LANGUAGES[policy.country] !== undefined;
  // A venue in a country whose languages are not listed cannot be judged on language.
  if (language && !acceptedLanguages(policy).includes(language) && (known || !policy.localVenue)) {
    return { problem: "wrong_language", better: preferredAlternate(page.html, policy) };
  }
  if (policy.adultsOnly && isChildFocused(page.html)) return { problem: "child_focused", better: null };
  return { problem: null, better: null };
}
