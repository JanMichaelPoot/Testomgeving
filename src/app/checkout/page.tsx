import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionId } from "@/lib/session";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/window/SiteHeader";
import { CheckoutPanel } from "@/components/window/CheckoutPanel";
import { TestModeBanner } from "@/components/window/TestModeBanner";
import { LUXURY_ILLUSTRATIONS } from "@/lib/illustrations";
import { getLocale } from "@/lib/language";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { formatPrice } from "@/lib/pricing";
import { DOMAINS, getActivity } from "@/lib/discovery/library";
import { buildChoiceGroups } from "@/lib/checkoutChoices";
import { getDeviceId } from "@/lib/discovery/historyStore";
import type { StoredIntake } from "@/app/intake/actions";

export async function generateMetadata(): Promise<Metadata> {
  const dict = getDictionary(await getLocale());
  return { title: dict.checkout.pageTitle };
}

export default async function CheckoutPage(props: PageProps<"/checkout">) {
  const sessionId = await getSessionId();
  if (!sessionId) redirect("/intake");

  const searchParams = await props.searchParams;
  // Stripe sends the buyer back to this URL both when they cancel and when
  // a synchronous payment method (e.g. a declined card) fails outright —
  // see the `?payment=cancelled` marker on cancel_url in
  // src/app/checkout/actions.ts. Section 24's exact wording for this case.
  const paymentFailed = searchParams.payment === "cancelled";

  const supabase = createServiceRoleClient();

  const { data: intake } = await supabase
    .from("intake_answers")
    .select("id, raw_json")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!intake) redirect("/intake");

  const locale = await getLocale();
  const dict = getDictionary(locale);
  const price = formatPrice(locale);

  // "Jouw keuzes": what the book will be based on, each group with a link to change it.
  const groups = buildChoiceGroups(
    intake.raw_json as unknown as StoredIntake,
    dict.intake,
    dict.checkout.choicesGroups,
    dict.checkout.choicesSurprise,
    {
      activity: (id) => getActivity(id)?.label[locale] ?? null,
      domain: (id) => DOMAINS.find((d) => d.id === id)?.short[locale] ?? null,
    },
  );
  const rememberInitially = (await getDeviceId()) !== null;

  return (
    <div className="flex min-h-full flex-col bg-cream">
      <SiteHeader locale={locale} dict={dict.header} />
      <TestModeBanner dict={dict.checkout} />
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12 sm:px-10">
        <Link
          href="/intake?edit=1"
          className="mb-8 inline-flex items-center gap-2 text-sm text-ink/60 transition-colors hover:text-ink"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M13 8H3M7 4L3 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {dict.intake.back}
        </Link>

        {paymentFailed && (
          <p
            className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            role="alert"
          >
            {dict.checkout.errorPaymentFailed}
          </p>
        )}

        <div className="grid gap-6 rounded-lg border border-border bg-paper p-8 sm:p-10 lg:grid-cols-[1fr_1.1fr]">
          {/* Left: order summary */}
          <div className="lg:border-r lg:border-border lg:pr-10">
            {/* Same still life as the landing hero, cropped wider here —
                an intentional bookend: the window that's about to open. */}
            <div className="relative mb-6 aspect-[16/9] overflow-hidden rounded-lg border border-border bg-cream">
              <Image
                src={LUXURY_ILLUSTRATIONS.windowView}
                alt=""
                fill
                sizes="(min-width: 1024px) 30vw, 90vw"
                className="object-cover"
              />
            </div>

            <h1 className="font-sans text-2xl font-semibold tracking-[-0.02em] text-ink sm:text-3xl">
              {dict.checkout.heading}
            </h1>
            <p className="mt-1 text-sm text-ink/60">{dict.checkout.subcopy}</p>

            <div className="mt-6 flex items-baseline gap-2 rounded-lg bg-surface-active px-4 py-3">
              <span className="font-serif text-3xl font-semibold text-ink">{price}</span>
              <span className="text-xs text-ink/50">{dict.checkout.priceCaption}</span>
            </div>

            <h2 className="mt-8 text-sm font-medium text-ink">{dict.checkout.stepsHeading}</h2>
            <ol className="relative mt-5 flex flex-col gap-6">
              {dict.checkout.steps.map((step, i) => (
                <li key={i} className="relative flex items-start gap-4">
                  {i < dict.checkout.steps.length - 1 && (
                    <span
                      aria-hidden="true"
                      className="absolute left-3 top-7 h-[calc(100%+0.5rem)] w-px bg-border"
                    />
                  )}
                  <span className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-ink text-white">
                    <svg width="12" height="10" viewBox="0 0 12 10" fill="none" aria-hidden="true">
                      <path d="M1 5l3.5 4L11 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span className="pt-0.5 text-sm leading-relaxed text-ink/70">
                    {step.replace("{price}", price)}
                  </span>
                </li>
              ))}
            </ol>

            <h2 className="mt-10 text-sm font-medium text-ink">{dict.checkout.choicesHeading}</h2>
            <p className="mt-1 text-xs text-ink/50">{dict.checkout.choicesHint}</p>
            <dl className="mt-4 divide-y divide-border rounded-lg border border-border">
              {groups.map((group) => (
                <div key={group.id} className="flex items-start justify-between gap-4 px-4 py-3">
                  <div className="min-w-0">
                    <dt className="text-xs font-medium uppercase tracking-widest text-ink/45">{group.label}</dt>
                    <dd className="mt-1 text-sm leading-relaxed text-ink/80">
                      {group.lines.length > 0 ? (
                        group.lines.map((line, i) => (
                          <span key={i} className="block break-words">
                            {line}
                          </span>
                        ))
                      ) : (
                        <span className="text-ink/40">{dict.checkout.choicesNone}</span>
                      )}
                    </dd>
                  </div>
                  <Link
                    href={`/intake?edit=1&page=${group.page}`}
                    className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-accent underline underline-offset-2 hover:text-accent-dark"
                  >
                    {dict.checkout.choicesEdit}
                    <span className="sr-only"> — {group.label}</span>
                  </Link>
                </div>
              ))}
            </dl>
          </div>

          {/* Right: gift/waiver/payment */}
          <div className="lg:pl-0">
            <CheckoutPanel dict={dict.checkout} price={price} rememberInitially={rememberInitially} />
          </div>
        </div>
      </main>
    </div>
  );
}
