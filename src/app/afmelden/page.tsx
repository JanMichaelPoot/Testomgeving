import type { Metadata } from "next";
import { SiteHeader } from "@/components/window/SiteHeader";
import { SiteFooter } from "@/components/window/SiteFooter";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/language";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getFollowUpCopy } from "@/lib/i18n/followUp";
import { getCheckinCopy } from "@/lib/i18n/checkin";
import { readFollowUpToken } from "@/lib/followup/token";
import { recordOptOut } from "@/lib/checkin/optout";

// "No more e-mail from WindowInto", the link at the bottom of the follow-up mail: takes the stored address out of the book. Opening the link does it
// (there is nothing to confirm: it only ever removes something). A link that does not verify says so.
//
// The link at the bottom of the check-in mail (Step 243) comes here too, with ?c= instead of ?t=: it notes (as a salted hash, never the address) that this
// person wants no more check-in mails, for this book and every later one.
export async function generateMetadata(): Promise<Metadata> {
  const copy = getFollowUpCopy(await getLocale());
  return { title: copy.unsubscribe.title, robots: { index: false, follow: false } };
}

export default async function UnsubscribePage(props: PageProps<"/afmelden">) {
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const searchParams = await props.searchParams;
  const supabase = createServiceRoleClient();

  let title = "WindowInto";
  let text: string;
  const checkinToken = typeof searchParams.c === "string" ? searchParams.c : null;
  if (checkinToken) {
    const copy = getCheckinCopy(locale).optout;
    const planId = readFollowUpToken("checkin-out", checkinToken);
    let ok = false;
    if (planId) {
      const { data: plan } = await supabase.from("window_plans").select("recipient_email").eq("id", planId).maybeSingle();
      const email = (plan as { recipient_email: string | null } | null)?.recipient_email;
      ok = !!email && (await recordOptOut(supabase, email));
    }
    if (ok) title = copy.title;
    text = ok ? copy.body : copy.invalid;
  } else {
    const copy = getFollowUpCopy(locale).unsubscribe;
    const planId = readFollowUpToken("unsub", typeof searchParams.t === "string" ? searchParams.t : null);
    let ok = false;
    if (planId) {
      const { error } = await supabase.from("window_plans").update({ followup_email: null }).eq("id", planId);
      ok = !error;
    }
    if (ok) title = copy.title;
    text = ok ? copy.body : copy.invalid;
  }

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader locale={locale} dict={dict.header} />
      <main className="mx-auto w-full max-w-xl flex-1 px-5 py-12 sm:px-10 sm:py-16">
        <h1 className="font-serif text-[30px] leading-tight text-ink sm:text-4xl">{title}</h1>
        <p className="mt-4 text-[17px] leading-relaxed text-ink/75" role="status">
          {text}
        </p>
      </main>
      <SiteFooter locale={locale} dict={dict.footer} />
    </div>
  );
}
