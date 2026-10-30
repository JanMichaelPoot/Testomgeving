import { siteUrl as getSiteUrl } from "@/lib/siteUrl";
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // /plan carries a payment/session reference in its query string and
      // /shared/[id] is meant for direct link-sharing, not public search
      // discovery of someone else's personal Idea Book — /checkout and
      // /intake are mid-flow pages with nothing worth indexing.
      disallow: ["/plan", "/checkout", "/intake", "/shared", "/api", "/admin"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
