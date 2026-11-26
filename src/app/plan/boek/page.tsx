// The PDF inside our own page (fix round "plan links"): the reader always has this page to come back to. On a wide screen the PDF is shown in a
// frame with a download button; on a phone (which cannot show a PDF in a frame) one button opens it from our own address. When anything is
// wrong, this page says so in the reader's language, with a way back and a way to make the link again.

import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/window/SiteHeader";
import { findViewablePlan, planKeyFrom, planQuery } from "@/lib/planAccess";
import { getPlanViewerCopy } from "@/lib/i18n/planViewer";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/language";
import { SUPPORT_EMAIL } from "@/lib/supportEmail";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getPlanViewerCopy(await getLocale()).pageTitle, robots: { index: false, follow: false }, referrer: "no-referrer" };
}

// Making a missing PDF again happens in the PDF route; this page only looks.
export const maxDuration = 60;

const PRIMARY = "inline-flex min-h-12 items-center justify-center rounded-lg bg-accent-dark px-6 text-sm font-semibold text-white transition-colors hover:bg-accent";
const SECONDARY = "inline-flex min-h-12 items-center justify-center rounded-lg border border-border bg-paper px-6 text-sm font-semibold text-accent-dark transition-colors hover:border-accent-dark";

// Typed by hand: the generated route types only know a new route after a build.
export default async function PlanBookPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const locale = await getLocale();
  const copy = getPlanViewerCopy(locale);
  const header = getDictionary(locale).header;
  const search = await props.searchParams;
  const one = (name: string) => (typeof search[name] === "string" ? (search[name] as string) : null);
  const key = planKeyFrom(one);
  const query = planQuery(key);
  const backHref = query ? `/plan?${query}` : "/plan";
  const plan = await findViewablePlan(key);
  const failed = !plan || one("probleem") === "1";
  const page = /^\d{1,3}$/.test(one("page") ?? "") ? `#page=${one("page")}` : "";

  if (failed) {
    return (
      <div className="flex min-h-full flex-col">
        <SiteHeader locale={locale} dict={header} />
        <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-6 py-16 text-center" data-testid="plan-problem">
          <h1 className="font-serif text-3xl leading-snug text-ink">{copy.problemHeading}</h1>
          <p className="mt-4 text-ink/70">{plan ? copy.problemBody : copy.noBookBody}</p>
          <div className="mt-8 flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row">
            <Link href={backHref} className={PRIMARY}>
              {copy.back}
            </Link>
            {query && (
              // A plain link: the PDF route makes the file again from the stored book and serves it.
              <a href={plan ? `/plan/pdf?${planQuery(key, { rebuild: "1" })}` : `/plan/boek?${query}`} className={SECONDARY}>
                {copy.renew}
              </a>
            )}
          </div>
          <p className="mt-6 text-sm text-ink/70">{copy.help.replace("{email}", SUPPORT_EMAIL)}</p>
        </main>
      </div>
    );
  }

  const pdfHref = `/plan/pdf?${query}`;
  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader locale={locale} dict={header} />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-6 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href={backHref} className="inline-flex min-h-11 items-center text-sm font-semibold text-accent-dark underline underline-offset-2 hover:text-accent" data-testid="plan-book-back">
            ← {copy.back}
          </Link>
          <a href={`/plan/pdf?${planQuery(key, { download: "1" })}`} className={PRIMARY} data-testid="plan-book-download">
            {copy.download}
          </a>
        </div>
        <h1 className="sr-only">{copy.heading}</h1>
        <iframe src={`${pdfHref}${page}`} title={copy.frameTitle} loading="lazy" className="hidden h-[80vh] w-full rounded-lg border border-border bg-paper md:block" data-testid="plan-book-frame" />
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-paper px-5 py-10 text-center md:hidden">
          <a href={`${pdfHref}${page}`} className={SECONDARY} data-testid="plan-book-open">
            {copy.open}
          </a>
          <p className="text-sm text-ink/70">{copy.phoneNote}</p>
        </div>
      </main>
    </div>
  );
}
