"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { isRedirectError } from "@/lib/isRedirectError";
import { createCheckoutSession, skipPaymentForTesting } from "@/app/checkout/actions";
import type { Dictionary } from "@/lib/i18n/dictionaries";

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function CheckoutPanel({ dict }: { dict: Dictionary["checkout"] }) {
  const [waiverConfirmed, setWaiverConfirmed] = useState(false);
  const [isGift, setIsGift] = useState(false);
  const [giftEmail, setGiftEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isTestPending, startTestTransition] = useTransition();

  const giftEmailValid = !isGift || isValidEmail(giftEmail);
  const canSubmit = waiverConfirmed && giftEmailValid;

  function handleSubmit() {
    if (!canSubmit) return;
    setError(null);
    startTransition(async () => {
      try {
        await createCheckoutSession(waiverConfirmed, isGift ? giftEmail : undefined);
      } catch (err) {
        // Next.js redirect() throws internally on success (to Stripe
        // Checkout) — let that propagate instead of showing it as an error.
        if (isRedirectError(err)) throw err;
        setError(err instanceof Error ? err.message : dict.errorGeneric);
      }
    });
  }

  function handleSkipPayment() {
    setError(null);
    startTestTransition(async () => {
      try {
        await skipPaymentForTesting();
      } catch (err) {
        if (isRedirectError(err)) throw err;
        setError(err instanceof Error ? err.message : dict.errorTest);
      }
    });
  }

  return (
    <div>
      {/* Gift toggle */}
      <div className="mb-6 rounded-2xl bg-cream p-5">
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
              className="mt-1.5 w-full rounded-xl border border-ink/15 bg-paper px-3.5 py-2.5 text-sm text-ink shadow-sm outline-none placeholder:text-ink/35 focus:border-accent"
            />
          </div>
        )}
      </div>

      {/* Disclaimer */}
      <p className="mb-5 rounded-xl bg-ink/4 p-4 text-xs leading-relaxed text-ink/60">
        {dict.disclaimer}
      </p>

      {/* Waiver checkbox */}
      <label className="group mb-7 flex cursor-pointer items-start gap-3">
        <span
          aria-hidden="true"
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
            waiverConfirmed
              ? "border-accent bg-accent"
              : "border-ink/25 bg-paper group-hover:border-accent/50"
          }`}
        >
          {waiverConfirmed && (
            <svg width="12" height="10" viewBox="0 0 12 10" fill="none" aria-hidden="true">
              <path d="M1 5l3.5 4L11 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
        <input
          type="checkbox"
          checked={waiverConfirmed}
          onChange={(e) => setWaiverConfirmed(e.target.checked)}
          className="sr-only"
        />
        <span className="text-xs leading-relaxed text-ink/70">{dict.waiverLabel}</span>
      </label>

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
        {isPending ? dict.ctaPending : dict.ctaIdle}
      </Button>

      <div className="mt-6 rounded-xl border border-dashed border-amber-400 bg-amber-50 px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-widest text-amber-700">
          {dict.testModeLabel}
        </p>
        <p className="mt-1 text-sm text-amber-800/80">{dict.testModeHelper}</p>
        <button
          type="button"
          onClick={handleSkipPayment}
          disabled={isTestPending}
          className="mt-3 rounded-full border border-amber-400 bg-white px-4 py-2 text-sm font-medium text-amber-800 transition-colors hover:bg-amber-100 disabled:opacity-50"
        >
          {isTestPending ? dict.testModePending : dict.testModeCta}
        </button>
      </div>
    </div>
  );
}
