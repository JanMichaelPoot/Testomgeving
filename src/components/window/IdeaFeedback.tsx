"use client";

import { useState, useTransition } from "react";
import { trackEvent } from "@/lib/posthog/client";
import { submitIdeaFeedback, type IdeaFeedbackValue } from "@/app/plan/actions";
import { cn } from "@/lib/utils";

// Fase 6 (Interaction & Retention) — a small thumbs-style reaction shown
// under each idea on /plan only (see IdeaBookViewer.tsx; IdeaDetail itself
// stays free of this, since it's also reused by the public /shared/[id]
// preview). Optimistic: the UI updates immediately on click, the server
// action fires in the background, and a failure quietly reverts the local
// state rather than surfacing an error — a reaction that doesn't save isn't
// worth interrupting the reading experience over.
export function IdeaFeedback({
  planId,
  ideaKey,
  initialValue,
  prompt,
  upLabel,
  downLabel,
  thanksLabel,
  onChange,
}: {
  planId: string;
  ideaKey: string;
  initialValue: IdeaFeedbackValue | null;
  prompt: string;
  upLabel: string;
  downLabel: string;
  thanksLabel: string;
  // Lets a parent that also shows this reaction elsewhere (the heart on a
  // door card, see PlanReveal.tsx) stay in sync. Also fired with the previous
  // value when saving fails and the optimistic change is rolled back.
  onChange?: (value: IdeaFeedbackValue | null) => void;
}) {
  const [value, setValue] = useState<IdeaFeedbackValue | null>(initialValue);
  const [, startTransition] = useTransition();

  function choose(next: IdeaFeedbackValue) {
    // Clicking the already-selected reaction clears it — a change of mind
    // shouldn't need a separate "undo" control.
    const resolved = value === next ? null : next;
    const previous = value;
    setValue(resolved);
    onChange?.(resolved);
    trackEvent("idea_feedback_given", { planId, ideaKey, value: resolved });
    startTransition(async () => {
      try {
        await submitIdeaFeedback(planId, ideaKey, resolved);
      } catch {
        setValue(previous);
        onChange?.(previous);
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-xs font-medium uppercase tracking-widest text-ink/40">{prompt}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-pressed={value === "up"}
          aria-label={upLabel}
          onClick={() => choose("up")}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full border transition-colors",
            value === "up"
              ? "border-accent bg-accent text-white"
              : "border-ink/15 text-ink/50 hover:border-accent/50 hover:text-accent-dark"
          )}
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M6 14H3.5A1.5 1.5 0 012 12.5V8.914a1.5 1.5 0 01.44-1.06L6 4v-.5A1.5 1.5 0 017.5 2c.966 0 1.75.784 1.75 1.75v2.5H12a1.5 1.5 0 011.47 1.794l-.9 4.5A1.5 1.5 0 0111.1 14H6z"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <button
          type="button"
          aria-pressed={value === "down"}
          aria-label={downLabel}
          onClick={() => choose("down")}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full border transition-colors",
            value === "down"
              ? "border-ink/40 bg-ink/10 text-ink"
              : "border-ink/15 text-ink/50 hover:border-ink/30 hover:text-ink"
          )}
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M10 2H12.5A1.5 1.5 0 0114 3.5V7.086a1.5 1.5 0 01-.44 1.06L10 12v.5A1.5 1.5 0 018.5 14c-.966 0-1.75-.784-1.75-1.75v-2.5H4a1.5 1.5 0 01-1.47-1.794l.9-4.5A1.5 1.5 0 014.9 2H10z"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
      {value && <span className="text-xs text-ink/40">{thanksLabel}</span>}
    </div>
  );
}
