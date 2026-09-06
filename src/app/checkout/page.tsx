import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionId } from "@/lib/session";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/window/SiteHeader";
import { CheckoutPanel } from "@/components/window/CheckoutPanel";
import { getLocale } from "@/lib/language";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isPreviewBypassAllowed } from "@/lib/previewBypass";

export async function generateMetadata(): Promise<Metadata> {
  const dict = getDictionary(await getLocale());
  return { title: dict.checkout.pageTitle };
}

export default async function CheckoutPage(props: PageProps<"/checkout">) {
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

  const searchParams = await props.searchParams;
  const previewToken =
    typeof searchParams.preview === "string" ? searchParams.preview : undefined;

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader locale={locale} dict={dict.header} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12 sm:px-10">
        <h1 className="font-serif text-3xl text-ink sm:text-4xl">
          {dict.checkout.heading}
        </h1>
        <p className="mt-2 max-w-xl text-ink/60">{dict.checkout.subcopy}</p>

        <div className="mt-10">
          <CheckoutPanel
            isTestMode={isPreviewBypassAllowed(previewToken)}
            previewToken={previewToken}
            dict={dict.checkout}
          />
        </div>
      </main>
    </div>
  );
}
