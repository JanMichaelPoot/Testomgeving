// Prices in a book (fix round "plan links"): an exact price ("€20,69") is only shown when it stands on a page the app checked. Anything else becomes
// a rough range marked as an estimate ("€15–25 (schatting)"), so the book never states a precise figure it cannot show.
//
// Pure: the pages are given as their HTML.

const CURRENCY = String.raw`(?:€|EUR\b|CHF\b|£|\$)`;
const AMOUNT = String.raw`\d{1,3}(?:[.']\d{3})+(?:,\d{2}|,-)?|\d{1,5}(?:[.,]\d{2}|,-)?`;
const JOIN = String.raw`\s?(?:-|–|—|tot|to|à)\s?`;
// "vanaf €15", "ca. €15": the hedge is replaced together with the figure.
const HEDGE = String.raw`(?:\b(?:ca\.?|circa|ongeveer|zo'n|rond|vanaf|from|about|around|approx\.?|roughly|ab)\s+|±\s?|~\s?)?`;
const PRICE = new RegExp(String.raw`${HEDGE}(${CURRENCY})\s?(${AMOUNT})(?:${JOIN}(?:${CURRENCY}\s?)?(${AMOUNT}))?(?![\d])`, "gi");
const LABEL = /\((?:schatting|estimate)\)|±/i;

export type PriceLocale = "nl" | "en";
const WORD: Record<PriceLocale, string> = { nl: "(schatting)", en: "(estimate)" };

/** "1.250,50" / "20.69" / "15,-" as a number. */
export function amountOf(raw: string): number {
  const clean = raw.replace(/,-$/, "").replace(/'/g, "");
  const decimals = /[.,](\d{2})$/.exec(clean);
  const whole = (decimals ? clean.slice(0, -3) : clean).replace(/[.,]/g, "");
  return Number(whole) + (decimals ? Number(decimals[1]) / 100 : 0);
}

const pageText = (html: string) => html.replace(/&euro;|&#8364;|&#x20ac;/gi, "€").replace(/&nbsp;|&#160;| /gi, " ");

/** Whether this amount stands on one of the pages as a price: next to a currency, or in the page's price data. */
export function priceOnPages(value: number, pages: readonly string[]): boolean {
  const whole = Math.trunc(value);
  const cents = Math.round((value - whole) * 100);
  const number = cents ? String.raw`${whole}[.,]${String(cents).padStart(2, "0")}(?!\d)` : String.raw`${whole}(?:[.,](?:00|-|–))?(?![\d]|[.,]\d)`;
  const patterns = [
    new RegExp(String.raw`(?:€|EUR|CHF|£|\$)\s?(?<![\d.,])${number}`, "i"),
    new RegExp(String.raw`(?<![\d.,])${number}\s?(?:€|EUR\b|euro\b|CHF\b|francs?\b|Fr\.)`, "i"),
    new RegExp(String.raw`(?:price|prijs)["']?\s*(?:content=|:)\s*["']?${number}`, "i"),
  ];
  return pages.some((html) => {
    const text = pageText(html);
    return patterns.some((p) => p.test(text));
  });
}

/** A rough range around a figure, on round steps. */
export function roughRange(value: number): [number, number] {
  const step = value < 10 ? 1 : value < 100 ? 5 : value < 500 ? 10 : 50;
  const low = Math.max(0, Math.floor((value * 0.8) / step) * step);
  const high = Math.ceil((value * 1.2) / step) * step;
  return [low, high === low ? low + step : high];
}

export interface GuardResult {
  text: string;
  /** The prices that were replaced or labelled, for the log. */
  changed: string[];
}

/**
 * The text with every price that is not on a checked page turned into a labelled estimate. A price that is on a page stays as it is; "€0" and
 * "free" are left alone. With maxLength (a field with a fixed width) the short form "±€15–25" is used when the label would not fit.
 */
export function guardPrices(text: string, pages: readonly string[], locale: PriceLocale, maxLength?: number): GuardResult {
  const changed: string[] = [];
  const labelled = LABEL.test(text);
  const replace = (short: boolean) =>
    text.replace(PRICE, (match: string, currency: string, first: string, second: string | undefined) => {
      const a = amountOf(first);
      const b = second === undefined ? null : amountOf(second);
      if (a === 0 && (b === null || b === 0)) return match;
      if (priceOnPages(a, pages) && (b === null || priceOnPages(b, pages))) return match;
      if (labelled) return match;
      const [low, high] = b === null ? roughRange(a) : [a, b];
      const symbol = /^[€£$]$/.test(currency) ? currency : `${currency.toUpperCase()} `;
      const show = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(".", locale === "nl" ? "," : "."));
      const range = `${symbol}${show(low)}–${show(high)}`;
      changed.push(match.trim());
      return short ? `±${range}` : `${range} ${WORD[locale]}`;
    });
  let out = replace(false);
  if (maxLength !== undefined && out.length > maxLength) {
    changed.length = 0;
    out = replace(true);
  }
  return { text: out, changed };
}
