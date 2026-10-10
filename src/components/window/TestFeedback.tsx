"use client";

import { useState, useTransition } from "react";
import { submitTestFeedback } from "@/app/plan/feedbackActions";
import { trackEvent } from "@/lib/posthog/client";
import { DOUBT_MAX, type WouldPay } from "@/lib/testFeedback";
import type { Dictionary } from "@/lib/i18n/dictionaries";

// Three short questions under the reveal, only on the test preview (fase 8). PostHog gets the
// score and the pay answer; the free text only goes to the test_feedback table.
export function TestFeedback({
  planId,
  locale,
  price,
  dict,
}: {
  planId: string;
  locale: string;
  price: string;
  dict: Dictionary["venster"]["feedback"];
}) {
  const [score, setScore] = useState<number | null>(null);
  const [pay, setPay] = useState<WouldPay | null>(null);
  const [doubt, setDoubt] = useState("");
  const [state, setState] = useState<"idle" | "sent" | "error">("idle");
  const [pending, startTransition] = useTransition();

  function send() {
    startTransition(async () => {
      const res = await submitTestFeedback(planId, locale, { flowScore: score, wouldPay: pay, doubt });
      trackEvent("test_feedback_submitted", { flow_score: score, would_pay: pay, has_doubt: doubt.trim() !== "", stored: res.ok });
      setState(res.ok ? "sent" : "error");
    });
  }

  const chip = (selected: boolean) =>
    `min-h-11 rounded-md border px-3.5 text-sm transition-colors ${
      selected ? "border-ink bg-ink text-white" : "border-border bg-paper text-ink hover:border-accent"
    }`;

  if (state === "sent") {
    return <p className="mt-12 rounded-lg border border-border bg-surface-active p-6 text-center text-ink">{dict.thanks}</p>;
  }

  return (
    <section aria-labelledby="test-feedback-heading" className="mt-12 rounded-lg border border-gold/50 bg-paper p-6 sm:p-8">
      <h2 id="test-feedback-heading" className="font-serif text-2xl text-ink">
        {dict.heading}
      </h2>
      <p className="mt-1 text-sm text-ink/70">{dict.sub}</p>

      <fieldset className="mt-6">
        <legend className="text-sm font-semibold text-ink">{dict.scoreLabel}</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {dict.scoreOptions.map((label, i) => (
            <button key={label} type="button" aria-pressed={score === i + 1} className={chip(score === i + 1)} onClick={() => setScore(i + 1)}>
              {i + 1} · {label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-6">
        <legend className="text-sm font-semibold text-ink">{dict.payLabel.replace("{price}", price)}</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {dict.payOptions.map((o) => (
            <button key={o.value} type="button" aria-pressed={pay === o.value} className={chip(pay === o.value)} onClick={() => setPay(o.value)}>
              {o.label}
            </button>
          ))}
        </div>
      </fieldset>

      <label htmlFor="test-feedback-doubt" className="mt-6 block text-sm font-semibold text-ink">
        {dict.doubtLabel}
      </label>
      <textarea
        id="test-feedback-doubt"
        value={doubt}
        maxLength={DOUBT_MAX}
        onChange={(e) => setDoubt(e.target.value)}
        placeholder={dict.doubtPlaceholder}
        rows={3}
        className="mt-2 w-full rounded-lg border border-border bg-cream p-3 text-sm text-ink focus:border-accent focus:outline-none"
      />

      <div className="mt-5 flex items-center gap-4">
        <button
          type="button"
          onClick={send}
          disabled={pending || (score === null && pay === null && doubt.trim() === "")}
          className="min-h-11 rounded-md bg-accent-dark px-5 text-sm font-semibold text-white disabled:opacity-40"
        >
          {dict.submit}
        </button>
        {state === "error" && <p className="text-sm text-red-700">{dict.error}</p>}
      </div>
    </section>
  );
}
