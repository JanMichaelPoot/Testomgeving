"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { isRedirectError } from "@/lib/isRedirectError";
import { trackEvent } from "@/lib/posthog/client";
import { createCheckoutSession } from "@/app/checkout/actions";
import type { Dictionary } from "@/lib/i18n/dictionaries";

const LEGAL_LINK = "inline-flex min-h-11 items-center underline underline-offset-2 hover:text-ink";
const EMAIL_INPUT =
  "mt-1.5 min-h-11 w-full rounded-lg border border-border bg-paper px-3.5 py-2.5 text-sm text-ink outline-none placeholder:text-ink/70 focus:border-ink";

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// Shared visual for both compliance checkboxes below — kept as one small
// component so the two stay pixel-identical (same tap target, same check
// animation) rather than drifting apart as two copy-pasted blocks.
export function ComplianceCheckbox({
  checked,
  onChange,
  children,
  requiredMark,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: React.ReactNode;
  /** Given: the box is required, marked with a red asterisk (and this word for a screen reader). */
  requiredMark?: string;
}) {
  return (
    <label className="group flex min-h-11 cursor-pointer items-start gap-3 py-1.5">
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
      <span className="text-xs leading-relaxed text-ink/70">
        {children}
        {requiredMark && (
          <>
            <span className="ml-1 font-bold text-red-700" aria-hidden="true">
              *
            </span>
            <span className="sr-only"> ({requiredMark})</span>
          </>
        )}
      </span>
    </label>
  );
}

/** One switch with its text: the text may wrap and shrink, the switch never leaves the block (it keeps its own width and stays at the end). */
function SwitchRow({ id, label, hint, checked, onChange, children }: { id: string; label: string; hint?: string; checked: boolean; onChange: (next: boolean) => void; children?: React.ReactNode }) {
  return (
    <div className="mb-6 rounded-lg border border-border bg-cream p-5">
      <div className="flex items-start justify-between gap-4">
        <label id={`${id}-label`} htmlFor={`${id}-switch`} className="min-w-0 flex-1 py-2 text-sm font-medium text-ink [overflow-wrap:anywhere]">
          {label}
        </label>
        <Switch id={`${id}-switch`} labelledBy={`${id}-label`} checked={checked} onChange={onChange} />
      </div>
      {hint && <p className="mt-1 text-xs leading-relaxed text-ink/70">{hint}</p>}
      {children}
    </div>
  );
}

