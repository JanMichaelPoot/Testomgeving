"use client";

import { useTransition } from "react";
import { isRedirectError } from "@/lib/isRedirectError";
import { skipPaymentForTesting } from "@/app/checkout/actions";
import type { Dictionary } from "@/lib/i18n/dictionaries";

// A slim, low-key dev banner — deliberately not a boxed alert in the main
// flow. Testers still need this button, but it shouldn't out-compete the
// real checkout for a paying visitor's attention.
// On the test preview (NEXT_PUBLIC_TEST_FEEDBACK=1) it also tells testers which test card to use
// ("Het venster", fase 8), because they should go through the real Stripe test checkout.
export function TestModeBanner({ dict, notice, beforeSkip }: { dict: Dictionary["checkout"]; notice?: string; beforeSkip?: () => Promise<void> }) {
  const [isPending, startTransition] = useTransition();

  function handleSkipPayment() {
    startTransition(async () => {
      try {
        await beforeSkip?.();
        await skipPaymentForTesting();
      } catch (err) {
        if (isRedirectError(err)) throw err;
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-6 py-2 text-xs sm:px-10">
      <span className="font-medium text-amber-800">
        {notice ?? `${dict.testModeLabel} — ${dict.testModeHelper}`}
      </span>
      <button
        type="button"
        onClick={handleSkipPayment}
        disabled={isPending}
        className="font-medium text-amber-800 underline underline-offset-2 hover:text-amber-900 disabled:opacity-50"
      >
        {isPending ? dict.testModePending : dict.testModeCta}
      </button>
    </div>
  );
}
