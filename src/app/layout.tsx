import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import { getLocale } from "@/lib/language";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { ConsentBanner } from "@/components/window/ConsentBanner";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz", "SOFT", "WONK"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const dict = getDictionary(await getLocale());
  const title = `WINDOW — ${dict.landing.headlineLine1} ${dict.landing.headlineLine2}`;
  // The idea-book cover illustration doubles as the default share-preview
  // image — it's the closest thing this site has to a branded hero shot
  // until a dedicated OG image exists.
  const ogImage = "/illustrations/idea-book/cover.jpg";

  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
    title,
    description: dict.landing.subcopy,
    openGraph: {
      title,
      description: dict.landing.subcopy,
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

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  const dict = getDictionary(locale);

  return (
    <html
      lang={locale}
      className={`${fraunces.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-cream text-ink font-sans">
        {children}
        <ConsentBanner dict={dict.consent} />
      </body>
    </html>
  );
}
