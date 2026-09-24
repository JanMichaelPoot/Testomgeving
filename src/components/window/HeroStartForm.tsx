"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { trackEvent } from "@/lib/posthog/client";

// The landing hero's start form. A plain GET form to /intake, so it works
// without JavaScript too; the intake wizard picks the text up from
// ?situation= (see IntakeWizard). Suggestion chips just fill the field.
export function HeroStartForm({
  label,
  placeholder,
  cta,
  suggestions,
}: {
  label: string;
  placeholder: string;
  cta: string;
  suggestions: string[];
}) {
  const [text, setText] = useState("");

  return (
    <form
      action="/intake"
      method="get"
      onSubmit={() => {
        // Only whether they typed something — never the text itself.
        trackEvent("landing_start_submitted", { has_text: text.trim().length > 0 });
      }}
      className="flex flex-col gap-3 rounded-lg border border-border bg-paper p-5"
    >
      <label htmlFor="hero-situation" className="text-sm font-semibold text-accent-dark">
        {label}
      </label>
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <input
          id="hero-situation"
          name="situation"
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          placeholder={placeholder}
          autoComplete="off"
          className="min-h-[52px] min-w-0 flex-1 rounded-md border border-border bg-cream px-4 text-[15px] text-ink outline-none placeholder:text-ink/40 focus:border-accent-dark"
        />
        <Button type="submit" size="lg" className="shrink-0">
          {cta}
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M3 8h10M9 4l4 4-4 4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => setText(suggestion)}
            className="min-h-11 rounded-full border sm:min-h-9 border-border bg-paper px-3.5 text-[13px] text-ink/75 transition-colors hover:border-accent-dark/40 hover:text-ink focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-gold/35"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </form>
  );
}
