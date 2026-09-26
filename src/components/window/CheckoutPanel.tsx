"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { isRedirectError } from "@/lib/isRedirectError";
import { trackEvent } from "@/lib/posthog/client";
import { createCheckoutSession } from "@/app/checkout/actions";
import type { Dictionary } from "@/lib/i18n/dictionaries";

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// Shared visual for both compliance checkboxes below — kept as one small
// component so the two stay pixel-identical (same tap target, same check
// animation) rather than drifting apart as two copy-pasted blocks.
function ComplianceCheckbox({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="group flex cursor-pointer items-start gap-3">
      <span
        aria-hidden="true"
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
          checked ? "border-ink bg-ink" : "border-ink/25 bg-paper group-hover:border-ink/50"
        }`}
      >
        {checked && (
          <svg width="12" height="10" viewBox="0 0 12 10" fill="none" aria-hidden="true">
            <path d="M1 5l3.5 4L11 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <span className="text-xs leading-relaxed text-ink/70">{children}</span>
    </label>
  );
}

export function CheckoutPanel({
  dict,
  price,
}: {
  dict: Dictionary["checkout"];
  price: string;
}) {
  // Two independent, never-pre-checked checkboxes — digital delivery +
  // withdrawal waiver combined (allowed to be one checkbox per the
  // compliance brief), and terms acceptance kept fully separate from it,
  // from privacy, and from anything else. Neither implies the other.
  const [digitalDeliveryConsent, setDigitalDeliveryConsent] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isGift, setIsGift] = useState(false);
  const [giftEmail, setGiftEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Funnel steps around the price: seen, and pay button pressed (before Stripe).
  useEffect(() => {
    trackEvent("checkout_viewed");
  }, []);

  const giftEmailValid = !isGift || isValidEmail(giftEmail);
  // The button only ever becomes active once both are true (compliance
  // brief section 7) — this is the UX gate; src/app/checkout/actions.ts
  // re-validates both server-side regardless, since this client check can
  // be bypassed.
  const canSubmit = digitalDeliveryConsent && termsAccepted && giftEmailValid;

  function handleSubmit() {
    if (!canSubmit) return;
    trackEvent("checkout_pay_clicked", { is_gift: isGift });
    setError(null);
    startTransition(async () => {
      try {
        await createCheckoutSession(
          termsAccepted,
          digitalDeliveryConsent,
          isGift ? giftEmail : undefined
        );
      } catch (err) {
        // Next.js redirect() throws internally on success (to Stripe
        // Checkout) — let that propagate instead of showing it as an error.
        if (isRedirectError(err)) throw err;
        setError(err instanceof Error ? err.message : dict.errorGeneric);
      }
    });
  }

  return (
    <div>
      {/* Gift toggle */}
      <div className="mb-6 rounded-lg border border-border bg-cream p-5">
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm font-medium text-ink">{dict.giftToggleLabel}</span>
          <button
            type="button"
            role="switch"
            aria-checked={isGift}
            onClick={() => setIsGift((g) => !g)}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${
              isGift ? "bg-accent" : "bg-ink/15"
            }`}
          >
            <span
              className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${
                isGift ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {isGift && (
          <div className="mt-4">
            <label className="block text-xs font-medium uppercase tracking-widest text-ink/50">
              {dict.giftEmailLabel}
            </label>
            <input
              type="email"
              value={giftEmail}
              onChange={(e) => setGiftEmail(e.target.value)}
              placeholder={dict.giftEmailPlaceholder}
              className="mt-1.5 w-full rounded-lg border border-border bg-paper px-3.5 py-2.5 text-sm text-ink outline-none placeholder:text-ink/35 focus:border-ink"
            />
          </div>
        )}
      </div>

      {/* Disclaimer */}
      <p className="mb-5 rounded-lg bg-ink/4 p-4 text-xs leading-relaxed text-ink/60">
        {dict.disclaimer}
      </p>

      {/* Digital delivery explanation — shown before the checkboxes, per
          the compliance brief (never only disclosed after purchase). */}
      <div className="mb-4 rounded-lg border border-border bg-paper p-4">
        <p className="text-sm font-medium text-ink">{dict.digitalDeliveryHeading}</p>
        <p className="mt-1 text-xs leading-relaxed text-ink/60">{dict.digitalDeliveryBody}</p>
      </div>
      <div className="mb-5 rounded-lg border border-gold/40 bg-gold/10 p-4">
        <p className="text-sm font-medium text-ink">{dict.withdrawalNoticeHeading}</p>
        <p className="mt-1 text-xs leading-relaxed text-ink/60">{dict.withdrawalNoticeBody}</p>
      </div>

      {/* Two separate, independently required checkboxes — see
          ComplianceCheckbox above. */}
      <div className="mb-5 flex flex-col gap-4">
        <ComplianceCheckbox checked={digitalDeliveryConsent} onChange={setDigitalDeliveryConsent}>
          {dict.digitalDeliveryConsentLabel}
        </ComplianceCheckbox>
        <ComplianceCheckbox checked={termsAccepted} onChange={setTermsAccepted}>
          {dict.termsAcceptanceLabelPrefix}{" "}
          <Link href="/terms" target="_blank" className="underline underline-offset-2 hover:text-ink">
            {dict.termsAcceptanceLinkText}
          </Link>{" "}
          {dict.termsAcceptanceLabelSuffix}
        </ComplianceCheckbox>
      </div>

      {/* Legal information, reachable before payment (compliance brief
          section 8) — never only disclosed afterwards. */}
      <p className="mb-7 text-xs text-ink/50">
        {dict.legalLinksIntro}{" "}
        <Link href="/terms" target="_blank" className="underline underline-offset-2 hover:text-ink">
          {dict.legalLinks.terms}
        </Link>
        {" · "}
        <Link href="/herroepingsrecht" target="_blank" className="underline underline-offset-2 hover:text-ink">
          {dict.legalLinks.withdrawal}
        </Link>
        {" · "}
        <Link href="/privacy" target="_blank" className="underline underline-offset-2 hover:text-ink">
          {dict.legalLinks.privacy}
        </Link>
        {" · "}
        <Link href="/privacy#contact" target="_blank" className="underline underline-offset-2 hover:text-ink">
          {dict.legalLinks.contact}
        </Link>
      </p>

      {error && (
        <p className="mb-4 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <Button
        onClick={handleSubmit}
        disabled={!canSubmit || isPending}
        size="lg"
        className="w-full justify-center"
      >
        {isPending ? dict.ctaPending : dict.ctaIdle.replace("{price}", price)}
      </Button>
    </div>
  );
}
