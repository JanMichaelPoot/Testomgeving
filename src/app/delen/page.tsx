import { siteUrl as getSiteUrl } from "@/lib/siteUrl";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/window/SiteHeader";
import { SiteFooter } from "@/components/window/SiteFooter";
import { InviteShare } from "@/components/window/InviteShare";
import { getLocale } from "@/lib/language";
import { getDictionary } from "@/lib/i18n/dictionaries";

// A page anyone can open to share the general invitation card (an image for Instagram or WhatsApp)
// and the link to WindowInto. Not personal: it needs no session and shows nothing about anybody.
export async function generateMetadata(): Promise<Metadata> {
  const dict = getDictionary(await getLocale());
  return { title: dict.venster.invite.button };
}

export default async function SharePage() {
  const locale = await getLocale();
  const dict = getDictionary(locale);
  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader locale={locale} dict={dict.header} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12 sm:px-10">
        <InviteShare locale={locale} copy={dict.venster.invite} siteUrl={getSiteUrl()} source="page" defaultOpen />
      </main>
      <SiteFooter locale={locale} dict={dict.footer} />
    </div>
  );
}
