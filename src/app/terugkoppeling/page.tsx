import type { Metadata } from "next";
import { SiteHeader } from "@/components/window/SiteHeader";
import { SiteFooter } from "@/components/window/SiteFooter";
import { CheckinFlow } from "@/components/window/CheckinFlow";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/language";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getCheckinCopy } from "@/lib/i18n/checkin";
import { getBookFeedbackCopy } from "@/lib/i18n/bookFeedback";
import { readFollowUpToken } from "@/lib/followup/token";
import { parseCheckinAnswer } from "@/lib/checkin";
import { loadFriendCodesToShare } from "@/lib/bookFeedbackData";
import { friendLink, friendWhatsAppUrl } from "@/lib/friendCode";
import { formatAmount } from "@/lib/pricing";
import { isFreeOrderId } from "@/lib/freeTest";
import { siteUrl as getSiteUrl } from "@/lib/siteUrl";

// The page behind the three buttons of the check-in mail (Step 243). The signed token in the link names the book (no login); opening it with an answer
// records that answer (from the browser, see CheckinFlow). Shown in the language the book was written in, like the mail. Out of search results.
export async function generateMetadata(): Promise<Metadata> {
  return { title: getCheckinCopy(await getLocale()).page.title, robots: { index: false, follow: false } };
}

export default async function CheckinPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const siteLocale = await getLocale();
  const dict = getDictionary(siteLocale);
  const sp = await props.searchParams;
  const token = typeof sp.t === "string" ? sp.t : "";
  const planId = readFollowUpToken("checkin", token);

  const supabase = createServiceRoleClient();
  const { data: plan } = planId ? await supabase.from("window_plans").select("id, session_id, language").eq("id", planId).eq("status", "ready").maybeSingle() : { data: null };

  const shell = (children: React.ReactNode) => (
    <div className="flex min-h-full flex-col">
      <SiteHeader locale={siteLocale} dict={dict.header} />
      <main className="mx-auto w-full max-w-xl flex-1 px-5 py-12 sm:px-10 sm:py-16">{children}</main>
      <SiteFooter locale={siteLocale} dict={dict.footer} />
    </div>
  );

  if (!plan) {
    const page = getCheckinCopy(siteLocale).page;
    return shell(
      <>
        <h1 className="font-serif text-[30px] leading-tight text-ink sm:text-4xl">WindowInto</h1>
        <p className="mt-4 text-[17px] leading-relaxed text-ink/75" role="status">
          {page.invalid}
        </p>
      </>,
    );
  }

  const locale = plan.language === "en" ? "en" : "nl";
  const copy = getCheckinCopy(locale).page;
  const friendCopy = getBookFeedbackCopy(locale);
  const site = getSiteUrl();

  // What was answered before (the buyer came back), the way back to the book, and the friend codes that can still be passed on.
  const loose = supabase as unknown as { from: (t: string) => { select: (c: string) => { eq: (k: string, v: string) => { maybeSingle: () => Promise<{ data: unknown }> } } } };
  const [{ data: stored }, { data: payments }, friendCodes] = await Promise.all([
    loose.from("book_checkins").select("answer, comment, quote_consent").eq("plan_id", plan.id).maybeSingle(),
    supabase.from("payments").select("stripe_payment_id").eq("session_id", plan.session_id).eq("status", "succeeded"),
    loadFriendCodesToShare(supabase, plan.session_id),
  ]);
  const prior = stored as { answer: string; comment: string | null; quote_consent: boolean } | null;
  const order = (payments ?? []).map((p) => p.stripe_payment_id).find((id) => id && !isFreeOrderId(id));
  const amount = friendCodes[0] ? formatAmount(friendCodes[0].amountCents, "eur", locale) : "";
  const message = friendCopy.friendMessage.replace("{amount}", amount);

  return shell(
    <>
      <h1 className="font-serif text-[30px] leading-tight text-ink sm:text-4xl">{copy.title}</h1>
      <div className="mt-8">
        <CheckinFlow
          token={token}
          copy={copy}
          friendCopy={friendCopy}
          initialAnswer={parseCheckinAnswer(sp.a) ?? parseCheckinAnswer(prior?.answer)}
          initialComment={prior?.comment ?? ""}
          initialConsent={prior?.quote_consent === true}
          bookHref={order ? `/plan?checkout_session_id=${encodeURIComponent(order)}` : null}
          friends={friendCodes.map((c) => ({ code: c.code, whatsappUrl: friendWhatsAppUrl(message, friendLink(site, locale, c.code)) }))}
          friendAmount={amount}
          friendDate={
            friendCodes[0] ? new Intl.DateTimeFormat(locale === "nl" ? "nl-NL" : "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Amsterdam" }).format(friendCodes[0].expiresAt) : ""
          }
        />
      </div>
    </>,
  );
}
