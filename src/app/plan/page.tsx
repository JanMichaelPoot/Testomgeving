import type { Metadata } from "next";
import { SiteHeader } from "@/components/window/SiteHeader";
import { PlanReveal } from "@/components/window/PlanReveal";
import { TestFeedback } from "@/components/window/TestFeedback";
import { testFeedbackEnabled } from "@/lib/testFeedback";
import { orderIdeasByDoor } from "@/lib/possibilityMap";
import { formatPrice } from "@/lib/pricing";
import { GeneratingScreen } from "@/components/window/GeneratingScreen";
import {
  getOrCreateWindowPlan,
  getOrCreateTestWindowPlan,
  getSignedPdfUrl,
  getIntakeEchoForSession,
  getWaitingContext,
  PlanNotReadyError,
} from "@/app/plan/data";
import { retryPlanGeneration } from "@/app/plan/actions";
import type { IdeaBookEntry } from "@/lib/claude/generateIdeaBook";
import { withValidLayers } from "@/lib/claude/ideaLayers";
import { getLocale, type Locale } from "@/lib/language";
import { getSessionId } from "@/lib/session";
import { buildPlanEcho } from "@/lib/planEcho";
import { buildBecauseLines, buildVensterEcho } from "@/lib/vensterReveal";
import { WindowFrame } from "@/components/window/WindowFrame";
import { buildVensterPanes } from "@/lib/vensterPanes";
import { buildAssociationLibrary } from "@/lib/discovery/associations";
import { DOMAINS } from "@/lib/discovery/library";
import { getDictionary, type Dictionary } from "@/lib/i18n/dictionaries";
import { elapsedSinceNow } from "@/lib/progressStage";
import { parseAssociationSources } from "@/lib/discovery/associations";
import { buildIdeaThreads } from "@/lib/ideaThread";
import { displayPlace } from "@/lib/place";

export async function generateMetadata(): Promise<Metadata> {
  const dict = getDictionary(await getLocale());
  return { title: dict.plan.pageTitle };
}

// getOrCreateWindowPlan/getOrCreateTestWindowPlan (src/app/plan/data.ts) now
// respond immediately and hand the slow Claude+PDF work to Next's `after()`,
// but that background work still runs inside this same serverless function
// invocation (via Vercel's waitUntil) and gets killed the moment the
// function's own timeout hits — raising maxDuration is what actually buys it
// the ~60-100s it needs. With Fluid compute (on by default for new Vercel
// projects) the ceiling is 300s on every plan, Hobby included; only without
// Fluid compute does Hobby cap functions at 60s (Vercel docs, "Configuring
// Maximum Duration", checked 4 Oct 2026). Check Settings -> Functions in
// Vercel. PENDING_TIMEOUT_MS in data.ts must stay above this value.
export const maxDuration = 120;

