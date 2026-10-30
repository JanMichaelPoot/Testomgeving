import type { Metadata } from "next";
import { SiteHeader } from "@/components/window/SiteHeader";
import { SiteFooter } from "@/components/window/SiteFooter";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/language";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getGiftCopy } from "@/lib/i18n/gift";
import { readFollowUpToken } from "@/lib/followup/token";

// "No more e-mail from WindowInto", the link at the bottom of the follow-up mail: takes the stored address out of the book. Opening the link does it
// (there is nothing to confirm: it only ever removes something). A link that does not verify says so.
export async function generateMetadata(): Promise<Metadata> {
  const copy = getGiftCopy(await getLocale());
  return { title: copy.unsubscribe.title, robots: { index: false, follow: false } };
}

export default async function UnsubscribePage(props: PageProps<"/afmelden">) {
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const copy = getGiftCopy(locale).unsubscribe;
  const searchParams = await props.searchParams;
  const planId = readFollowUpToken("unsub", typeof searchParams.t === "string" ? searchParams.t : null);

  let ok = false;
  if (planId) {
    const { error } = await createServiceRoleClient().from("window_plans").update({ followup_email: null }).eq("id", planId);
    ok = !error;
  }

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader locale={locale} dict={dict.header} />
      <main className="mx-auto w-full max-w-xl flex-1 px-5 py-12 sm:px-10 sm:py-16">
        <h1 className="font-serif text-[30px] leading-tight text-ink sm:text-4xl">{ok ? copy.title : "WindowInto"}</h1>
        <p className="mt-4 text-[17px] leading-relaxed text-ink/75" role="status">
          {ok ? copy.body : copy.invalid}
        </p>
      </main>
      <SiteFooter locale={locale} dict={dict.footer} />
    </div>
  );
}
