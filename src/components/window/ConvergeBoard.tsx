"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { createCheckoutSession } from "@/app/converge/actions";

export interface Candidate {
  idea_id: string;
  lens: string;
  title: string;
  description: string;
  why_it_fits: string;
}

const LENS_LABEL: Record<string, string> = {
  practical: "Practical",
  unusual: "Unusual",
  ambitious: "Ambitious",
  playful: "Playful",
};

const LENS_STYLE: Record<string, string> = {
  practical: "bg-ink/8 text-ink/70",
  unusual: "bg-accent/10 text-accent-dark",
  ambitious: "bg-accent text-white",
  playful: "bg-[#F6DFC2] text-[#7A4A1E]",
};

export function ConvergeBoard({ candidates }: { candidates: Candidate[] }) {
  const [selectedId, setSelectedId] = useState(candidates[0]?.idea_id ?? "");
  const [waiverConfirmed, setWaiverConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    if (!selectedId || !waiverConfirmed) return;
    setError(null);
    startTransition(async () => {
      try {
        await createCheckoutSession(selectedId, waiverConfirmed);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Something went wrong opening checkout. Please try again."
        );
      }
    });
  }

  return (
    <div>
      <div
        className={cn(
          "grid gap-6",
          candidates.length > 1 && "sm:grid-cols-2",
          candidates.length > 2 && "lg:grid-cols-3"
        )}
      >
        {candidates.map((candidate) => {
          const selected = candidate.idea_id === selectedId;
          return (
            <button
              key={candidate.idea_id}
              type="button"
              onClick={() => setSelectedId(candidate.idea_id)}
              aria-pressed={selected}
              className={cn(
                "flex flex-col rounded-2xl border bg-paper p-6 text-left shadow-sm transition-colors",
                selected
                  ? "border-accent ring-2 ring-accent/30"
                  : "border-ink/10 hover:border-ink/25"
              )}
            >
              <span
                className={cn(
                  "self-start rounded-full px-3 py-1 text-xs font-medium",
                  LENS_STYLE[candidate.lens] ?? "bg-ink/8 text-ink/70"
                )}
              >
                {LENS_LABEL[candidate.lens] ?? candidate.lens}
              </span>

              <h3 className="mt-4 font-serif text-xl text-ink">
                {candidate.title}
              </h3>
              <p className="mt-2 text-sm text-ink/70">
                {candidate.description}
              </p>

              <p className="mt-4 rounded-xl bg-accent/5 px-3 py-2 text-sm text-accent-dark">
                {candidate.why_it_fits}
              </p>
            </button>
          );
        })}
      </div>

      <div className="mt-10 max-w-2xl rounded-2xl border border-ink/10 bg-paper p-6">
        <p className="text-sm text-ink/60">
          WINDOW offers possibilities to explore — not medical, therapeutic,
          financial, or legal advice. Use your own judgment, and consult a
          professional where it matters.
        </p>

        <label className="mt-4 flex items-start gap-3 text-sm text-ink/80">
          <input
            type="checkbox"
            checked={waiverConfirmed}
            onChange={(e) => setWaiverConfirmed(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-ink/30 text-accent focus:ring-accent"
          />
          <span>
            I understand that my Window Plan is delivered digitally and
            immediately, so my statutory 14-day right of withdrawal no
            longer applies once payment completes.
          </span>
        </label>

        {error && (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        <div className="mt-6">
          <Button
            onClick={handleSubmit}
            disabled={!selectedId || !waiverConfirmed || isPending}
          >
            {isPending ? "Opening checkout…" : "Make this real"}
          </Button>
        </div>
      </div>
    </div>
  );
}
