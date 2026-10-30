import type { Metadata } from "next";
import { siteUrl } from "@/lib/siteUrl";
import type { Dictionary } from "@/lib/i18n/dictionaries";

// The site-wide metadata (title, description, canonical, Open Graph, Twitter card), in one function so a test can check it
// without loading the layout. Every address comes from siteUrl(): on production it is never a *.vercel.app host.
export function buildSiteMetadata(dict: Dictionary): Metadata {
  const title = dict.landing.metaTitle;
  // The idea-book cover illustration doubles as the default share-preview image until a dedicated OG image exists.
  const ogImage = "/illustrations/idea-book/cover.jpg";

  return {
    metadataBase: new URL(siteUrl()),
    title,
    description: dict.landing.subcopy,
    alternates: { canonical: "/" },
    openGraph: {
      title,
      description: dict.landing.subcopy,
      url: "/",
      siteName: "WINDOW",
      images: [ogImage],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: dict.landing.subcopy,
      images: [ogImage],
    },
  };
}
