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

export type Fetcher = (url: string, init: { method: string; redirect: "manual"; signal: AbortSignal; headers: Record<string, string> }) => Promise<{ status: number }>;

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

export async function verifyOptionUrls(options: LocalOption[], fetcher: Fetcher = fetch as unknown as Fetcher, timeoutMs = 4000): Promise<VerifyResult> {
  const checked = await Promise.all(
    options.map(async (option): Promise<{ option: LocalOption; reason: string | null }> => {
      if (!option.url) return { option, reason: null };
      const parsed = isPublicWebAddress(option.url);
      if (!parsed) return { option, reason: "not_a_public_website" };
      const first = await status(fetcher, option.url, timeoutMs);
      if ("error" in first) return isDnsFailure(first.error) ? { option, reason: "host_does_not_exist" } : { option, reason: null };
      if (first.status !== 404 && first.status !== 410) return { option, reason: null };
      // The page is gone. Is the site still there?
      const front = await status(fetcher, parsed.origin + "/", timeoutMs);
      if ("error" in front) return isDnsFailure(front.error) ? { option, reason: "host_does_not_exist" } : { option: { ...option, url: parsed.origin + "/" }, reason: null };
      if (front.status === 404 || front.status === 410) return { option, reason: "page_gone" };
      return { option: { ...option, url: parsed.origin + "/" }, reason: null };
    }),
  );
  return {
    kept: checked.filter((c) => c.reason === null).map((c) => c.option),
    dropped: checked.filter((c) => c.reason !== null).map((c) => ({ option: c.option, reason: c.reason! })),
  };
}
