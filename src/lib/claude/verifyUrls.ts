import type { LocalOption } from "@/lib/claude/localResearch";

// A cheap, free existence check on what the research found: does the website answer? The model is told to
// list only what appeared in search results, but a mistyped or stale address still slips through now and
// then, and a dead link in a paid book is the most visible kind of "this does not exist".
//
//  - no website: nothing to check, the option stays (a venue without a site is real);
//  - a host that is not a public website (localhost, an IP address, .local): dropped, it can only be wrong;
//  - the address answers, or redirects: kept;
//  - 404 or 410: the page is gone, but the business may not be: if the site's front page answers, the option
//    stays with that front page as its link, otherwise it is dropped;
//  - the host does not exist at all (DNS): dropped;
//  - anything else (a timeout, 403 because the site blocks robots, 429, a server error): kept. Absence of
//    proof is not proof of absence, and many real sites refuse automated requests.
// No redirect is followed by this code (a redirect already proves the host exists), so a hostile address
// cannot make this server call something internal.
//
// Content check (content: true, used by the research): a living address is not yet an open venue. The page is read
// (at most 150 KB) and the option is dropped when
//  - it says the business has closed for good ("permanently closed", "definitief gesloten", "cerrado definitivamente", ...);
//  - it is a parked or for-sale domain page (the site behind a dead business often is);
//  - none of the words of the option's name occur on it (the address is then about something else).
// A redirect is only followed when it stays on the same host (http to https, with or without www).

export interface FetchedPage {
  status: number;
  /** The Location header of a redirect. */
  location?: string | null;
  /** The (limited) text of the page, for the content check. Absent for fetchers that cannot provide it. */
  text?: () => Promise<string>;
}

export type Fetcher = (url: string, init: { method: string; redirect: "manual"; signal: AbortSignal; headers: Record<string, string> }) => Promise<FetchedPage>;

const MAX_PAGE_BYTES = 150_000;

/** Reads at most `max` bytes of a response body as text, then stops. */
async function readLimited(res: Response, max: number): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < max) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    chunks.push(value);
    total += value.length;
  }
  void reader.cancel().catch(() => undefined);
  return new TextDecoder("utf-8", { fatal: false }).decode(Buffer.concat(chunks.map((c) => Buffer.from(c))).subarray(0, max));
}

const defaultFetcher: Fetcher = async (url, init) => {
  const res = await fetch(url, init);
  if (res.status !== 200) void res.body?.cancel().catch(() => undefined);
  return { status: res.status, location: res.headers.get("location"), text: () => readLimited(res, MAX_PAGE_BYTES) };
};

// --- what a page says about the business ---------------------------------------------------------

const CLOSED_PHRASES = [
  "permanently closed", "closed permanently", "has closed down", "has permanently closed", "closed for good", "no longer in business", "no longer operating", "ceased operations",
  "definitief gesloten", "permanent gesloten", "voorgoed gesloten", "heeft zijn deuren gesloten", "heeft haar deuren gesloten", "niet meer in bedrijf", "bedrijf is beeindigd",
  "cerrado permanentemente", "cerrado definitivamente", "cierre definitivo", "ha cerrado sus puertas", "cerrado para siempre",
  "dauerhaft geschlossen", "endgultig geschlossen", "definitiv geschlossen",
  "ferme definitivement", "definitivement ferme", "fermeture definitive",
];
const PARKED_PHRASES = [
  "this domain is for sale", "domain is for sale", "buy this domain", "this domain may be for sale", "domain parking", "parked free",
  "dit domein is te koop", "domein te koop", "dominio en venta", "diese domain steht zum verkauf", "ce domaine est a vendre",
];
const NAME_FILLERS = new Set(["club", "center", "centre", "centrum", "studio", "workshop", "workshops", "vereniging", "stichting", "the", "van", "voor", "and"]);

const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

function visibleText(html: string): string {
  return fold(
    html
      .replace(/<(script|style|noscript)[\s\S]*?<\/(?:script|style|noscript)>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;|&amp;|&#\d+;|&[a-z]+;/gi, " "),
  )
    .replace(/\s+/g, " ")
    .slice(0, 200_000);
}

/** Why this page says the option is not a living business (or null). Exported for tests. */
export function pageProblem(html: string, name: string): "site_says_closed" | "parked_domain" | "name_not_on_site" | null {
  const text = visibleText(html);
  if (CLOSED_PHRASES.some((p) => text.includes(p))) return "site_says_closed";
  if (PARKED_PHRASES.some((p) => text.includes(p))) return "parked_domain";
  // Only a real page can fail the name test: a tiny or script-only page says nothing either way.
  if (text.length < 400) return null;
  const words = fold(name).split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !NAME_FILLERS.has(w));
  if (words.length > 0 && !words.some((w) => text.includes(w))) return "name_not_on_site";
  return null;
}

/** The same site: the host without a leading "www.", whatever the scheme. */
function sameSite(a: URL, b: URL): boolean {
  const host = (u: URL) => u.hostname.replace(/^www\./i, "").toLowerCase();
  return host(a) === host(b);
}

