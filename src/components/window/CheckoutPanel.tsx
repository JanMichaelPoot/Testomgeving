"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { isRedirectError } from "@/lib/isRedirectError";
import { createCheckoutSession, skipPaymentForTesting } from "@/app/checkout/actions";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function CheckoutPanel({ dict }: { dict: Dictionary["checkout"] }) {
  const [waiverConfirmed, setWaiverConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isTestPending, startTestTransition] = useTransition();

  function handleSubmit() {
    if (!waiverConfirmed) return;
    setError(null);
    startTransition(async () => {
      try {
        await createCheckoutSession(waiverConfirmed);
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
    <div className="max-w-xl rounded-2xl border border-ink/10 bg-paper p-6 shadow-sm sm:p-8">
      <p className="text-sm text-ink/60">{dict.disclaimer}</p>

      <label className="mt-4 flex items-start gap-3 text-sm text-ink/80">
        <input
          type="checkbox"
          checked={waiverConfirmed}
          onChange={(e) => setWaiverConfirmed(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-ink/30 text-accent focus:ring-accent"
        />
        <span>{dict.waiverLabel}</span>
      </label>

      {error && (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <div className="mt-6">
        <Button onClick={handleSubmit} disabled={!waiverConfirmed || isPending}>
          {isPending ? dict.ctaPending : dict.ctaIdle}
        </Button>
      </div>

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
