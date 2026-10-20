import type { Metadata } from "next";
import { SiteHeader } from "@/components/window/SiteHeader";
import { IdeaDetail } from "@/components/window/IdeaDetail";
import { WindowMark } from "@/components/window/WindowMark";
import { SharedPageView, SharedCtaLink } from "@/components/window/SharedPageTracking";
import { getSharedIdeaBook } from "./data";
import { ShareButton } from "@/components/window/ShareButton";
import { sharedMetadata } from "@/lib/shareCard";
import type { IdeaBookEntry } from "@/lib/claude/generateIdeaBook";
import { getLocale } from "@/lib/language";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/locale";

export async function generateMetadata(props: PageProps<"/shared/[id]">): Promise<Metadata> {
  // In the language the book was written in (a link is read by whoever receives it), with the
  // number of doors in it; a deleted link gets the generic card text in the site's language.
  const { id } = await props.params;
  const plan = await getSharedIdeaBook(id);
  const dict = getDictionary(plan ? (plan.language === "en" ? "en" : "nl") : await getLocale());
  const doors = plan
    ? (Array.isArray(plan.ideas_json) ? plan.ideas_json.length : 0) +
      (plan.wildcard_json && typeof plan.wildcard_json === "object" && Object.keys(plan.wildcard_json).length > 0 ? 1 : 0)
    : 0;
  // A shared link is the one page on this site truly meant to be posted
  // into a chat or social feed — without its own openGraph/twitter block,
  // Next.js metadata merging leaves the *root* layout's generic title in
  // place instead, which defeats the point of sharing it.
  //
  // No `images` array here (Fase 5, PDF & Share): this route now has its
  // own opengraph-image.tsx, a per-book "Share Card" generated with the
  // person's actual title and One Thing pick. Next.js wires a file with
  // that name into openGraph/twitter metadata automatically, so pointing
  // this at the old static cover.jpg would just fight it for no reason.
  return { ...sharedMetadata(dict.shared, doors), title: dict.shared.pageTitle };
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
        <div className="mb-8 flex flex-wrap items-center gap-4 rounded-2xl bg-accent-dark p-4">
          <span className="text-white">
            <WindowMark onDark className="h-7 w-7" />
          </span>
          <div>
            <p className="text-sm font-semibold text-white">{bookDict.shared.bannerHeading}</p>
            <p className="text-xs text-white/50">{bookDict.shared.bannerSub}</p>
          </div>
          <SharedCtaLink
            href="/intake?utm_source=shared_book&utm_medium=idea_book"
            planId={plan.id}
            className="ml-auto inline-flex items-center justify-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-accent-dark shadow-sm transition-colors hover:bg-white/90"
          >
            {bookDict.shared.bannerCta}
          </SharedCtaLink>
        </div>

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
            <li key={index}>
              <IdeaDetail
                idea={idea}
                index={index}
                photoIndex={index}
                locale={bookLocale}
                labels={labels}
                dict={bookDict.pdfChrome}
              />
            </li>
          ))}
        </ol>

        {wildcard && (
          <div className="mt-8">
            <IdeaDetail
              idea={wildcard}
              index={null}
              photoIndex={ideas.length}
              locale={bookLocale}
              labels={labels}
              dict={bookDict.pdfChrome}
              isWildcard
            />
          </div>
        )}

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <SharedCtaLink
            href="/intake?utm_source=shared_book&utm_medium=idea_book"
            planId={plan.id}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-accent-dark"
          >
            {bookDict.shared.ctaLabel}
          </SharedCtaLink>
          <ShareButton
            url={`${process.env.NEXT_PUBLIC_SITE_URL}/shared/${plan.id}?utm_source=window_share&utm_medium=idea_book`}
            label={bookDict.shared.shareLabel}
            copiedLabel={bookDict.plan.shareCopiedLabel}
            whatsappLabel={bookDict.plan.shareWhatsappLabel}
          />
        </div>
      </main>
    </div>
  );
}
