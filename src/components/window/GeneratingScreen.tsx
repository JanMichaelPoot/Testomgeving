"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { WindowMark } from "@/components/window/WindowMark";

const MESSAGE_INTERVAL_MS = 2500;
const POLL_INTERVAL_MS = 5000;
const TICK_MS = 200;

// Fase 5 (PDF & Share) — rebuilt this screen's progress bar after noticing
// two real problems with the original version, not just a cosmetic ask:
//
// 1. The bar's percentage was driven by the message-rotation index (4
//    messages, 2.5s apart) rather than real elapsed time, so it reached
//    100% after ~10 seconds — while actual generation (a Claude call, PDF
//    render, and Supabase upload) usually takes well past that. The bar
//    then sat frozen at "done" for tens of seconds, which reads as broken,
//    not reassuring.
// 2. The auto-refresh was a one-shot setTimeout, not a repeating poll. A
//    router.refresh() on an App Router page like this one re-renders this
//    same client component in place rather than remounting it, so the
//    effect (gated on [messages.length, router], neither of which change
//    between polls) never re-ran — meaning it only ever checked once,
//    5 seconds in, and then never again if the book wasn't ready yet.
//
// The bar below is now driven by real elapsed time (via a ref, so it
// survives those in-place re-renders) on a curve that never quite reaches
// 100% on its own — completion is the page actually navigating to the
// finished Idea Book, not a number here — and the poll is a genuine
// repeating interval.
const PROGRESS_CAP = 92;
const PROGRESS_TAU_MS = 20000;

export function GeneratingScreen({
  heading,
  messages,
  autoRefreshNote,
}: {
  heading: string;
  messages: string[];
  autoRefreshNote: string;
}) {
  const router = useRouter();
  const [messageIndex, setMessageIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // A ref, not state: set once when the effect below first runs and left
  // alone after that, so it isn't reset by a router.refresh()-triggered
  // re-render the way a piece of state recomputed from props would be.
  // (Set inside the effect rather than inline during render — reading the
  // clock is an impure operation React's rules don't allow during render.)
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (startRef.current === null) startRef.current = Date.now();

    const messageTimer = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % messages.length);
    }, MESSAGE_INTERVAL_MS);

    const progressTimer = setInterval(() => {
      const elapsedMs = Date.now() - (startRef.current ?? Date.now());
      setProgress(PROGRESS_CAP * (1 - Math.exp(-elapsedMs / PROGRESS_TAU_MS)));
      setElapsedSeconds(Math.floor(elapsedMs / 1000));
    }, TICK_MS);

    // A real repeating poll, not a one-shot timeout — keeps checking every
    // 5s for as long as this screen stays mounted (i.e. for as long as
    // generation is still pending).
    const pollTimer = setInterval(() => router.refresh(), POLL_INTERVAL_MS);

    return () => {
      clearInterval(messageTimer);
      clearInterval(progressTimer);
      clearInterval(pollTimer);
    };
  }, [messages.length, router]);

  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center bg-accent-dark px-6 py-16 text-center">
      <div className="relative mx-auto mb-10 h-24 w-24">
        <div className="animate-window-spin-slow absolute inset-0 rounded-2xl border-2 border-gold/40" />
        <div className="absolute inset-3 rounded-xl border border-accent/50" />
        <div className="absolute inset-0 flex items-center justify-center text-white">
          <WindowMark className="h-9 w-9" />
        </div>
      </div>

      <h1 className="font-serif text-2xl font-semibold text-white sm:text-3xl">{heading}</h1>

      <div className="mt-6 w-full max-w-xs overflow-hidden rounded-full bg-white/10">
        <div
          className="h-1 rounded-full bg-gold transition-[width] duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="mt-2 text-xs tabular-nums text-white/35">{elapsedSeconds}s</p>

      <p
        className="mt-6 min-h-6 text-sm text-white/60 transition-opacity duration-300"
        key={messageIndex}
      >
        {messages[messageIndex]}
      </p>
      <p className="mt-10 text-xs text-white/30">{autoRefreshNote}</p>
    </main>
  );
}
