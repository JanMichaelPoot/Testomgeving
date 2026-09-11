import type { Metadata } from "next";
import { SiteHeader } from "@/components/window/SiteHeader";
import { IdeaBookViewer } from "@/components/window/IdeaBookViewer";
import { GeneratingScreen } from "@/components/window/GeneratingScreen";
import {
  getOrCreateWindowPlan,
  getOrCreateTestWindowPlan,
  PlanNotReadyError,
} from "@/app/plan/data";
import type { IdeaBookEntry } from "@/lib/claude/generateIdeaBook";
import { getLocale, type Locale } from "@/lib/language";
import { getDictionary, type Dictionary } from "@/lib/i18n/dictionaries";

export async function generateMetadata(): Promise<Metadata> {
  const dict = getDictionary(await getLocale());
  return { title: dict.plan.pageTitle };
}

function ErrorState({
  message,
  dict,
  refreshHref,
}: {
  message: string;
  dict: Dictionary["plan"];
  refreshHref: string;
}) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <h1 className="font-serif text-3xl text-ink">{dict.errorHeading}</h1>
      <div className="mt-6 w-full rounded-2xl border border-red-200 bg-red-50 px-6 py-8">
        <p className="text-ink/70">{message}</p>
        <a
          href={refreshHref}
          className="mt-4 inline-block text-sm font-medium text-accent-dark underline"
        >
          {dict.refreshLink}
        </a>
      </div>
    </main>
  );
}

export default async function PlanPage(props: PageProps<"/plan">) {
  const locale: Locale = await getLocale();
  const dict = getDictionary(locale);

  const searchParams = await props.searchParams;
  const checkoutSessionId =
    typeof searchParams.checkout_session_id === "string"
      ? searchParams.checkout_session_id
      : null;
  const testSessionId =
    typeof searchParams.test_session_id === "string"
      ? searchParams.test_session_id
      : null;

  // Preserves whatever got the user to this page so the ErrorState's
  // "refresh" link actually retries generation instead of losing the
  // payment/session reference and dead-ending on "no payment found".
  const refreshParams = new URLSearchParams();
  if (checkoutSessionId) refreshParams.set("checkout_session_id", checkoutSessionId);
  if (testSessionId) refreshParams.set("test_session_id", testSessionId);
  const refreshHref = refreshParams.size > 0 ? `/plan?${refreshParams}` : "/plan";

  if (!checkoutSessionId && !testSessionId) {
    return (
      <div className="flex min-h-full flex-col">
        <SiteHeader locale={locale} dict={dict.header} />
        <ErrorState
          message={dict.plan.errorNoPayment}
          dict={dict.plan}
          refreshHref={refreshHref}
        />
      </div>
    );
  }

  let plan;
  let errorMessage: string | null = null;

  try {
    plan = testSessionId
      ? await getOrCreateTestWindowPlan(testSessionId)
      : await getOrCreateWindowPlan(checkoutSessionId!);
  } catch (err) {
    if (err instanceof PlanNotReadyError) {
      if (err.reason === "generating") {
        // Full-screen takeover, no site header — matches the WINDOW
        // prototype's dedicated dark "generating" screen.
        return (
          <GeneratingScreen
            heading={dict.plan.generating.heading}
            messages={dict.plan.generating.messages}
            autoRefreshNote={dict.plan.generating.autoRefreshNote}
          />
        );
      }
      errorMessage = err.message;
    } else {
      // Don't leak internal error details (API keys, stack traces) to the
      // user — log server-side and show a safe generic message instead.
      console.error("Failed to generate Idea Book:", err);
      errorMessage = dict.plan.errorGeneric;
    }
  }

  if (errorMessage || !plan) {
    return (
      <div className="flex min-h-full flex-col">
        <SiteHeader locale={locale} dict={dict.header} />
        <ErrorState
          message={errorMessage ?? dict.plan.errorFallback}
          dict={dict.plan}
          refreshHref={refreshHref}
        />
      </div>
    );
  }

  const mustHaves = Array.isArray(plan.must_haves)
    ? (plan.must_haves as unknown[]).map(String)
    : [];
  const preferences = Array.isArray(plan.preferences)
    ? (plan.preferences as unknown[]).map(String)
    : [];
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
      <SiteHeader locale={locale} dict={dict.header} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12 sm:px-10">
        <IdeaBookViewer
          title={plan.title}
          profileSummary={plan.profile_summary ?? ""}
          mustHaves={mustHaves}
          preferences={preferences}
          ideas={ideas}
          wildcard={wildcard}
          locale={locale}
          labels={labels}
          pdfChromeDict={dict.pdfChrome}
          planDict={dict.plan}
          pdfUrl={plan.pdf_url}
          shareUrl={`${process.env.NEXT_PUBLIC_SITE_URL}/shared/${plan.id}?utm_source=window_share&utm_medium=idea_book`}
          showEmailedCopy={!testSessionId}
        />
      </main>
    </div>
  );
}
