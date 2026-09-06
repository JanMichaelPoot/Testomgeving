import type { Metadata } from "next";
import { SiteHeader } from "@/components/window/SiteHeader";
import { IntakeWizard } from "@/components/window/IntakeWizard";
import { getLocale } from "@/lib/language";
import { getDictionary } from "@/lib/i18n/dictionaries";

export async function generateMetadata(): Promise<Metadata> {
  const dict = getDictionary(await getLocale());
  return { title: dict.intake.pageTitle };
}

export default async function IntakePage() {
  const locale = await getLocale();
  const dict = getDictionary(locale);

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader locale={locale} dict={dict.header} />
      <main className="mx-auto flex w-full max-w-6xl flex-1 items-start justify-center px-6 py-12 sm:px-10 sm:py-16">
        <IntakeWizard dict={dict.intake} />
      </main>
    </div>
  );
}
