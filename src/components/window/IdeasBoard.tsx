"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { likeIdea, skipIdea, reshapeIdea } from "@/app/ideas/actions";
import type { Database } from "@/types/database";
import type { RefineDirection } from "@/lib/claude/ideas";

type Idea = Database["public"]["Tables"]["ideas"]["Row"];

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

export function IdeasBoard({ initialIdeas }: { initialIdeas: Idea[] }) {
  const [ideas, setIdeas] = useState(initialIdeas);
  const [reshapingId, setReshapingId] = useState<string | null>(null);
  const [cardErrors, setCardErrors] = useState<Record<string, string>>({});
  const [, startTransition] = useTransition();

  const likedCount = ideas.filter((idea) => idea.status === "liked").length;

  function handleLike(id: string) {
    setIdeas((prev) =>
      prev.map((idea) => (idea.id === id ? { ...idea, status: "liked" } : idea))
    );
    startTransition(async () => {
      try {
        await likeIdea(id);
      } catch {
        // Best-effort — the like still reflects locally for this session.
      }
    });
  }

  function handleSkip(id: string) {
    setIdeas((prev) => prev.filter((idea) => idea.id !== id));
    startTransition(async () => {
      try {
        await skipIdea(id);
      } catch {
        // Best-effort — the card is already gone from view.
      }
    });
  }

  function handleReshape(id: string, direction: RefineDirection) {
    setReshapingId(id);
    setCardErrors((prev) => ({ ...prev, [id]: "" }));
    startTransition(async () => {
      try {
        const reshaped = await reshapeIdea(id, direction);
        setIdeas((prev) =>
          prev.map((idea) =>
            idea.id === id
              ? {
                  ...idea,
                  title: reshaped.title,
                  description: reshaped.description,
                  status: "refined",
                }
              : idea
          )
        );
      } catch (err) {
        setCardErrors((prev) => ({
          ...prev,
          [id]:
            err instanceof Error
              ? err.message
              : "Couldn't reshape this one — try again.",
        }));
      } finally {
        setReshapingId(null);
      }
    });
  }

  return (
    <div className="pb-28">
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {ideas.map((idea) => (
          <IdeaCard
            key={idea.id}
            idea={idea}
            busy={reshapingId === idea.id}
            error={cardErrors[idea.id]}
            onLike={() => handleLike(idea.id)}
            onSkip={() => handleSkip(idea.id)}
            onReshape={(direction) => handleReshape(idea.id, direction)}
          />
        ))}
      </div>

      {ideas.length === 0 && (
        <p className="mt-16 text-center text-ink/50">
          You&rsquo;ve skipped everything — reload the page for a new set.
        </p>
      )}

      <div className="fixed inset-x-0 bottom-0 border-t border-ink/10 bg-cream/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 sm:px-10">
          <p className="text-sm text-ink/60">
            {likedCount === 0
              ? "Like a few to see what fits."
              : `${likedCount} idea${likedCount === 1 ? "" : "s"} saved`}
          </p>
          {likedCount === 0 ? (
            <Button disabled>See what fits</Button>
          ) : (
            <Button href="/converge">See what fits</Button>
          )}
        </div>
      </div>
    </div>
  );
}

function IdeaCard({
  idea,
  busy,
  error,
  onLike,
  onSkip,
  onReshape,
}: {
  idea: Idea;
  busy: boolean;
  error?: string;
  onLike: () => void;
  onSkip: () => void;
  onReshape: (direction: RefineDirection) => void;
}) {
  const liked = idea.status === "liked";

  return (
    <div
      className={cn(
        "flex flex-col rounded-2xl border bg-paper p-6 shadow-sm transition-opacity",
        liked ? "border-accent" : "border-ink/10",
        busy && "opacity-60"
      )}
    >
      <span
        className={cn(
          "self-start rounded-full px-3 py-1 text-xs font-medium",
          LENS_STYLE[idea.lens] ?? "bg-ink/8 text-ink/70"
        )}
      >
        {LENS_LABEL[idea.lens] ?? idea.lens}
      </span>

      <h3 className="mt-4 font-serif text-xl text-ink">{idea.title}</h3>
      <p className="mt-2 flex-1 text-sm text-ink/70">{idea.description}</p>

      {error && (
        <p className="mt-3 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}

      <div className="mt-5 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onLike}
          disabled={busy}
          className={cn(
            "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50",
            liked
              ? "border-accent bg-accent text-white"
              : "border-ink/15 text-ink hover:border-accent/50"
          )}
        >
          {liked ? "Liked" : "Like"}
        </button>
        <button
          type="button"
          onClick={onSkip}
          disabled={busy}
          className="rounded-full border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-ink/30 disabled:opacity-50"
        >
          Skip
        </button>
        <button
          type="button"
          onClick={() => onReshape("weirder")}
          disabled={busy}
          className="rounded-full border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-accent/50 disabled:opacity-50"
        >
          Make it weirder
        </button>
        <button
          type="button"
          onClick={() => onReshape("more_practical")}
          disabled={busy}
          className="rounded-full border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-accent/50 disabled:opacity-50"
        >
          More practical
        </button>
      </div>
    </div>
  );
}
