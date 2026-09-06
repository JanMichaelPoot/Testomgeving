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
            "rounded-full px-2.5 py-1 uppercase tracking-wide transition-colors",
            locale === code
              ? "bg-accent text-white"
              : "text-ink/50 hover:text-ink"
          )}
        >
          {code}
        </button>
      ))}
    </div>
  );
}