export interface VerifyResult {
  kept: LocalOption[];
  dropped: { option: LocalOption; reason: string }[];
}

const PRIVATE_HOST = /^(localhost|.*\.local|.*\.internal|.*\.localhost)$/i;
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

/** A public website address: http(s), a real host name (not an IP address, not localhost). */
export function isPublicWebAddress(url: string): URL | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  const host = parsed.hostname;
  if (!host.includes(".") || PRIVATE_HOST.test(host) || IPV4.test(host) || host.includes(":") || host.startsWith("[")) return null;
  return parsed;
}

function isDnsFailure(err: unknown): boolean {
  const text = `${err instanceof Error ? err.message : ""} ${(err as { cause?: { code?: string; message?: string } })?.cause?.code ?? ""} ${(err as { cause?: { message?: string } })?.cause?.message ?? ""}`;
  return /ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(text);
}

async function status(fetcher: Fetcher, url: string, timeoutMs: number): Promise<{ status: number } | { error: unknown }> {
  const headers = { "user-agent": "WindowIntoLinkCheck/1.0 (+https://windowinto.nl)", accept: "text/html,*/*" };
  try {
    let res = await fetcher(url, { method: "HEAD", redirect: "manual", signal: AbortSignal.timeout(timeoutMs), headers });
    // Some servers refuse HEAD; ask once more the plain way.
    if (res.status === 405 || res.status === 501) res = await fetcher(url, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(timeoutMs), headers });
    return res;
  } catch (error) {
    return { error };
  }
}

export interface VerifyOptions {
  /** Also read the page and drop an option whose site says it closed, is a parked domain, or is about something else. */
  content?: boolean;
}

/** Content mode: fetch one address, following a redirect only within the same site (at most twice). */
async function getPage(fetcher: Fetcher, url: string, timeoutMs: number): Promise<(FetchedPage & { finalUrl: string }) | { error: unknown }> {
  const headers = { "user-agent": "WindowIntoLinkCheck/1.0 (+https://windowinto.nl)", accept: "text/html,*/*" };
  let current = url;
  for (let hop = 0; hop < 3; hop++) {
    let res: FetchedPage;
    try {
      res = await fetcher(current, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(timeoutMs), headers });
    } catch (error) {
      return { error };
    }
    if (res.status >= 300 && res.status < 400 && res.location) {
      let next: URL | null = null;
      try {
        next = new URL(res.location, current);
      } catch {
        next = null;
      }
      const from = isPublicWebAddress(current);
      if (next && from && isPublicWebAddress(next.href) && sameSite(from, next)) {
        current = next.href;
        continue;
      }
    }
    return { ...res, finalUrl: current };
  }
  return { status: 310, finalUrl: current };
}

export async function verifyOptionUrls(
  options: LocalOption[],
  fetcher: Fetcher = defaultFetcher,
  timeoutMs = 4000,
  opts: VerifyOptions = {},
): Promise<VerifyResult> {
  const checked = await Promise.all(
    options.map(async (option): Promise<{ option: LocalOption; reason: string | null }> => {
      if (!option.url) return { option, reason: null };
      const parsed = isPublicWebAddress(option.url);
      if (!parsed) return { option, reason: "not_a_public_website" };
      const first = opts.content ? await getPage(fetcher, option.url, timeoutMs) : await status(fetcher, option.url, timeoutMs);
      if ("error" in first) return isDnsFailure(first.error) ? { option, reason: "host_does_not_exist" } : { option, reason: null };
      if (first.status !== 404 && first.status !== 410) return opts.content ? judgePage(option, first) : { option, reason: null };
      // The page is gone. Is the site still there?
      const front = opts.content ? await getPage(fetcher, parsed.origin + "/", timeoutMs) : await status(fetcher, parsed.origin + "/", timeoutMs);
      if ("error" in front) return isDnsFailure(front.error) ? { option, reason: "host_does_not_exist" } : { option: { ...option, url: parsed.origin + "/" }, reason: null };
      if (front.status === 404 || front.status === 410) return { option, reason: "page_gone" };
      const moved = { ...option, url: parsed.origin + "/" };
      return opts.content ? judgePage(moved, front) : { option: moved, reason: null };
    }),
  );
  return {
    kept: checked.filter((c) => c.reason === null).map((c) => c.option),
    dropped: checked.filter((c) => c.reason !== null).map((c) => ({ option: c.option, reason: c.reason! })),
  };
}

/** A page that answered 200 with readable text is judged by what it says; anything else cannot be judged and stays. */
async function judgePage(option: LocalOption, page: FetchedPage): Promise<{ option: LocalOption; reason: string | null }> {
  if (page.status !== 200 || !page.text) return { option, reason: null };
  let html = "";
  try {
    html = await page.text();
  } catch {
    return { option, reason: null };
  }
  const problem = pageProblem(html, option.name);
  return { option, reason: problem };
}
