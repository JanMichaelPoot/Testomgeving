"use client";

import { useEffect } from "react";
import { getDictionary } from "@/lib/i18n/dictionaries";

// The fallback when a page fails while rendering, in the language the page was in
// (the root layout sets <html lang>), instead of Next's generic English message.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const lang = typeof document !== "undefined" && document.documentElement.lang === "en" ? "en" : "nl";
  const copy = getDictionary(lang).venster.errors;
  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-xl flex-col items-center justify-center px-6 py-24 text-center">
      <h1 className="font-serif text-3xl text-ink">{copy.errorTitle}</h1>
      <p className="mt-4 text-ink/60">{copy.errorBody}</p>
      <button
        type="button"
        onClick={reset}
        className="mt-8 inline-flex min-h-12 items-center rounded-lg bg-accent-dark px-6 font-semibold text-paper hover:shadow-md"
      >
        {copy.retry}
      </button>
    </main>
  );
}
