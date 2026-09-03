import { SiteHeader } from "@/components/window/SiteHeader";
import { getOrCreateWindowPlan, PlanNotReadyError } from "@/app/plan/data";

export const metadata = {
  title: "Your Window Plan — WINDOW",
};

function ErrorState({ message }: { message: string }) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <h1 className="font-serif text-3xl text-ink">Your Window Plan</h1>
      <div className="mt-6 w-full rounded-2xl border border-red-200 bg-red-50 px-6 py-8">
        <p className="text-ink/70">{message}</p>
        <a
          href="/plan"
          className="mt-4 inline-block text-sm font-medium text-accent-dark underline"
        >
          Refresh
        </a>
      </div>
    </main>
  );
}

export default async function PlanPage(props: PageProps<"/plan">) {
  const searchParams = await props.searchParams;
  const checkoutSessionId =
    typeof searchParams.checkout_session_id === "string"
      ? searchParams.checkout_session_id
      : null;

  if (!checkoutSessionId) {
    return (
      <div className="flex min-h-full flex-col">
        <SiteHeader />
        <ErrorState message="No payment reference was found. If you just paid, use the link from your confirmation email." />
      </div>
    );
  }

  let plan;
  let errorMessage: string | null = null;

  try {
    plan = await getOrCreateWindowPlan(checkoutSessionId);
  } catch (err) {
    if (err instanceof PlanNotReadyError) {
      errorMessage = err.message;
    } else {
      // Don't leak internal error details (API keys, stack traces) to the
      // user — log server-side and show a safe generic message instead.
      console.error("Failed to generate Window Plan:", err);
      errorMessage =
        "Something went wrong while putting your Window Plan together.";
    }
  }

  if (errorMessage || !plan) {
    return (
      <div className="flex min-h-full flex-col">
        <SiteHeader />
        <ErrorState message={errorMessage ?? "Something went wrong."} />
      </div>
    );
  }

  const steps = Array.isArray(plan.steps_json)
    ? (plan.steps_json as unknown[]).map(String)
    : [];

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12 sm:px-10">
        <p className="text-xs font-medium uppercase tracking-widest text-accent-dark">
          Your Window Plan
        </p>
        <h1 className="mt-2 font-serif text-3xl text-ink sm:text-4xl">
          {plan.title}
        </h1>
        <p className="mt-4 text-ink/70">{plan.why_it_fits}</p>

        <h2 className="mt-10 text-xs font-medium uppercase tracking-widest text-accent-dark">
          Steps
        </h2>
        <ol className="mt-4 space-y-3">
          {steps.map((step, index) => (
            <li key={index} className="flex gap-3 text-ink/80">
              <span className="font-serif text-accent-dark">{index + 1}.</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>

        <div className="mt-8 rounded-2xl border border-accent-dark/30 bg-cream px-6 py-5">
          <p className="text-xs font-medium uppercase tracking-widest text-accent-dark">
            First action
          </p>
          <p className="mt-2 text-ink">{plan.first_action}</p>
        </div>

        <div className="mt-6 flex gap-8 text-sm text-ink/60">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-accent-dark">
              Time
            </p>
            <p className="mt-1 text-ink">{plan.time_estimate}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-accent-dark">
              Cost
            </p>
            <p className="mt-1 text-ink">{plan.cost_estimate}</p>
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-4">
          {plan.pdf_url && (
            <a
              href={plan.pdf_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-accent-dark"
            >
              Download PDF
            </a>
          )}
          <p className="text-sm text-ink/50">
            We&rsquo;ve also emailed you a copy.
          </p>
        </div>
      </main>
    </div>
  );
}
