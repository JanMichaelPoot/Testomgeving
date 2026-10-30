import type { Metadata } from "next";
import { SiteHeader } from "@/components/window/SiteHeader";
import { SiteFooter } from "@/components/window/SiteFooter";
import { Button } from "@/components/ui/Button";
import { getLocale } from "@/lib/language";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getGiftCopy } from "@/lib/i18n/gift";
import { lookupCode } from "@/app/cadeau/actions";

// Where a recipient types the code from the card. The link on the card (and in the mail) goes straight to /cadeau/<code>.
export async function generateMetadata(): Promise<Metadata> {
  const copy = getGiftCopy(await getLocale());
  return { title: copy.redeem.pageTitle, robots: { index: false, follow: false } };
}

export default async function EnterCodePage(props: PageProps<"/cadeau">) {
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const copy = getGiftCopy(locale).redeem;
  const searchParams = await props.searchParams;
  const invalid = searchParams.error === "invalid";

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader locale={locale} dict={dict.header} />
      <main className="mx-auto w-full max-w-xl flex-1 px-5 py-12 sm:px-10 sm:py-16">
        <h1 className="font-serif text-[30px] leading-tight text-ink sm:text-4xl">{copy.enterHeading}</h1>
        <p className="mt-3 text-[17px] leading-relaxed text-ink/75">{copy.enterSub}</p>
        <form action={lookupCode} className="mt-8 flex flex-col gap-4">
          <div>
            <label htmlFor="code" className="block text-xs font-medium uppercase tracking-widest text-ink/70">
              {copy.enterLabel}
            </label>
            <input
              id="code"
              name="code"
              required
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder={copy.enterPlaceholder}
              aria-invalid={invalid}
              aria-describedby={invalid ? "code-error" : undefined}
              className="mt-1.5 w-full rounded-lg border border-border bg-paper px-3.5 py-3 font-mono text-lg tracking-wider text-ink outline-none placeholder:text-ink/50 focus:border-ink"
            />
          </div>
          {invalid && (
            <p id="code-error" className="text-sm text-red-700" role="alert">
              {copy.states.invalid}
            </p>
          )}
          <Button type="submit" size="lg" className="w-full justify-center">
            {copy.enterButton}
          </Button>
        </form>
      </main>
      <SiteFooter locale={locale} dict={dict.footer} />
    </div>
  );
}
