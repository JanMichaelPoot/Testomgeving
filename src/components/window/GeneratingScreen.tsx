"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { WindowMark } from "@/components/window/WindowMark";

const MESSAGE_INTERVAL_MS = 2500;
const REFRESH_AFTER_MS = 5000;

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

  useEffect(() => {
    const messageTimer = setInterval(() => {
      setMessageIndex((prev) => {
        const next = (prev + 1) % messages.length;
        setProgress(Math.round((next / Math.max(1, messages.length - 1)) * 100));
        return next;
      });
    }, MESSAGE_INTERVAL_MS);
    const refreshTimer = setTimeout(() => router.refresh(), REFRESH_AFTER_MS);
    return () => {
      clearInterval(messageTimer);
      clearTimeout(refreshTimer);
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
          className="h-1 rounded-full bg-gold transition-all duration-700"
          style={{ width: `${progress}%` }}
        />
      </div>

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
