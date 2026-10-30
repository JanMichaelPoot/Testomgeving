"use client";

import { useTransition } from "react";
import { cn } from "@/lib/utils";
import { setLocale } from "@/app/actions/locale";
import { SUPPORTED_LOCALES, type Locale } from "@/lib/locale";

export function LanguageToggle({
  locale,
  label,
}: {
  locale: Locale;
  label: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div
      role="group"
      aria-label={label}
      className="flex items-center gap-1 rounded-full border border-ink/15 p-0.5 text-xs font-medium"
    >
      {SUPPORTED_LOCALES.map(({ code }) => (
        <button
          key={code}
          type="button"
          disabled={isPending}
          aria-pressed={locale === code}
          onClick={() => startTransition(() => setLocale(code))}
          className={cn(
            // 44 px tap targets on a phone; the compact pill from sm up.
            "min-h-11 min-w-11 rounded-full px-2.5 py-1 uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-gold/60 sm:min-h-0 sm:min-w-0",
            locale === code
              ? "bg-accent text-white"
              : "text-ink/70 hover:text-ink"
          )}
        >
          {code}
        </button>
      ))}
    </div>
  );
}
