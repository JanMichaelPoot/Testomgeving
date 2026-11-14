import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/window/SiteHeader";
import { TestFeedback } from "@/components/window/TestFeedback";
import { getSharedIdeaBook } from "@/app/shared/[id]/data";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { formatPrice } from "@/lib/pricing";
import { orderIdeasByDoor } from "@/lib/possibilityMap";
import { feedbackDoorsFor, testFeedbackEnabled } from "@/lib/testFeedback";
import type { IdeaBookEntry } from "@/lib/claude/generateIdeaBook";

// The short questionnaire about one book (Jan, 14 Nov 2026: it no longer sits under the book on /plan; the e-mail with the PDF asks the reader to fill it
// in and links here). In the language the book was written in, which is the language of the mail. Reached by the book's own id, like the shared page:
// only the titles of the ideas are shown, and only for a book that is ready. Off, and so not found, when the questionnaire is switched off
// (NEXT_PUBLIC_TEST_FEEDBACK), the same switch that decides whether the mail asks for it.
export const metadata: Metadata = {
  title: "WindowInto",
  robots: { index: false, follow: false },
};

export default async function FeedbackPage(props: { params: Promise<{ id: string }> }) {
  if (!testFeedbackEnabled(process.env.NEXT_PUBLIC_TEST_FEEDBACK)) notFound();
  const { id } = await props.params;
  const plan = /^[0-9a-f-]{36}$/i.test(id) ? await getSharedIdeaBook(id) : null;
  if (!plan) notFound();

  const locale = plan.language === "en" ? "en" : "nl";
  const dict = getDictionary(locale);
  const ideas = Array.isArray(plan.ideas_json) ? (plan.ideas_json as unknown as IdeaBookEntry[]) : [];
  const wildcard = plan.wildcard_json && typeof plan.wildcard_json === "object" && Object.keys(plan.wildcard_json).length > 0 ? (plan.wildcard_json as unknown as IdeaBookEntry) : null;
  const doors = feedbackDoorsFor(orderIdeasByDoor(ideas).map(({ idea }) => idea), wildcard);

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader locale={locale} dict={dict.header} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10 sm:px-10 sm:py-12">
        <TestFeedback planId={plan.id} locale={locale} price={formatPrice(locale)} dict={dict.venster.feedback} doors={doors} />
      </main>
    </div>
  );
}
