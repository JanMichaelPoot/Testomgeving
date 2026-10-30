import { buildSiteMetadata } from "@/lib/siteMetadata";
import type { Metadata } from "next";
import { Newsreader, Plus_Jakarta_Sans } from "next/font/google";
import { getLocale } from "@/lib/language";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { ConsentBanner } from "@/components/window/ConsentBanner";
import { priceTestVariants } from "@/lib/visitorPrice";
import "./globals.css";

// "Clean Premium Hybrid" type system: a serif accent face for editorial
// headings (landing) and a strict, slightly tightened sans for everything
// else (Intake/Checkout headings, all body copy) — replaces the earlier
// Fraunces/Inter pairing.
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  return buildSiteMetadata(getDictionary(await getLocale()));
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  const dict = getDictionary(locale);

  return (
    <html
      lang={locale}
      className={`${newsreader.variable} ${jakarta.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-cream text-ink font-sans">
        {children}
        <ConsentBanner dict={dict.consent} priceVariants={priceTestVariants()} />
      </body>
    </html>
  );
}
