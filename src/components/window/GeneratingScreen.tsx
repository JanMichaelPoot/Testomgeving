"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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

  useEffect(() => {
    const messageTimer = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % messages.length);
    }, MESSAGE_INTERVAL_MS);
    const refreshTimer = setTimeout(() => router.refresh(), REFRESH_AFTER_MS);
    return () => {
      clearInterval(messageTimer);
      clearTimeout(refreshTimer);
    };
  }, [messages.length, router]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <div className="flex h-2.5 w-2.5 items-center justify-center">
        <span className="h-2.5 w-2.5 animate-ping rounded-full bg-accent/60" />
      </div>
      <h1 className="mt-6 font-serif text-2xl text-ink sm:text-3xl">{heading}</h1>
      <p className="mt-4 min-h-6 text-ink/60 transition-opacity duration-300" key={messageIndex}>
        {messages[messageIndex]}
      </p>
      <p className="mt-8 text-xs text-ink/40">{autoRefreshNote}</p>
    </main>
  );
}
