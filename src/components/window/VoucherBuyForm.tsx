"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { ComplianceCheckbox } from "@/components/window/CheckoutPanel";
import { isRedirectError } from "@/lib/isRedirectError";
import { trackEvent } from "@/lib/posthog/client";
import { createVoucherCheckout } from "@/app/cadeaubon/actions";
import { fill, type GiftCopy } from "@/lib/i18n/gift";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { MESSAGE_MAX, NAME_MAX, isValidEmail } from "@/lib/voucher/text";

// The form on /cadeaubon. The server action re-checks everything (the disabled button is a convenience, not the gate).
export function VoucherBuyForm({
  copy,
  checkout,
  price,
  priceVariant,
}: {
  copy: GiftCopy["buy"];
  checkout: Dictionary["checkout"];
  price: string;
  priceVariant: string | null;
}) {
  const [recipientName, setRecipientName] = useState("");
  const [giverName, setGiverName] = useState("");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [deliveryConsent, setDeliveryConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    trackEvent("gift_voucher_viewed", { price_variant: priceVariant ?? "none" });
  }, [priceVariant]);

  const emailOk = email.trim() === "" || isValidEmail(email.trim());
  const canSubmit = termsAccepted && deliveryConsent && emailOk;

  function submit() {
    if (!canSubmit) return;
    trackEvent("gift_voucher_pay_clicked", { has_message: message.trim().length > 0, price_variant: priceVariant ?? "none" });
    setError(null);
    startTransition(async () => {
      try {
        await createVoucherCheckout({ recipientName, giverName, message, email: email.trim(), termsAccepted, deliveryConsent });
      } catch (err) {
        // redirect() to Stripe throws internally on success: let that go through.
        if (isRedirectError(err)) throw err;
        setError(err instanceof Error && err.message ? err.message : copy.errorGeneric);
      }
    });
  }

  const input = "mt-1.5 w-full rounded-lg border border-border bg-paper px-3.5 py-2.5 text-[15px] text-ink outline-none placeholder:text-ink/60 focus:border-ink";
  const label = "block text-xs font-medium uppercase tracking-widest text-ink/70";
  const hint = "mt-1.5 text-xs text-ink/70";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex flex-col gap-6"
      noValidate
    >
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="v-recipient" className={label}>
            {copy.form.recipientLabel}
          </label>
          <input id="v-recipient" className={input} value={recipientName} maxLength={NAME_MAX} autoComplete="off" onChange={(e) => setRecipientName(e.target.value)} />
          <p className={hint}>{copy.form.recipientHint}</p>
        </div>
        <div>
          <label htmlFor="v-giver" className={label}>
            {copy.form.giverLabel}
          </label>
          <input id="v-giver" className={input} value={giverName} maxLength={NAME_MAX} autoComplete="given-name" onChange={(e) => setGiverName(e.target.value)} />
          <p className={hint}>{copy.form.giverHint}</p>
        </div>
      </div>

      <div>
        <label htmlFor="v-message" className={label}>
          {copy.form.messageLabel}
        </label>
        <textarea id="v-message" className={`${input} min-h-28 resize-y`} value={message} maxLength={MESSAGE_MAX} rows={4} onChange={(e) => setMessage(e.target.value)} />
        <p className={`${hint} flex justify-between gap-4`}>
          <span>{copy.form.messageHint}</span>
          <span aria-live="polite" className="shrink-0 tabular-nums">
            {message.length}/{MESSAGE_MAX}
          </span>
        </p>
      </div>

      <div>
        <label htmlFor="v-email" className={label}>
          {copy.form.emailLabel}
        </label>
        <input id="v-email" type="email" autoComplete="email" className={input} value={email} aria-invalid={!emailOk} onChange={(e) => setEmail(e.target.value)} />
        <p className={hint}>{copy.form.emailHint}</p>
      </div>

      <div className="rounded-lg border border-gold/40 bg-gold/10 p-4">
        <p className="text-sm font-medium text-ink">{copy.consentHeading}</p>
        <p className="mt-1 text-xs leading-relaxed text-ink/70">{copy.consentBody}</p>
      </div>

      <div className="flex flex-col gap-4">
        <ComplianceCheckbox checked={deliveryConsent} onChange={setDeliveryConsent}>
          {copy.consentLabel}
        </ComplianceCheckbox>
        <ComplianceCheckbox checked={termsAccepted} onChange={setTermsAccepted}>
          {checkout.termsAcceptanceLabelPrefix}{" "}
          <Link href="/terms" target="_blank" className="underline underline-offset-2 hover:text-ink">
            {checkout.termsAcceptanceLinkText}
          </Link>{" "}
          {checkout.termsAcceptanceLabelSuffix}
        </ComplianceCheckbox>
      </div>

      <p className="flex flex-wrap gap-x-4 text-xs text-ink/70">
        <Link href="/herroepingsrecht" target="_blank" className="inline-flex min-h-11 items-center underline underline-offset-2 hover:text-ink">
          {checkout.legalLinks.withdrawal}
        </Link>
        <Link href="/privacy" target="_blank" className="inline-flex min-h-11 items-center underline underline-offset-2 hover:text-ink">
          {checkout.legalLinks.privacy}
        </Link>
      </p>

      {error && (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <Button type="submit" size="lg" disabled={!canSubmit || isPending} className="w-full justify-center">
        {isPending ? copy.ctaPending : fill(copy.cta, { price })}
      </Button>
    </form>
  );
}