export function CheckoutPanel({
  dict,
  price,
  rememberInitially = false,
  beforePay,
  priceVariant = null,
}: {
  dict: Dictionary["checkout"];
  price: string;
  // True for a visitor whose device already has the opt-in cookie (fase 5).
  rememberInitially?: boolean;
  // Runs right before the payment starts. The image intake pays on its last screen, so it stores the answers here (the
  // session the payment belongs to does not exist before that). If it throws, nothing is paid and the message is shown.
  beforePay?: () => Promise<void>;
  // The price-test variant this visitor was shown (null while the test is off). Only recorded with the analytics events here; the
  // server decides the price that is charged (checkout/actions.ts), never this value.
  priceVariant?: string | null;
}) {
  // Two independent, never-pre-checked checkboxes — digital delivery +
  // withdrawal waiver combined (allowed to be one checkbox per the
  // compliance brief), and terms acceptance kept fully separate from it,
  // from privacy, and from anything else. Neither implies the other.
  const [digitalDeliveryConsent, setDigitalDeliveryConsent] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  // Where the book should go if that is not the address typed at Stripe (a tester, someone who wants another inbox).
  const [deliveryEmail, setDeliveryEmail] = useState("");
  // Optional repetition memory: never pre-ticked for a new visitor, and its own consent,
  // unrelated to the two compliance checkboxes below.
  const [remember, setRemember] = useState(rememberInitially);
  // One e-mail after six weeks: its own consent, never pre-ticked, unrelated to the two compliance checkboxes.
  const [followUp, setFollowUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Funnel steps around the price: seen, and pay button pressed (before Stripe).
  useEffect(() => {
    trackEvent("checkout_viewed", { price_variant: priceVariant ?? "none" });
  }, [priceVariant]);

  // The e-mail is required: the book is sent there. The message shows once the field was left (or something wrong is typed), never on a fresh form.
  const [emailTouched, setEmailTouched] = useState(false);
  const deliveryEmailValid = isValidEmail(deliveryEmail.trim());
  const showEmailError = !deliveryEmailValid && (emailTouched || deliveryEmail.trim() !== "");
  // The button only ever becomes active once both are true (compliance
  // brief section 7) — this is the UX gate; src/app/checkout/actions.ts
  // re-validates both server-side regardless, since this client check can
  // be bypassed.
  const canSubmit = digitalDeliveryConsent && termsAccepted && deliveryEmailValid;
  const consentsMissing = !digitalDeliveryConsent || !termsAccepted;
  const payHint = canSubmit ? "" : consentsMissing && !deliveryEmailValid ? dict.payHint.both : consentsMissing ? dict.payHint.consent : dict.payHint.email;

  function handleSubmit() {
    if (!canSubmit) return;
    trackEvent("pay_clicked", { price_variant: priceVariant ?? "none" });
    trackEvent("checkout_pay_clicked", { price_variant: priceVariant ?? "none" });
    setError(null);
    startTransition(async () => {
      try {
        await beforePay?.();
        await createCheckoutSession(
          termsAccepted,
          digitalDeliveryConsent,
          remember,
          deliveryEmail.trim(),
          followUp,
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
      <p className="mb-4 text-xs text-ink/70">{dict.requiredNote}</p>

      {/* Where the book goes: required, and the address Stripe is given too. */}
      <div className="mb-6">
        <label htmlFor="delivery-email" className="block text-xs font-medium uppercase tracking-widest text-ink/70">
          {dict.deliveryEmailLabel}
          <span className="ml-1 font-bold text-red-700" aria-hidden="true">
            *
          </span>
          <span className="sr-only"> ({dict.requiredMark})</span>
        </label>
        <input
          id="delivery-email"
          type="email"
          autoComplete="email"
          required
          aria-required="true"
          value={deliveryEmail}
          onChange={(e) => setDeliveryEmail(e.target.value)}
          onBlur={() => setEmailTouched(true)}
          placeholder={dict.deliveryEmailPlaceholder}
          aria-invalid={showEmailError}
          aria-describedby={showEmailError ? "delivery-email-error" : "delivery-email-hint"}
          className={`${EMAIL_INPUT} ${showEmailError ? "border-red-600 focus:border-red-600" : ""}`}
        />
        {showEmailError ? (
          <p id="delivery-email-error" role="alert" className="mt-1.5 text-sm font-medium text-red-700">
            {dict.emailError}
          </p>
        ) : (
          <p id="delivery-email-hint" className="mt-1.5 text-xs text-ink/70">
            {dict.deliveryEmailHint}
          </p>
        )}
      </div>

      {/* Optional repetition memory (fase 5): its own choice, off unless switched on. */}
      <SwitchRow id="memory" label={dict.memoryLabel} hint={dict.memoryHint} checked={remember} onChange={setRemember} />

      {/* One follow-up e-mail after six weeks (improvement brief B5): its own choice, off unless switched on. */}
      <SwitchRow id="followup" label={dict.followUpLabel} hint={dict.followUpHint} checked={followUp} onChange={setFollowUp} />

      {/* Disclaimer */}
      <p className="mb-5 rounded-lg bg-ink/4 p-4 text-xs leading-relaxed text-ink/70">
        {dict.disclaimer}
      </p>

      {/* Digital delivery explanation — shown before the checkboxes, per
          the compliance brief (never only disclosed after purchase). */}
      <div className="mb-4 rounded-lg border border-border bg-paper p-4">
        <p className="text-sm font-medium text-ink">{dict.digitalDeliveryHeading}</p>
        <p className="mt-1 text-xs leading-relaxed text-ink/70">{dict.digitalDeliveryBody}</p>
      </div>
      <div className="mb-5 rounded-lg border border-gold/40 bg-gold/10 p-4">
        <p className="text-sm font-medium text-ink">{dict.withdrawalNoticeHeading}</p>
        <p className="mt-1 text-xs leading-relaxed text-ink/70">{dict.withdrawalNoticeBody}</p>
      </div>

      {/* Two separate, independently required checkboxes — see
          ComplianceCheckbox above. */}
      <div className="mb-5 flex flex-col gap-4">
        <ComplianceCheckbox checked={digitalDeliveryConsent} onChange={setDigitalDeliveryConsent} requiredMark={dict.requiredMark}>
          {dict.digitalDeliveryConsentLabel}
        </ComplianceCheckbox>
        <ComplianceCheckbox checked={termsAccepted} onChange={setTermsAccepted} requiredMark={dict.requiredMark}>
          {dict.termsAcceptanceLabelPrefix}{" "}
          <Link href="/terms" target="_blank" className="underline underline-offset-2 hover:text-ink">
            {dict.termsAcceptanceLinkText}
          </Link>{" "}
          {dict.termsAcceptanceLabelSuffix}
        </ComplianceCheckbox>
      </div>

      {/* Legal information, reachable before payment (compliance brief
          section 8) — never only disclosed afterwards. */}
      <div className="mb-5 text-xs text-ink/70">
        <p>{dict.legalLinksIntro}</p>
        {/* Each link is a 44px-high target of its own (they used to be 15px of running text). */}
        {/* No separator dots: when the links wrap, a dot would hang at the end of a line. The 44px height keeps them apart. */}
        <nav className="flex flex-wrap items-center gap-x-5" aria-label={dict.legalLinksIntro}>
          <Link href="/terms" target="_blank" className={LEGAL_LINK}>
            {dict.legalLinks.terms}
          </Link>
          <Link href="/herroepingsrecht" target="_blank" className={LEGAL_LINK}>
            {dict.legalLinks.withdrawal}
          </Link>
          <Link href="/privacy" target="_blank" className={LEGAL_LINK}>
            {dict.legalLinks.privacy}
          </Link>
          <Link href="/privacy#contact" target="_blank" className={LEGAL_LINK}>
            {dict.legalLinks.contact}
          </Link>
        </nav>
      </div>

      {error && (
        <p className="mb-4 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {/* Why the button is still grey: what is missing, in plain words (read out by screen readers too). */}
      <p id="pay-hint" aria-live="polite" className={`mb-3 text-center text-sm text-ink/70 ${payHint ? "" : "hidden"}`}>
        {payHint}
      </p>
      <Button
        onClick={handleSubmit}
        disabled={!canSubmit || isPending}
        aria-describedby={payHint ? "pay-hint" : undefined}
        variant="hero"
        size="lg"
        className="min-h-14 w-full justify-center text-lg font-semibold"
      >
        {isPending ? dict.ctaPending : dict.ctaIdle.replace("{price}", price)}
        {!isPending && (
          <span aria-hidden="true" className="cta-arrow inline-block">
            →
          </span>
        )}
      </Button>
      {/* The promise that goes with the payment, right where the decision is made. */}
      <p className="mt-3 text-center text-sm text-ink/70">{dict.guarantee}</p>
    </div>
  );
}
