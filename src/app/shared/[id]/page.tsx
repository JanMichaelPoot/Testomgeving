import type { Metadata } from "next";
import { SiteHeader } from "@/components/window/SiteHeader";
import { IdeaDetail } from "@/components/window/IdeaDetail";
import { SharedPageView, SharedCtaLink } from "@/components/window/SharedPageTracking";
import { getSharedIdeaBook } from "./data";
import type { IdeaBookEntry } from "@/lib/claude/generateIdeaBook";
import { getLocale } from "@/lib/language";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/locale";

export async function generateMetadata(): Promise<Metadata> {
  const dict = getDictionary(await getLocale());
  // A shared link is the one page on this site truly meant to be posted
  // into a chat or social feed — without its own openGraph/twitter block,
  // Next.js metadata merging leaves the *root* layout's generic title and
  // image in place instead, which defeats the point of sharing it.
  return {
    title: dict.shared.pageTitle,
    openGraph: {
      title: dict.shared.pageTitle,
      description: dict.shared.intro,
      images: ["/illustrations/idea-book/cover.jpg"],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: dict.shared.pageTitle,
      description: dict.shared.intro,
      images: ["/illustrations/idea-book/cover.jpg"],
    },
  };
}

export default async function SharedPlanPage(props: PageProps<"/shared/[id]">) {
  const { id } = await props.params;
  const siteLocale = await getLocale();
  const dict = getDictionary(siteLocale);

  const plan = await getSharedIdeaBook(id);

  if (!plan) {
    return (
      <div className="flex min-h-full flex-col">
        <SiteHeader locale={siteLocale} dict={dict.header} />
        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-6 py-16 text-center">
          <h1 className="font-serif text-3xl text-ink">{dict.shared.notFoundHeading}</h1>
          <p className="mt-4 text-ink/70">{dict.shared.notFoundBody}</p>
        </main>
      </div>
    );
  }

  // Render the book's own language (the language it was actually written
  // in), not the visiting stranger's site-locale toggle — a half-Dutch,
  // half-English page would look broken.
  const bookLocale: Locale = plan.language === "en" ? "en" : "nl";
  const bookDict = getDictionary(bookLocale);

  const ideas = Array.isArray(plan.ideas_json)
    ? (plan.ideas_json as unknown as IdeaBookEntry[])
    : [];
  const wildcard =
    plan.wildcard_json && typeof plan.wildcard_json === "object"
      ? (plan.wildcard_json as unknown as IdeaBookEntry)
      : null;
  const labels = (plan.labels_json ?? {}) as Record<string, string>;

  return (
    <div className="flex min-h-full flex-col">
      <SharedPageView planId={plan.id} />
      <SiteHeader locale={siteLocale} dict={dict.header} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12 sm:px-10">
        <p className="text-xs font-medium uppercase tracking-widest text-accent-dark">
          {bookDict.shared.eyebrow}
        </p>
        <h1 className="mt-2 font-serif text-3xl text-ink sm:text-4xl">{plan.title}</h1>
        <p className="mt-4 text-ink/70">{bookDict.shared.intro}</p>

        <h2 className="mt-10 text-xs font-medium uppercase tracking-widest text-accent-dark">
          {bookDict.plan.possibilitiesHeading}
        </h2>
        <ol className="mt-4 space-y-8">
          {ideas.map((idea, index) => (
            <li key={index} className="border-b border-ink/10 pb-8 last:border-b-0 last:pb-0">
              <IdeaDetail
                idea={idea}
                index={index}
                locale={bookLocale}
                labels={labels}
                dict={bookDict.pdfChrome}
              />
            </li>
          ))}
        </ol>

        {wildcard && (
          <div className="mt-8 rounded-2xl border border-accent-dark/30 bg-cream px-6 py-5">
            <p className="text-xs font-medium uppercase tracking-widest text-accent-dark">
              {labels.wildcard_heading || bookDict.plan.wildcardFallback}
            </p>
            <div className="mt-2">
              <IdeaDetail
                idea={wildcard}
                index={null}
                locale={bookLocale}
                labels={labels}
                dict={bookDict.pdfChrome}
              />
            </div>
          </div>
        )}

        <div className="mt-10">
          <SharedCtaLink
            href="/intake?utm_source=shared_book&utm_medium=idea_book"
            planId={plan.id}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-accent-dark"
          >
            {bookDict.shared.ctaLabel}
          </SharedCtaLink>
        </div>
      </main>
    </div>
  );
}
