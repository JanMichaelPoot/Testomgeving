import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/window/SiteHeader";
import { SiteFooter } from "@/components/window/SiteFooter";
import { VoucherShare } from "@/components/window/VoucherShare";
import { getLocale } from "@/lib/language";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { fill, getGiftCopy } from "@/lib/i18n/gift";
import { activateAfterPayment, redeemUrlFor, type ActivationResult } from "@/lib/voucher/activate";
import { formatCardDate } from "@/lib/pdf/giftCard";

// Where Stripe sends the giver after paying. Asks Stripe whether the payment is in and activates the voucher (once; the webhook may get there
// first, which is fine). Nothing is shown for a session id that is not a voucher payment.
export async function generateMetadata(): Promise<Metadata> {
  const copy = getGiftCopy(await getLocale());
  return { title: copy.done.pageTitle, robots: { index: false, follow: false } };
}

export default async function GiftVoucherReadyPage(props: PageProps<"/cadeaubon/klaar">) {
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const copy = getGiftCopy(locale).done;
  const searchParams = await props.searchParams;
  const checkoutSessionId = typeof searchParams.checkout_session_id === "string" ? searchParams.checkout_session_id : "";

  let result: ActivationResult = { state: "unknown" };
  if (checkoutSessionId) {
    try {
      result = await activateAfterPayment(checkoutSessionId);
    } catch (err) {
      console.error("WINDOW: could not activate the gift voucher:", err);
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader locale={locale} dict={dict.header} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-10 sm:px-10 sm:py-14">
        {result.state === "ready" ? (
          (() => {
            const v = result.voucher;
            const link = redeemUrlFor(v.code);
            const date = v.expires_at ? formatCardDate(new Date(v.expires_at), locale) : "";
            const cardHref = `/api/cadeaubon/kaart?code=${encodeURIComponent(v.code)}`;
            const button = "inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-cream px-4 text-sm font-semibold text-ink transition-colors hover:border-ink";
            return (
              <>
                <h1 className="font-serif text-[30px] leading-tight text-ink sm:text-4xl">
                  {v.recipient_name ? fill(copy.headingFor, { name: v.recipient_name }) : copy.heading}
                </h1>
                <p className="mt-4 text-[17px] leading-relaxed text-ink/75">{copy.sub}</p>

                <section aria-label={copy.codeLabel} className="mt-8 rounded-lg border border-gold/40 bg-gold/10 p-6">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-gold-text">{copy.codeLabel}</p>
                  <p className="mt-2 break-all font-mono text-2xl font-bold tracking-wider text-ink select-all sm:text-3xl">{v.code}</p>
                  <p className="mt-2 text-sm text-ink/70">
                    {fill(copy.validUntil, { date })} · {copy.singleUse}
                  </p>
                </section>

                <div className="mt-6 flex flex-wrap gap-3">
                  <a href={cardHref} className="inline-flex min-h-11 items-center justify-center rounded-lg bg-accent-dark px-5 text-sm font-semibold text-white transition-colors hover:bg-accent">
                    {copy.downloadA5}
                  </a>
                  <a href={`${cardHref}&format=a6`} className={button}>
                    {copy.downloadA6}
                  </a>
                </div>

                <div className="mt-6">
                  <VoucherShare copy={copy} link={link} />
                </div>

                <p className="mt-6 text-sm text-ink/70" role="status">
                  {v.email_sent_at && v.buyer_email ? fill(copy.emailed, { email: v.buyer_email }) : copy.emailPending}
                </p>

                <section className="mt-10" aria-labelledby="how-heading">
                  <h2 id="how-heading" className="font-serif text-2xl text-ink">
                    {copy.howHeading}
                  </h2>
                  <ol className="mt-4 flex flex-col gap-3">
                    {copy.howSteps.map((step, i) => (
                      <li key={step} className="flex items-start gap-3 text-[15px] leading-relaxed text-ink/80">
                        <span aria-hidden="true" className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-dark text-xs font-bold text-white">
                          {i + 1}
                        </span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </section>
              </>
            );
          })()
        ) : result.state === "unpaid" ? (
          <section className="rounded-lg border border-border bg-paper p-6">
            <h1 className="font-serif text-2xl text-ink">{copy.unpaidTitle}</h1>
            <p className="mt-3 text-ink/75">{copy.unpaidBody}</p>
            <Link href={`/cadeaubon/klaar?checkout_session_id=${encodeURIComponent(checkoutSessionId)}`} className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-accent-dark underline underline-offset-4">
              {copy.refresh}
            </Link>
          </section>
        ) : (
          <section className="rounded-lg border border-border bg-paper p-6">
            <p className="text-ink/75">{copy.notFound}</p>
          </section>
        )}
      </main>
      <SiteFooter locale={locale} dict={dict.footer} />
    </div>
  );
}
