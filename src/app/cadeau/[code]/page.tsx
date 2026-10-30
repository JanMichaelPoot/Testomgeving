import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/window/SiteHeader";
import { SiteFooter } from "@/components/window/SiteFooter";
import { VoucherStartForm } from "@/components/window/VoucherStartForm";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/language";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { fill, getGiftCopy } from "@/lib/i18n/gift";
import { normalizeCode, voucherState, type VoucherState } from "@/lib/voucher/code";
import { findVoucherByCode } from "@/lib/voucher/store";

// The page the link on the card and in the mail opens: for a code that can be redeemed, a warm greeting with the giver's message and the one
// button that starts the intake; for any other state, the plain reason. Never indexed (the code is in the address).
export async function generateMetadata(): Promise<Metadata> {
  const copy = getGiftCopy(await getLocale());
  return { title: copy.redeem.pageTitle, robots: { index: false, follow: false }, referrer: "no-referrer" };
}

export default async function RedeemPage(props: PageProps<"/cadeau/[code]">) {
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const copy = getGiftCopy(locale).redeem;
  const { code: rawCode } = await props.params;

  const code = normalizeCode(decodeURIComponent(rawCode));
  const voucher = code ? await findVoucherByCode(createServiceRoleClient(), code) : null;
  const state: VoucherState | "invalid" | "notFound" = !code ? "invalid" : !voucher ? "notFound" : voucherState(voucher);

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader locale={locale} dict={dict.header} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-12 sm:px-10 sm:py-16">
        {state === "ok" && voucher ? (
          <>
            <p className="text-xs font-bold uppercase tracking-[0.09em] text-gold-text">{voucher.giver_name ? fill(copy.fromLine, { name: voucher.giver_name }) : copy.fromAnon}</p>
            <h1 className="mt-2 font-serif text-[30px] leading-tight text-ink sm:text-4xl">
              {voucher.recipient_name ? fill(copy.headingNamed, { name: voucher.recipient_name }) : copy.headingAnon}
            </h1>
            {voucher.message && (
              <blockquote className="mt-6 whitespace-pre-line rounded-lg border-l-4 border-gold bg-surface-active px-5 py-4 font-serif text-xl italic leading-relaxed text-ink">
                {voucher.message}
              </blockquote>
            )}
            <p className="mt-6 text-[17px] leading-relaxed text-ink/75">{copy.sub}</p>
            <ol className="mt-6 flex flex-col gap-3">
              {copy.steps.map((step, i) => (
                <li key={step} className="flex items-start gap-3 text-[15px] leading-relaxed text-ink/80">
                  <span aria-hidden="true" className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-dark text-xs font-bold text-white">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
            <div className="mt-8">
              <VoucherStartForm code={voucher.code} label={copy.button} pendingLabel={copy.buttonPending} />
              <p className="mt-3 text-sm text-ink/70">{copy.giftNote}</p>
            </div>
          </>
        ) : (
          <section className="rounded-lg border border-border bg-paper p-6">
            <h1 className="font-serif text-2xl text-ink">{copy.enterHeading}</h1>
            <p className="mt-3 text-ink/80" role="alert">
              {copy.states[state === "ok" ? "notFound" : state]}
            </p>
            <p className="mt-3 text-sm text-ink/70">{copy.problemHelp}</p>
            <Link href="/cadeau" className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-accent-dark underline underline-offset-4">
              {copy.enterButton}
            </Link>
          </section>
        )}
      </main>
      <SiteFooter locale={locale} dict={dict.footer} />
    </div>
  );
}
