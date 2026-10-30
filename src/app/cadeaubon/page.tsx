import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/window/SiteHeader";
import { SiteFooter } from "@/components/window/SiteFooter";
import { VoucherBuyForm } from "@/components/window/VoucherBuyForm";
import { getLocale } from "@/lib/language";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getGiftCopy } from "@/lib/i18n/gift";
import { getVisitorPrice } from "@/lib/visitorPrice";

// The gift voucher (improvement brief B3): the giver pays once and gets a code, a printable card and a link; the recipient redeems it
// (src/app/cadeau). Public, nothing personal on the page itself.
export async function generateMetadata(): Promise<Metadata> {
  const copy = getGiftCopy(await getLocale());
  return { title: copy.buy.pageTitle, description: copy.buy.sub, alternates: { canonical: "/cadeaubon" } };
}

export default async function GiftVoucherPage(props: PageProps<"/cadeaubon">) {
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const copy = getGiftCopy(locale);
  const searchParams = await props.searchParams;
  const price = await getVisitorPrice("gift");

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader locale={locale} dict={dict.header} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10 sm:px-10 sm:py-14">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-14">
          <section aria-labelledby="gift-heading">
            <p className="text-xs font-bold uppercase tracking-[0.09em] text-gold-text">{copy.buy.kicker}</p>
            <h1 id="gift-heading" className="mt-2 font-serif text-[30px] leading-tight text-ink sm:text-4xl">
              {copy.buy.heading}
            </h1>
            <p className="mt-4 text-[17px] leading-relaxed text-ink/75">{copy.buy.sub}</p>

            <div className="mt-6 flex items-baseline gap-2 rounded-lg bg-surface-active px-4 py-3">
              <span className="font-serif text-3xl font-semibold text-ink">{price.label(locale)}</span>
              <span className="text-xs text-ink/70">{copy.buy.priceCaption}</span>
            </div>

            <ul className="mt-6 flex flex-col gap-3">
              {copy.buy.included.map((line) => (
                <li key={line} className="flex items-start gap-3 text-[15px] leading-relaxed text-ink/80">
                  <span aria-hidden="true" className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-gold-light text-accent-dark">
                    <svg width="9" height="9" viewBox="0 0 12 10" fill="none">
                      <path d="M1 5l3.5 4L11 1" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  {line}
                </li>
              ))}
            </ul>

            <div className="mt-8 rounded-lg border border-border bg-paper p-5">
              <h2 className="text-sm font-semibold text-ink">{copy.buy.differentTitle}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-ink/75">{copy.buy.differentBody}</p>
              <Link href="/intake?for=gift" className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-accent-dark underline underline-offset-4">
                {copy.buy.differentLink}
              </Link>
            </div>
          </section>

          <section aria-label={copy.buy.heading} className="rounded-lg border border-border bg-paper p-5 sm:p-8">
            {searchParams.payment === "cancelled" && (
              <p className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                {dict.checkout.errorPaymentFailed}
              </p>
            )}
            <VoucherBuyForm copy={copy.buy} checkout={dict.checkout} price={price.label(locale)} priceVariant={price.variant} />
          </section>
        </div>
      </main>
      <SiteFooter locale={locale} dict={dict.footer} />
    </div>
  );
}
