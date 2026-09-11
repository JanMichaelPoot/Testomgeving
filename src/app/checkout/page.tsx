import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionId } from "@/lib/session";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/window/SiteHeader";
import { CheckoutPanel } from "@/components/window/CheckoutPanel";
import { getLocale } from "@/lib/language";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { formatPrice } from "@/lib/pricing";

export async function generateMetadata(): Promise<Metadata> {
  const dict = getDictionary(await getLocale());
  return { title: dict.checkout.pageTitle };
}

export default async function CheckoutPage() {
  const sessionId = await getSessionId();
  if (!sessionId) redirect("/intake");

  const supabase = createServiceRoleClient();

  const { data: intake } = await supabase
    .from("intake_answers")
    .select("id")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!intake) redirect("/intake");

  const locale = await getLocale();
  const dict = getDictionary(locale);
  const price = formatPrice(locale);

  return (
    <div className="flex min-h-full flex-col bg-cream">
      <SiteHeader locale={locale} dict={dict.header} />
      <main className="mx-auto w-full max-w-xl flex-1 px-6 py-12 sm:px-10">
        <Link
          href="/intake"
          className="mb-8 inline-flex items-center gap-2 text-sm text-ink/60 transition-colors hover:text-accent"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M13 8H3M7 4L3 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {dict.intake.back}
        </Link>

        <div className="rounded-3xl border border-gold/30 bg-paper p-8 shadow-sm sm:p-10">
          <div className="mb-8 flex items-start justify-between gap-4 border-b border-ink/8 pb-8">
            <div>
              <h1 className="font-serif text-3xl font-semibold text-ink">{dict.checkout.heading}</h1>
              <p className="mt-1 max-w-xs text-sm text-ink/60">{dict.checkout.subcopy}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-serif text-4xl font-semibold text-accent">{price}</p>
              <p className="text-xs text-ink/50">{dict.checkout.priceCaption}</p>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="mb-5 text-sm font-medium text-ink">{dict.checkout.stepsHeading}</h2>
            <ol className="flex flex-col gap-4">
              {dict.checkout.steps.map((step, i) => (
                <li key={i} className="flex items-start gap-4">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-medium text-white">
                    {i + 1}
                  </span>
                  <span className="text-sm leading-relaxed text-ink/70">
                    {step.replace("{price}", price)}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <CheckoutPanel dict={dict.checkout} />
        </div>
      </main>
    </div>
  );
}
