"use client";

import { useState, useTransition } from "react";
import { submitTestFeedback } from "@/app/plan/feedbackActions";
import { trackEvent } from "@/lib/posthog/client";
import { DOUBT_MAX, type DoorKind, type WouldPay } from "@/lib/testFeedback";
import type { Dictionary } from "@/lib/i18n/dictionaries";

/** One idea of the reveal the tester can pick: its position (1-6, the wildcard 7), kind and title (the title is only shown, never sent). */
export interface FeedbackDoor {
  number: number;
  kind: DoorKind;
  title: string;
}

// Six short questions under the reveal, only on the test preview (fase 8, extended in R2.4).
// PostHog gets the scores, the pay answer and the NUMBER of the chosen door; the free text and the
// same numbers also go to the test_feedback table (the numbers there so they are not lost while no
// PostHog key is set). A door's title never leaves the page.
export function TestFeedback({
  planId,
  locale,
  price,
  dict,
  doors,
}: {
  planId: string;
  locale: string;
  price: string;
  dict: Dictionary["venster"]["feedback"];
  doors: FeedbackDoor[];
}) {
  const [score, setScore] = useState<number | null>(null);
  const [profileScore, setProfileScore] = useState<number | null>(null);
  const [doorsScore, setDoorsScore] = useState<number | null>(null);
  /** 0 = none of them. */
  const [pick, setPick] = useState<number | null>(null);
  const [pay, setPay] = useState<WouldPay | null>(null);
  const [doubt, setDoubt] = useState("");
  const [state, setState] = useState<"idle" | "sent" | "error">("idle");
  const [pending, startTransition] = useTransition();

  const picked = doors.find((d) => d.number === pick) ?? null;
  const nothing = score === null && profileScore === null && doorsScore === null && pick === null && pay === null && doubt.trim() === "";

  function send() {
    startTransition(async () => {
      const doorKind = picked?.kind ?? null;
      const res = await submitTestFeedback(planId, locale, {
        flowScore: score,
        profileScore,
        doorsScore,
        doorPick: pick,
        doorKind,
        wouldPay: pay,
        doubt,
      });
      trackEvent("test_feedback_submitted", {
        flow_score: score,
        profile_score: profileScore,
        doors_score: doorsScore,
        door_pick: pick,
        door_kind: doorKind,
        would_pay: pay,
        has_doubt: doubt.trim() !== "",
        stored: res.ok,
      });
      setState(res.ok ? "sent" : "error");
    });
  }

  const chip = (selected: boolean) =>
    `min-h-11 rounded-md border px-3.5 text-sm transition-colors ${
      selected ? "border-ink bg-ink text-white" : "border-border bg-paper text-ink hover:border-accent"
    }`;

  const scale = (legend: string, labels: string[], value: number | null, set: (n: number) => void) => (
    <fieldset className="mt-6">
      <legend className="text-sm font-semibold text-ink">{legend}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {labels.map((label, i) => (
          <button key={label} type="button" aria-pressed={value === i + 1} className={chip(value === i + 1)} onClick={() => set(i + 1)}>
            {i + 1} · {label}
          </button>
        ))}
      </div>
    </fieldset>
  );

  if (state === "sent") {
    return <p className="mt-12 rounded-lg border border-border bg-surface-active p-6 text-center text-ink">{dict.thanks}</p>;
  }

  return (
    <section aria-labelledby="test-feedback-heading" className="mt-12 rounded-lg border border-gold/50 bg-paper p-6 sm:p-8">
      <h2 id="test-feedback-heading" className="font-serif text-2xl text-ink">
        {dict.heading}
      </h2>
      <p className="mt-1 text-sm text-ink/70">{dict.sub}</p>

      {scale(dict.scoreLabel, dict.scoreOptions, score, setScore)}
      {scale(dict.profileLabel, dict.agreeOptions, profileScore, setProfileScore)}
      {scale(dict.doorsLabel, dict.agreeOptions, doorsScore, setDoorsScore)}

      <fieldset className="mt-6">
        <legend className="text-sm font-semibold text-ink">{dict.pickLabel}</legend>
        <div className="mt-2 flex flex-col gap-2">
          {doors.map((d) => (
            <button
              key={d.number}
              type="button"
              aria-pressed={pick === d.number}
              className={`${chip(pick === d.number)} w-full text-left`}
              onClick={() => setPick(d.number)}
            >
              {d.number} · {d.title}
            </button>
          ))}
          <button type="button" aria-pressed={pick === 0} className={`${chip(pick === 0)} w-full text-left`} onClick={() => setPick(0)}>
            {dict.pickNone}
          </button>
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
          disabled={pending || nothing}
          className="min-h-11 rounded-md bg-accent-dark px-5 text-sm font-semibold text-white disabled:opacity-40"
        >
          {dict.submit}
        </button>
        {state === "error" && <p className="text-sm text-red-700">{dict.error}</p>}
      </div>
    </section>
  );
}
