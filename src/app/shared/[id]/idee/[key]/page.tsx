import type { Metadata } from "next";
import { SiteHeader } from "@/components/window/SiteHeader";
import { IdeaDetail } from "@/components/window/IdeaDetail";
import { WindowMark } from "@/components/window/WindowMark";
import { SharedIdeaCta, SharedIdeaView } from "@/components/window/SharedIdeaTracking";
import { getSharedIdeaBook } from "../../data";
import type { IdeaBookEntry } from "@/lib/claude/ideaBookTypes";
import { withValidLayers } from "@/lib/claude/ideaLayers";
import { getLocale } from "@/lib/language";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getIdeaShareCopy } from "@/lib/i18n/ideaShare";
import { parseShareTarget, resolveShared, shortExplanation, truncateAtWord } from "@/lib/ideaShare";
import type { Locale } from "@/lib/locale";

// One idea of a book, for a friend who was sent its card (Step 242). It shows the idea and one way to make a book of their own, and nothing else of the buyer's:
// no link to the rest of the book, no profile, no answers. (/robots.txt keeps /shared out of search results.)

// Typed by hand: the generated PageProps type only knows a route after the next build has seen it, and the typecheck must not depend on that.
type IdeaPageProps = { params: Promise<{ id: string; key: string }> };

async function load(rawId: string, rawKey: string) {
  const target = parseShareTarget(rawId, rawKey);
  if (!target) return null;
  const plan = await getSharedIdeaBook(target.planId);
  if (!plan) return null;
  const ideas = Array.isArray(plan.ideas_json) ? (plan.ideas_json as unknown as IdeaBookEntry[]).map(withValidLayers) : [];
  const wildcard = plan.wildcard_json && typeof plan.wildcard_json === "object" && Object.keys(plan.wildcard_json).length > 0 ? withValidLayers(plan.wildcard_json as unknown as IdeaBookEntry) : null;
  const shared = resolveShared(target.key, ideas, wildcard);
  if (!shared) return null;
  return { plan, key: target.key, labels: (plan.labels_json ?? {}) as Record<string, string>, ...shared };
}

export async function generateMetadata(props: IdeaPageProps): Promise<Metadata> {
  const { id, key } = await props.params;
  const found = await load(id, key);
  if (!found) return { title: getDictionary(await getLocale()).shared.pageTitle };
  const title = found.idea.title;
  const description = truncateAtWord(shortExplanation(found.idea), 160);
  // The picture comes from the opengraph-image file next to this page (one card per idea).
  return { title, description, openGraph: { title, description, type: "website" }, twitter: { card: "summary_large_image", title, description } };
}

export default async function SharedIdeaPage(props: IdeaPageProps) {
  const { id, key } = await props.params;
  const siteLocale = await getLocale();
  const siteDict = getDictionary(siteLocale);
  const found = await load(id, key);

  if (!found) {
    return (
      <div className="flex min-h-full flex-col">
        <SiteHeader locale={siteLocale} dict={siteDict.header} />
        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-6 py-16 text-center">
          <h1 className="font-serif text-3xl text-ink">{siteDict.shared.notFoundHeading}</h1>
          <p className="mt-4 text-ink/70">{siteDict.shared.notFoundBody}</p>
        </main>
      </div>
    );
  }

  // The language the book was written in, not the visitor's toggle: a half-Dutch, half-English page would look broken.
  const bookLocale: Locale = found.plan.language === "en" ? "en" : "nl";
  const bookDict = getDictionary(bookLocale);
  const copy = getIdeaShareCopy(bookLocale);
  const cta = "/intake?utm_source=shared_idea&utm_medium=idea_card";

  return (
    <div className="flex min-h-full flex-col">
      <SharedIdeaView planId={found.plan.id} ideaKey={found.key} />
      <SiteHeader locale={siteLocale} dict={siteDict.header} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12 sm:px-10">
        <p className="mb-5 flex items-center gap-2.5 text-xs font-medium uppercase tracking-widest text-accent-dark">
          <WindowMark className="h-6 w-6" />
          {copy.pageEyebrow}
        </p>

        <IdeaDetail
          idea={found.idea}
          index={null}
          photoIndex={found.photoIndex}
          locale={bookLocale}
          labels={found.labels}
          dict={bookDict.pdfChrome}
          isWildcard={found.isWildcard}
          moreCopy={bookDict.venster.more}
          moreMode="shared"
        />

        <section className="mt-10 rounded-2xl bg-accent-dark p-6 text-center sm:p-8">
          <h2 className="font-serif text-2xl text-white sm:text-3xl">{copy.pageCtaHeading}</h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-white/70">{copy.pageCtaBody}</p>
          <SharedIdeaCta
            href={cta}
            planId={found.plan.id}
            ideaKey={found.key}
            className="mt-5 inline-flex min-h-12 items-center justify-center rounded-full bg-white px-6 text-sm font-semibold text-accent-dark shadow-sm transition-colors hover:bg-white/90"
          >
            {copy.pageCta}
          </SharedIdeaCta>
        </section>
      </main>
    </div>
  );
}
