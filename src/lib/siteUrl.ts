// The one place that decides the public address of the site: metadata (canonical, Open Graph), robots.txt, the sitemap, Stripe return
// links, share links and e-mail links all read it, so they cannot disagree.
//
// On a production deployment (VERCEL_ENV=production) the address is never a *.vercel.app host: a leftover NEXT_PUBLIC_SITE_URL that
// points at the Vercel project address (the project is called "testomgeving") falls back to the real domain. Any other address that
// is set (e.g. https://windowinto.nl without www) is respected. Previews and local runs use NEXT_PUBLIC_SITE_URL, then localhost.

export const PRODUCTION_SITE_URL = "https://www.windowinto.nl";
const LOCAL_SITE_URL = "http://localhost:3000";

type Env = Record<string, string | undefined>;

function clean(raw: string | undefined): string | null {
  const value = (raw ?? "").trim().replace(/\/+$/, "");
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.origin : null;
  } catch {
    return null;
  }
}

export function isVercelHost(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith(".vercel.app");
  } catch {
    return false;
  }
}

export function siteUrl(env: Env = process.env): string {
  const configured = clean(env.NEXT_PUBLIC_SITE_URL);
  if (env.VERCEL_ENV === "production") {
    return configured && !isVercelHost(configured) ? configured : PRODUCTION_SITE_URL;
  }
  return configured ?? LOCAL_SITE_URL;
}
