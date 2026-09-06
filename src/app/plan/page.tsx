import type { Metadata } from "next";
import { SiteHeader } from "@/components/window/SiteHeader";
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
}: {
  message: string;
  dict: Dictionary["plan"];
}) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <h1 className="font-serif text-3xl text-ink">{dict.errorHeading}</h1>
      <div className="mt-6 w-full rounded-2xl border border-red-200 bg-red-50 px-6 py-8">
        <p className="text-ink/70">{message}</p>
        <a
          href="/plan"
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
    process.env.NODE_ENV !== "production" &&
    typeof searchParams.test_session_id === "string"
      ? searchParams.test_session_id
      : null;

  if (!checkoutSessionId && !testSessionId) {
    return (
      <div className="flex min-h-full flex-col">
        <SiteHeader locale={locale} dict={dict.header} />
        <ErrorState message={dict.plan.errorNoPayment} dict={dict.plan} />
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
        <p className="text-xs font-medium uppercase tracking-widest text-accent-dark">
          {dict.plan.eyebrow}
        </p>
        <h1 className="mt-2 font-serif text-3xl text-ink sm:text-4xl">
          {plan.title}
        </h1>
        <p className="mt-4 text-ink/70">{plan.profile_summary}</p>

        {(mustHaves.length > 0 || preferences.length > 0) && (
          <div className="mt-6 flex flex-wrap gap-x-10 gap-y-4 text-sm">
            {mustHaves.length > 0 && (
              <div>
                <p className="text-xs font-medium uppercase tracking-widest text-accent-dark">
                  {dict.plan.mustHaves}
                </p>
                <ul className="mt-1 space-y-1 text-ink/70">
                  {mustHaves.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
            {preferences.length > 0 && (
              <div>
                <p className="text-xs font-medium uppercase tracking-widest text-accent-dark">
                  {dict.plan.preferences}
                </p>
                <ul className="mt-1 space-y-1 text-ink/70">
                  {preferences.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <h2 className="mt-10 text-xs font-medium uppercase tracking-widest text-accent-dark">
          {dict.plan.possibilitiesHeading}
        </h2>
        <ol className="mt-4 space-y-6">
          {ideas.map((idea, index) => (
            <li key={index}>
              <p className="font-serif text-xl text-ink">
                {index + 1}. {idea.title}
              </p>
              <p className="mt-1 text-ink/70">{idea.intro}</p>
            </li>
          ))}
        </ol>

        {wildcard && (
          <div className="mt-8 rounded-2xl border border-accent-dark/30 bg-cream px-6 py-5">
            <p className="text-xs font-medium uppercase tracking-widest text-accent-dark">
              {labels.wildcard_heading || dict.plan.wildcardFallback}
            </p>
            <p className="mt-2 font-serif text-lg text-ink">{wildcard.title}</p>
            <p className="mt-1 text-ink/70">{wildcard.intro}</p>
          </div>
        )}

        <div className="mt-10 flex flex-wrap items-center gap-4">
          {plan.pdf_url && (
            <a
              href={plan.pdf_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-accent-dark"
            >
              {dict.plan.downloadPdf}
            </a>
          )}
          {!testSessionId && (
            <p className="text-sm text-ink/50">{dict.plan.emailedCopy}</p>
          )}
        </div>
      </main>
    </div>
  );
}
