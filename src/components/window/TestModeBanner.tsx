"use client";

import { useTransition } from "react";
import { isRedirectError } from "@/lib/isRedirectError";
import { skipPaymentForTesting } from "@/app/checkout/actions";
import type { Dictionary } from "@/lib/i18n/dictionaries";

// A slim, low-key dev banner — deliberately not a boxed alert in the main
// flow. Testers still need this button, but it shouldn't out-compete the
// real checkout for a paying visitor's attention.
export function TestModeBanner({ dict }: { dict: Dictionary["checkout"] }) {
  const [isPending, startTransition] = useTransition();

  function handleSkipPayment() {
    startTransition(async () => {
      try {
        await skipPaymentForTesting();
      } catch (err) {
        if (isRedirectError(err)) throw err;
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-6 py-2 text-xs sm:px-10">
      <span className="font-medium text-amber-800">
        {dict.testModeLabel} — {dict.testModeHelper}
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
