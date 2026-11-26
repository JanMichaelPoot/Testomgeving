// The one place a web address enters a book (fix round "plan links"): the research (the model's answer and the cache), the stored book read back for the
// web page, and the PDF renderer all go through normalizeUrl(). A link in a PDF or on a page is therefore always an absolute https address of a public
// website, or there is no link at all. A bare "escape-kit.com" is never handed to a viewer, which would resolve it against the address of the document.
//
// findWebAddresses() reads the addresses out of running text ("Open escape-kit.com and ..."), so that every address that is printed can be made a link
// with its full address (a PDF viewer that sees a bare domain may make its own link of it, relative to where the PDF came from).
//
// Pure and client-safe.

import { COUNTRY_CODES } from "@/lib/countries";

const PRIVATE_HOST = /(^|\.)(localhost|local|internal|localdomain|lan|home\.arpa)$/i;
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;
/** Our own storage: a storage address is never shown or linked (it only works with a short-lived token, and shows a JSON error without it). */
const STORAGE_HOST = /(^|\.)supabase\.(co|in)$/i;

/** Punctuation that ends a sentence, not an address. */
function trimPunctuation(raw: string): string {
  let out = raw.trim().replace(/[.,;:!?'"»”’>\]]+$/u, "");
  // A closing bracket belongs to the address only when the address opens one ("/wiki/Foo_(bar)").
  while (out.endsWith(")") && (out.match(/\(/g)?.length ?? 0) < (out.match(/\)/g)?.length ?? 0)) out = out.slice(0, -1).replace(/[.,;:!?'"]+$/u, "");
  return out.replace(/^[<«“‘('"[]+/u, "");
}

/**
 * An absolute https address, or null when this is not a public web address. A missing scheme gets https://, http:// is upgraded to https://.
 * Rejected: other schemes (mailto:, javascript:, file:, data:), relative paths, hosts without a dot, IP addresses, local hosts, addresses with a
 * user name or password, spaces, and our own storage host.
 */
export function normalizeUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let value = trimPunctuation(raw);
  if (!value || /\s/.test(value) || value.length > 2000) return null;
  if (value.startsWith("//")) value = `https:${value}`;
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(value)?.[1]?.toLowerCase();
  // "example.com:8080/x" reads as a scheme too; only a real "name:" that is not followed by a port counts.
  const isPort = scheme !== undefined && /^[a-z0-9.-]+:\d+(\/|$)/i.test(value);
  if (scheme && !isPort) {
    if (scheme !== "http" && scheme !== "https") return null;
    if (!/^https?:\/\//i.test(value)) return null;
  } else {
    // Without a scheme it must start with a host name: a path ("/plan", "./x", "?token=") is not an address.
    if (!/^[\p{L}\p{N}]/u.test(value)) return null;
    value = `https://${value}`;
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  url.protocol = "https:";
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (url.username || url.password) return null;
  if (!host.includes(".") || host.startsWith("[") || host.includes(":") || IPV4.test(host) || PRIVATE_HOST.test(host) || STORAGE_HOST.test(host)) return null;
  const tld = host.slice(host.lastIndexOf(".") + 1);
  if (!/^([a-z]{2,24}|xn--[a-z0-9-]+)$/.test(tld)) return null;
  // A bare front page stays as it was written: no "/" is added, so a stored address does not change for nothing.
  return url.pathname === "/" && !url.search && !url.hash && !value.endsWith("/") ? url.href.slice(0, -1) : url.href;
}

/** The host without "www.", lower case; "" when the address is not a web address. */
export function hostKey(raw: string): string {
  const url = normalizeUrl(raw);
  return url ? new URL(url).hostname.toLowerCase().replace(/^www\./, "") : "";
}

// The endings an address in running text may have: every country ending plus the common general ones. A made-up ending ("node.js", "report.pdf")
// is not an address. Without this list "St.Margarethen" or a file name would become a link.
const GENERIC_TLDS = [
  "com", "org", "net", "info", "biz", "app", "art", "studio", "online", "shop", "store", "site", "club", "events", "world", "life", "space", "tech",
  "dev", "xyz", "museum", "academy", "school", "care", "center", "centre", "gallery", "photography", "kitchen", "cafe", "coffee", "bike", "fun",
  "games", "live", "digital", "media", "agency", "design", "music", "film", "theater", "theatre", "yoga", "fitness", "golf", "surf", "sport",
  "travel", "tours", "camp", "farm", "garden", "house", "works", "company", "group", "community", "foundation", "ngo", "church", "email", "wine",
  "amsterdam", "berlin", "london", "paris", "swiss", "zuerich", "koeln", "hamburg", "wien", "gent", "brussels", "vlaanderen", "frl",
];
const TLDS = [...new Set([...COUNTRY_CODES.map((c) => c.toLowerCase()), "uk", "eu", ...GENERIC_TLDS])].sort((a, b) => b.length - a.length);

// Not preceded by a letter, digit, @ or dot (an e-mail address, the middle of a word); an ending has two characters or more (so "e.g." and "o.a."
// are not addresses) and is followed by something that cannot continue a word.
const ADDRESS_PATTERN = new RegExp(
  String.raw`(?<![\p{L}\p{N}@._/-])(?:https?:\/\/)?(?:[a-z0-9-]+\.)*[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.(?:${TLDS.join("|")})(?![\p{L}\p{N}_-])(?:\.(?![\p{L}\p{N}]))?(?::\d+)?(?:\/[^\s,;"'<>«»“”‘’…]*)?`,
  "giu",
);

export interface FoundAddress {
  /** Exactly as it stands in the text (without trailing punctuation). */
  text: string;
  index: number;
  /** The absolute https address it means. */
  url: string;
}

/** Every web address printed in a text, in order. E-mail addresses are not web addresses. */
export function findWebAddresses(text: string): FoundAddress[] {
  const out: FoundAddress[] = [];
  for (const match of text.matchAll(ADDRESS_PATTERN)) {
    const shown = trimPunctuation(match[0]);
    // A sentence end glued to the next word ("klaar.Ga") has no scheme, no path and a capital after the dot: not an address.
    if (!/^https?:|\/|^www\./i.test(shown) && /\.\p{Lu}/u.test(shown)) continue;
    const url = normalizeUrl(shown);
    if (url) out.push({ text: shown, index: match.index ?? 0, url });
  }
  return out;
}

/**
 * The link for an address printed in a book: the verified address of the same website when the book has one (the exact page the research
 * checked, in the reader's language), otherwise the address itself made absolute. A printed address with its own path keeps that path.
 */
export function linkFor(found: FoundAddress, verified: readonly string[]): string {
  const key = hostKey(found.url);
  const ownPath = new URL(found.url).pathname.replace(/\/$/, "");
  if (ownPath) {
    const exact = verified.find((v) => hostKey(v) === key && new URL(v).pathname.replace(/\/$/, "") === ownPath);
    return exact ?? found.url;
  }
  return verified.find((v) => hostKey(v) === key) ?? found.url;
}
