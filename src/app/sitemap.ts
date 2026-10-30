import { siteUrl as getSiteUrl } from "@/lib/siteUrl";
import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();

  // Only the static, publicly indexable pages — see robots.ts for why
  // /plan, /checkout, /intake, and /shared/[id] are deliberately excluded.
  return [
    { url: siteUrl, changeFrequency: "monthly", priority: 1 },
    { url: `${siteUrl}/wat-zit-erin`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${siteUrl}/cadeaubon`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${siteUrl}/delen`, changeFrequency: "yearly", priority: 0.4 },
    { url: `${siteUrl}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${siteUrl}/terms`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
