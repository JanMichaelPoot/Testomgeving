import type { Metadata } from "next";
import { SiteHeader } from "@/components/window/SiteHeader";
import { IntakeEntry } from "@/components/window/IntakeEntry";
import type { IntakeAnswers } from "@/app/intake/actions";
import { buildCardLibrary } from "@/lib/discovery/cardLibrary";
import { getLocale } from "@/lib/language";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getSessionId } from "@/lib/session";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { loadEditableIntake } from "@/lib/intakeEdit";
import { buildAssociationLibrary } from "@/lib/discovery/associations";
import { VENSTER_PAGES } from "@/lib/vensterPages";
import { currentMonth } from "@/lib/discovery/season";
import { TestLimitNotice } from "@/components/window/TestLimitNotice";
import { checkTestQuota } from "@/lib/testQuota";

export async function generateMetadata(): Promise<Metadata> {
  const dict = getDictionary(await getLocale());
  return { title: dict.intake.pageTitle };
}

export default async function IntakePage(props: PageProps<"/intake">) {
  const locale = await getLocale();
  // The cards and examples offered are the ones that can be done in the month of asking.
  const month = currentMonth();
  const dict = getDictionary(locale);

  // "Wijzig" on the checkout page links here with ?edit=1&page=N: start from the answers
  // stored for this session, as long as the book has not been made or paid for yet.
  const searchParams = await props.searchParams;
  let initial: { answers: IntakeAnswers; page: number } | undefined;
  let editLocked = false;
  if (searchParams.edit === "1") {
    const sessionId = await getSessionId();
    const stored = sessionId ? await loadEditableIntake(createServiceRoleClient(), sessionId) : null;
    if (stored) {
      // The language it was made in is not an answer; the wizard re-captures it on submit.
      const answers: IntakeAnswers = { ...stored };
      delete (answers as Partial<typeof stored>).locale;
      const requested = Number(Array.isArray(searchParams.page) ? searchParams.page[0] : searchParams.page);
      // The image intake has eight screens, the other wizards five.
      const lastPage = answers.intakeVariant === "associations" ? VENSTER_PAGES.length - 1 : 4;
      initial = { answers, page: Number.isInteger(requested) ? Math.min(Math.max(requested, 0), lastPage) : 0 };
    } else if (sessionId) {
      editLocked = true;
    }
  }

  // Test phase: a connection that has made its test books gets the notice instead of another intake.
  const currentSession = await getSessionId();
  const quota = await checkTestQuota(createServiceRoleClient(), currentSession);
  if (!quota.allowed) {
    return (
      <div className="flex min-h-full flex-col">
        <SiteHeader locale={locale} dict={dict.header} />
        <TestLimitNotice copy={dict.venster.testLimit} />
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader locale={locale} dict={dict.header} />
      <main className="mx-auto flex w-full max-w-6xl flex-1 items-start justify-center px-4 py-6 sm:px-10 sm:py-16">
        <div className="flex w-full max-w-5xl flex-col gap-4">
          {editLocked && (
            <p className="rounded-lg border border-border bg-surface-active px-4 py-3 text-sm text-ink/70" role="status">
              {dict.intake.editLocked}
            </p>
          )}
          <IntakeEntry
            dict={dict.intake}
            vensterDict={dict.venster}
            library={buildCardLibrary(locale, month)}
            associations={buildAssociationLibrary(locale, month)}
            initial={initial}
            purpose={searchParams.for === "gift" ? "gift" : "self"}
          />
        </div>
      </main>
    </div>
  );
}
