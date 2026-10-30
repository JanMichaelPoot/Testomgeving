import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PRODUCTION_SITE_URL, isVercelHost, siteUrl } from "./siteUrl";

describe("siteUrl", () => {
  it("falls back to the real domain on production when the setting is missing, empty or a vercel.app host", () => {
    for (const NEXT_PUBLIC_SITE_URL of [undefined, "", "  ", "nonsense", "https://testomgeving.vercel.app", "https://windowinto-git-main-x.vercel.app/"]) {
      expect(siteUrl({ VERCEL_ENV: "production", NEXT_PUBLIC_SITE_URL })).toBe(PRODUCTION_SITE_URL);
    }
  });

  it("respects another real address on production and strips a trailing slash", () => {
    expect(siteUrl({ VERCEL_ENV: "production", NEXT_PUBLIC_SITE_URL: "https://windowinto.nl/" })).toBe("https://windowinto.nl");
  });

  it("uses the setting on previews and locally, and localhost when there is none", () => {
    expect(siteUrl({ VERCEL_ENV: "preview", NEXT_PUBLIC_SITE_URL: "https://pr-1.vercel.app" })).toBe("https://pr-1.vercel.app");
    expect(siteUrl({})).toBe("http://localhost:3000");
  });

  it("knows a vercel.app host", () => {
    expect(isVercelHost("https://a.vercel.app")).toBe(true);
    expect(isVercelHost("https://www.windowinto.nl")).toBe(false);
  });
});

// Release guard: whatever the environment says, production metadata never carries a *.vercel.app address.
describe("production metadata", () => {
  beforeEach(() => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://testomgeving.vercel.app");
    vi.resetModules();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("robots.txt, the sitemap, canonical and Open Graph use the production domain", async () => {
    const robots = (await import("@/app/robots")).default();
    const sitemap = (await import("@/app/sitemap")).default();
    const { buildSiteMetadata } = await import("@/lib/siteMetadata");
    const { getDictionary } = await import("@/lib/i18n/dictionaries");
    const meta = buildSiteMetadata(getDictionary("nl"));
    const all = JSON.stringify({ robots, sitemap, meta });
    expect(all).not.toMatch(/vercel\.app/);
    expect(robots.sitemap).toBe(`${PRODUCTION_SITE_URL}/sitemap.xml`);
    expect(sitemap.every((entry) => entry.url.startsWith(PRODUCTION_SITE_URL))).toBe(true);
    expect(String(meta.metadataBase)).toBe(`${PRODUCTION_SITE_URL}/`);
    expect(meta.alternates?.canonical).toBe("/");
    expect(meta.title).toBe("WINDOW — Ontdek wat er mogelijk is voor jou");
  });
});
