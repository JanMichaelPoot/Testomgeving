// What a provider's page says about money (Step 249), pure: the pieces of text around every amount, and the one link on the same site that
// is likely to hold the prices when the page itself names none. The choice of which amount is the price is made elsewhere
// (lib/claude/priceResearch.ts); nothing here guesses.

const CURRENCY_NEAR = /(?:€\s?\d|\d\s?€|\bEUR\s?\d|\d\s?(?:euro|EUR)\b|CHF\s?\d|£\s?\d|\$\s?\d)/gi;

/** The readable text of a page, hidden parts (fold-outs) included. Scripts and styles are not text. */
export function pageText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&euro;|&#8364;|&#x20ac;/gi, "€")
    .replace(/&nbsp;|&#160;| /gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#?[a-z0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const BEFORE = 160;
const AFTER = 110;
export const MAX_SNIPPETS = 8;
export const MAX_SNIPPET_CHARS = 1600;

/** The pieces of text around the amounts of a page, overlapping ones joined, each one once, within a fixed budget of characters. */
export function moneySnippets(html: string): string[] {
  const text = pageText(html);
  const spans: [number, number][] = [];
  for (const m of text.matchAll(CURRENCY_NEAR)) {
    const start = Math.max(0, m.index - BEFORE);
    const end = Math.min(text.length, m.index + m[0].length + AFTER);
    const last = spans[spans.length - 1];
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else spans.push([start, end]);
  }
  const out: string[] = [];
  const seen = new Set<string>();
  let used = 0;
  for (const [start, end] of spans) {
    const piece = text.slice(start, end).trim();
    // A page often repeats its price block (a menu, a footer): the same words once.
    const key = piece.replace(/\d+/g, "#").slice(40, 160);
    if (seen.has(key)) continue;
    seen.add(key);
    const room = MAX_SNIPPET_CHARS - used;
    if (room < 80 || out.length >= MAX_SNIPPETS) break;
    out.push(piece.slice(0, room));
    used += Math.min(piece.length, room);
  }
  return out;
}

// Words in a link that point to a price list, most telling first.
const PRICE_LINK_WORDS = [/kosten|prijs|prijzen|tarie[fv]|lesgeld|cursusgeld|contributie|pric(?:e|es|ing)|fees?\b|rates?\b/i, /ticket|entree|toegang|admission/i, /aanmeld|inschrijv|boek|reserve|book|sign-?up|enrol/i];

const sameHost = (a: URL, b: URL) => a.hostname.replace(/^www\./i, "").toLowerCase() === b.hostname.replace(/^www\./i, "").toLowerCase();

/** Words of the activity and the offer, shortened so that "cursus" also finds "schrijfcursussen" and "Sterrenkijken" finds "sterrenkijkavonden". */
export function linkHints(texts: readonly string[]): string[] {
  const words = texts.join(" ").toLowerCase().split(/[^a-zà-ÿ]+/).filter((w) => w.length >= 5 && !HINT_FILLERS.has(w));
  return [...new Set(words.map((w) => w.slice(0, 6)))].slice(0, 12);
}
const HINT_FILLERS = new Set(["beginners", "beginner", "geschikt", "iedere", "online", "utrecht", "amsterdam", "website", "vanaf", "samen", "eerste", "dagen", "geven", "maken", "volgende"]);

/** The links on the same site most likely to name the price of this offer, best first: price words weigh most, the offer's own words break the tie. */
export function priceLinks(html: string, base: string, hints: readonly string[] = [], max = 2): string[] {
  let from: URL;
  try {
    from = new URL(base);
  } catch {
    return [];
  }
  const found = new Map<string, number>();
  for (const m of html.matchAll(/<a\b[^>]*?href\s*=\s*["']([^"'#]+)[^"']*["'][^>]*>([\s\S]{0,200}?)<\/a>/gi)) {
    let to: URL;
    try {
      to = new URL(m[1].replace(/&amp;/g, "&"), from);
    } catch {
      continue;
    }
    if ((to.protocol !== "https:" && to.protocol !== "http:") || !sameHost(from, to) || to.pathname === from.pathname) continue;
    if (/\.(pdf|jpe?g|png|webp|zip|docx?|ics)$/i.test(to.pathname) || /voorwaarden|terms|privacy|cadeau|gift|korting|discount|vacature|verhuur|zakelijk/i.test(to.href)) continue;
    const label = `${to.pathname} ${pageText(m[2])}`.toLowerCase();
    const word = PRICE_LINK_WORDS.findIndex((re) => re.test(label));
    const hinted = Math.min(2, hints.filter((h) => label.includes(h)).length);
    const score = (word < 0 ? 0 : [30, 18, 8][word]) + hinted * 10;
    if (score > (found.get(to.href) ?? 0)) found.set(to.href, score);
  }
  return [...found].sort((a, b) => b[1] - a[1] || a[0].length - b[0].length).slice(0, max).map(([url]) => url);
}