// The person's own window, opening pane by pane, on the waiting screen (image intake only).
function waitingWindow(answers: Awaited<ReturnType<typeof getWaitingContext>>["answers"], locale: Locale, dict: Dictionary) {
  if (!answers) return undefined;
  const panes = buildVensterPanes(
    answers,
    { cards: buildAssociationLibrary(locale).cards, domains: DOMAINS.map((d) => ({ id: d.id, label: d.short[locale] })) },
    dict.venster,
  );
  return <WindowFrame panes={panes} size="hero" title={dict.venster.nav.windowTitle} animateOpen />;
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

// Distinct from ErrorState: a genuinely failed generation (e.g. the
// Anthropic account ran out of credits) needs an explicit, user-triggered
// retry — a plain "refresh" link would just hit the same terminal "failed"
// row and show this exact same error again, which is correct (no more
// silent infinite regeneration) but leaves the buyer with no way forward.
// The form posts straight to retryPlanGeneration (a real server action,
// works without client JS) which deletes the failed row and redirects
// back here to start a genuinely fresh attempt.
function FailedState({
  dict,
  checkoutSessionId,
  testSessionId,
}: {
  dict: Dictionary["plan"];
  checkoutSessionId: string | null;
  testSessionId: string | null;
}) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <h1 className="font-serif text-3xl text-ink">{dict.errorHeading}</h1>
      <div className="mt-6 w-full rounded-2xl border border-red-200 bg-red-50 px-6 py-8">
        <p className="text-ink/70">{dict.errorFailed}</p>
        <form action={retryPlanGeneration} className="mt-4">
          {checkoutSessionId && (
            <input type="hidden" name="checkout_session_id" value={checkoutSessionId} />
          )}
          {testSessionId && <input type="hidden" name="test_session_id" value={testSessionId} />}
          <button
            type="submit"
            className="text-sm font-medium text-accent-dark underline"
          >
            {dict.retryButton}
          </button>
        </form>
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
        const waiting = err.sessionId ? await getWaitingContext(err.sessionId) : { answers: null, place: null };
        const g = dict.plan.generating;
        const orderRef = err.info?.orderRef ?? null;
        return (
          <GeneratingScreen
            heading={g.heading}
            copy={g}
            autoRefreshNote={g.autoRefreshNote}
            stalledNote={orderRef ? g.stalledOrder : g.stalledGeneric}
            orderRefLabel={orderRef ? g.orderRef.replace("{ref}", orderRef) : null}
            stage={err.stage}
            meta={err.info?.meta ?? null}
            place={displayPlace(waiting.place)}
            elapsedMs={elapsedSinceNow(err.info?.startedAt)}
            visual={waitingWindow(waiting.answers, locale, dict)}
          />
        );
      }
      if (err.reason === "failed") {
        return (
          <div className="flex min-h-full flex-col">
            <SiteHeader locale={locale} dict={dict.header} />
            <FailedState
              dict={dict.plan}
              checkoutSessionId={checkoutSessionId}
              testSessionId={testSessionId}
            />
          </div>
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

  const ideas = Array.isArray(plan.ideas_json)
    ? (plan.ideas_json as unknown as IdeaBookEntry[]).map(withValidLayers)
    : [];
  const wildcard =
    plan.wildcard_json && typeof plan.wildcard_json === "object"
      ? withValidLayers(plan.wildcard_json as unknown as IdeaBookEntry)
      : null;
  const labels = (plan.labels_json ?? {}) as Record<string, string>;

  // window_plans.pdf_url is a private-bucket storage path, not a fetchable
  // URL (see 0011_private_pdf_storage.sql + getSignedPdfUrl) — mint a
  // fresh short-lived signed URL on every render rather than ever storing
  // or reusing one.
  const pdfUrl = await getSignedPdfUrl(plan.pdf_url);

  // The quoted-back intake answers for the echo header. Read from the
  // plan's own session (not the cookie), so it also works for someone
  // opening the emailed link — and only ever shown here, never on the
  // public /shared/[id] page.
  const echoSource = await getIntakeEchoForSession(plan.session_id);
  const echo = buildPlanEcho(echoSource, dict.intake);
  // Books from the image intake echo the chosen images and say which image lies behind an idea.
  const vensterEcho = buildVensterEcho(echoSource, locale, dict.venster);
  const because = buildBecauseLines(ideas, wildcard, echoSource, locale, dict.venster);
  // The thread per door (R2.2), from what the book stored when it was written; absent for older books.
  const threads = buildIdeaThreads(ideas, wildcard, parseAssociationSources(plan.association_sources), locale);
  const dateLabel = new Intl.DateTimeFormat(locale === "nl" ? "nl-NL" : "en-GB", {
    day: "numeric",
    month: "long",
    timeZone: "Europe/Amsterdam",
  }).format(new Date(plan.created_at));

  // Reactions and "Dit ga ik doen" are only accepted from the session that
  // generated the plan (ownership check in plan/actions.ts) — hide the
  // controls for anyone else instead of showing buttons that would fail.
  const canInteract = (await getSessionId()) === plan.session_id;

  // The ideas a tester can pick in the questionnaire, numbered the way the reveal shows them (door order,
  // the wildcard last). Only the number and the kind of door go to the analytics, never the title.
  const feedbackDoors = [
    ...orderIdeasByDoor(ideas).map(({ idea }, i) => ({ number: i + 1, kind: idea.door, title: idea.title })),
    ...(wildcard ? [{ number: ideas.length + 1, kind: "wildcard" as const, title: wildcard.title }] : []),
  ];

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader locale={locale} dict={dict.header} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10 sm:px-10 sm:py-12">
        {plan.language !== locale && (
          <p className="mb-6 rounded-lg border border-border bg-paper px-4 py-3 text-sm text-ink/70">
            {dict.venster.errors.bookLanguage.replace("{language}", plan.language === "en" ? (locale === "nl" ? "Engels" : "English") : locale === "nl" ? "Nederlands" : "Dutch")}
          </p>
        )}
        <PlanReveal
          planId={plan.id}
          ideas={ideas}
          wildcard={wildcard}
          labels={labels}
          locale={locale}
          pdfChromeDict={dict.pdfChrome}
          planDict={dict.plan}
          pdfUrl={pdfUrl}
          shareUrl={`${process.env.NEXT_PUBLIC_SITE_URL}/shared/${plan.id}?utm_source=window_share&utm_medium=idea_book`}
          showEmailedCopy={!testSessionId}
          canInteract={canInteract}
          initialFeedback={plan.feedback_json ?? {}}
          initialCommittedKey={plan.committed_idea_key ?? null}
          echo={echo}
          dateLabel={dateLabel}
          vensterEcho={vensterEcho}
          because={because}
          threads={threads}
          vensterDict={dict.venster}
          siteUrl={process.env.NEXT_PUBLIC_SITE_URL}
        />
        {testFeedbackEnabled(process.env.NEXT_PUBLIC_TEST_FEEDBACK) && (
          <TestFeedback planId={plan.id} locale={locale} price={formatPrice(locale)} dict={dict.venster.feedback} doors={feedbackDoors} />
        )}
      </main>
    </div>
  );
}
