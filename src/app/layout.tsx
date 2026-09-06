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
  return {
    title: `WINDOW — ${dict.landing.headlineLine1} ${dict.landing.headlineLine2}`,
    description: dict.landing.subcopy,
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
