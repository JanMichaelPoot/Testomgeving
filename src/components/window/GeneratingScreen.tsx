"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { WindowMark } from "@/components/window/WindowMark";
import type { ProgressStage } from "@/types/database";
import { activePhaseFor } from "@/lib/progressStage";

const POLL_INTERVAL_MS = 5000;
const TICK_MS = 200;

// The bar is driven by real elapsed time (via a ref, so it survives the in-place
// re-renders of router.refresh()) on a curve that never quite reaches 100% on its own:
// completion is the page actually navigating to the finished Idea Book. The poll is a
// genuine repeating interval. (Fase 5 of the original build; see git history.)
const PROGRESS_CAP = 92;
const PROGRESS_TAU_MS = 35000;

export function GeneratingScreen({
  heading,
  phases,
  autoRefreshNote,
  stage = null,
  visual,
}: {
  heading: string;
  phases: string[];
  autoRefreshNote: string;
  stage?: ProgressStage | null;
  /** Optional picture above the heading (the person's own window); a spinning mark otherwise. */
  visual?: ReactNode;
}) {
  const router = useRouter();
  const [progress, setProgress] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const startRef = useRef<number | null>(null);
  const active = activePhaseFor(stage);

  useEffect(() => {
    if (startRef.current === null) startRef.current = Date.now();

    const progressTimer = setInterval(() => {
      const elapsedMs = Date.now() - (startRef.current ?? Date.now());
      setProgress(PROGRESS_CAP * (1 - Math.exp(-elapsedMs / PROGRESS_TAU_MS)));
      setElapsedSeconds(Math.floor(elapsedMs / 1000));
    }, TICK_MS);

    const pollTimer = setInterval(() => router.refresh(), POLL_INTERVAL_MS);

    return () => {
      clearInterval(progressTimer);
      clearInterval(pollTimer);
    };
  }, [router]);

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
        {phases.map((phase, i) => {
          const done = i < active;
          const now = i === active;
          return (
            <li
              key={phase}
              className={`flex items-center gap-3 text-sm ${done ? "text-white/70" : now ? "font-semibold text-white" : "text-white/35"}`}
              aria-current={now ? "step" : undefined}
            >
              <span
                aria-hidden="true"
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                  done ? "border-gold bg-gold" : now ? "animate-spin border-gold border-t-transparent motion-reduce:animate-none" : "border-white/25"
                }`}
              >
                {done && (
                  <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                    <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" className="text-accent-dark" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              {phase}
            </li>
          );
        })}
      </ol>

      <p className="mt-10 max-w-sm text-xs leading-relaxed text-white/45">{autoRefreshNote}</p>
    </main>
  );
}
