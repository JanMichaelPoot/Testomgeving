"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { WindowMark } from "@/components/window/WindowMark";
import type { ProgressMeta, ProgressStage } from "@/types/database";
import { activePhaseFor, isStalled, phaseLabels, type PhaseCopy } from "@/lib/progressStage";
import { trackEvent } from "@/lib/posthog/client";

const POLL_INTERVAL_MS = 5000;
const TICK_MS = 200;

// The bar and the timer run on real time: the server tells us how long the generation has
// already been running (from the pending row's own timestamp), the client adds the time since
// then with Date.now(), so a reload or a tab in the background does not reset or freeze them.
// The bar follows a curve that never quite reaches 100% on its own: completion is the page
// actually navigating to the finished Idea Book. The poll is a genuine repeating interval.
const PROGRESS_CAP = 92;
const PROGRESS_TAU_MS = 35000;

export function GeneratingScreen({
  heading,
  copy,
  autoRefreshNote,
  stalledNote,
  orderRefLabel = null,
  stage = null,
  meta = null,
  place = null,
  elapsedMs = null,
  visual,
}: {
  heading: string;
  copy: PhaseCopy;
  autoRefreshNote: string;
  /** Shown instead of the note once nothing has finished for a long time. */
  stalledNote: string;
  /** "Order reference: WI-…", when there is an order. */
  orderRefLabel?: string | null;
  stage?: ProgressStage | null;
  /** The real numbers the pipeline recorded at its steps (counts only). */
  meta?: ProgressMeta | null;
  /** The place the person searched around, for "12 places found near …". */
  place?: string | null;
  /** How long the generation has been running, measured by the server at render time. */
  elapsedMs?: number | null;
  /** Optional picture above the heading (the person's own window); a spinning mark otherwise. */
  visual?: ReactNode;
}) {
  const router = useRouter();
  const [elapsed, setElapsed] = useState(elapsedMs ?? 0);
  // (elapsed at the last server render, the client time of that render)
  const baseRef = useRef<{ base: number; at: number }>({ base: elapsedMs ?? 0, at: 0 });
  const stalledReported = useRef(false);
  const active = activePhaseFor(stage);
  const stalled = isStalled(elapsed);
  const labels = phaseLabels(copy, active, meta, place);

  // On mount and at every new server render (every poll) the clock is anchored to the server's
  // measurement; between renders it runs on the client's own time.
  useEffect(() => {
    baseRef.current = { base: elapsedMs ?? baseRef.current.base, at: Date.now() };
  }, [elapsedMs]);

  useEffect(() => {
    const tick = setInterval(() => setElapsed(baseRef.current.base + (Date.now() - baseRef.current.at)), TICK_MS);
    const poll = setInterval(() => router.refresh(), POLL_INTERVAL_MS);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  }, [router]);

  useEffect(() => {
    if (!stalled || stalledReported.current) return;
    stalledReported.current = true;
    trackEvent("generation_stalled", { stage: stage ?? "start", seconds: Math.round(elapsed / 1000) });
    // Reported once per screen; the elapsed time at that moment is all we need.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stalled, stage]);

  const progress = stalled ? PROGRESS_CAP : PROGRESS_CAP * (1 - Math.exp(-elapsed / PROGRESS_TAU_MS));
  const elapsedSeconds = Math.floor(elapsed / 1000);

  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center bg-accent-dark px-6 py-16 text-center">
      {visual ? (
        <div className="mx-auto mb-8 w-44 sm:w-52">{visual}</div>
      ) : (
        <div className="relative mx-auto mb-10 h-24 w-24">
          <div className="animate-window-spin-slow absolute inset-0 rounded-2xl border-2 border-gold/40" />
          <div className="absolute inset-3 rounded-xl border border-accent/50" />
          <div className="absolute inset-0 flex items-center justify-center text-white">
            <WindowMark onDark className="h-9 w-9" />
          </div>
        </div>
      )}

      <h1 className="font-serif text-2xl font-semibold text-white sm:text-3xl">{heading}</h1>

      <div className="mt-6 w-full max-w-xs overflow-hidden rounded-full bg-white/10">
        <div
          className="h-1 rounded-full bg-gold transition-[width] duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="mt-2 text-xs tabular-nums text-white/35">{elapsedSeconds}s</p>

      <ol className="mt-8 flex w-full max-w-xs flex-col gap-3 text-left" aria-live="polite">
        {labels.map((label, i) => {
          const done = i < active;
          const now = i === active;
          return (
            <li
              key={i}
              className={`flex items-center gap-3 text-sm ${done ? "text-white/70" : now ? "font-semibold text-white" : "text-white/35"}`}
              aria-current={now ? "step" : undefined}
            >
              <span
                aria-hidden="true"
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                  done
                    ? "border-gold bg-gold"
                    : now
                      ? `border-gold border-t-transparent ${stalled ? "" : "animate-spin motion-reduce:animate-none"}`
                      : "border-white/25"
                }`}
              >
                {done && (
                  <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                    <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" className="text-accent-dark" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              {label}
            </li>
          );
        })}
      </ol>

      {stalled ? (
        <div className="mt-10 max-w-sm" role="status">
          <p className="text-sm leading-relaxed text-white/80">{stalledNote}</p>
          {orderRefLabel && <p className="mt-2 text-xs tabular-nums text-white/50">{orderRefLabel}</p>}
        </div>
      ) : (
        <p className="mt-10 max-w-sm text-xs leading-relaxed text-white/45">{autoRefreshNote}</p>
      )}
    </main>
  );
}
