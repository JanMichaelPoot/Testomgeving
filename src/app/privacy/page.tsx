import type { Metadata } from "next";
import { SiteHeader } from "@/components/window/SiteHeader";
import { SiteFooter } from "@/components/window/SiteFooter";
import { getLocale } from "@/lib/language";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getDeviceId } from "@/lib/discovery/historyStore";
import { forgetDevice } from "@/app/actions/deviceMemory";

export async function generateMetadata(): Promise<Metadata> {
  const dict = getDictionary(await getLocale());
  return { title: dict.legal.privacyTitle };
}

export default async function PrivacyPage() {
  const locale = await getLocale();
  const dict = getDictionary(locale);
  // Only a visitor who opted in has this cookie (the page is dynamic because of that).
  const hasDeviceMemory = (await getDeviceId()) !== null;

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader locale={locale} dict={dict.header} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
        <h1 className="font-serif text-3xl text-ink">{dict.legal.privacyHeading}</h1>
        <p className="mt-4 text-ink/60">{dict.legal.privacyIntro}</p>
        <div className="mt-8 space-y-6">
          {dict.legal.privacySections.map((section) => (
            // scroll-mt-24 keeps an anchor link (e.g. footer "Cookies" ->
            // /privacy#cookies) from landing under the sticky SiteHeader.
            <div key={section.id} id={section.id} className="scroll-mt-24">
              <h2 className="font-serif text-lg text-ink">{section.heading}</h2>
              <p className="mt-1.5 text-sm text-ink/70">{section.body}</p>
              {section.id === "apparaatgeheugen" &&
                (hasDeviceMemory ? (
                  <form action={forgetDevice} className="mt-3">
                    <button
                      type="submit"
                      className="rounded-md border border-border bg-paper px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-ink/40"
                    >
                      {dict.legal.privacyForgetButton}
                    </button>
                  </form>
                ) : (
                  <p className="mt-2 text-xs text-ink/50">{dict.legal.privacyForgetNone}</p>
                ))}
            </div>
          ))}
        </div>
      </main>
      <SiteFooter locale={locale} dict={dict.footer} />
    </div>
  );
}
