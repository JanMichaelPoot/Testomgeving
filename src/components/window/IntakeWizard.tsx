"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { submitIntake, type IntakeAnswers } from "@/app/intake/actions";

type StepId = keyof IntakeAnswers;

type Question =
  | {
      id: StepId;
      type: "text";
      title: string;
      sub: string;
      placeholder: string;
    }
  | {
      id: StepId;
      type: "chips";
      title: string;
      sub: string;
      options: string[];
    };

const QUESTIONS: Question[] = [
  {
    id: "topic",
    type: "text",
    title: "What's going on?",
    sub: "Give us the shape of it — a mood, a moment, a Tuesday that needs rescuing.",
    placeholder: "A tough week, a birthday with no plan yet, a bit of restlessness…",
  },
  {
    id: "time_available",
    type: "chips",
    title: "How much time do you actually have?",
    sub: "Be honest — we'll work with whatever you've got.",
    options: ["An hour or two", "Half a day", "A full day", "A whole weekend"],
  },
  {
    id: "budget",
    type: "chips",
    title: "And your budget for this?",
    sub: "No judgment either way.",
    options: ["Keep it free", "Up to €25", "Up to €100", "Go all in"],
  },
  {
    id: "desired_surprise",
    type: "chips",
    title: "How far should we push it?",
    sub: "Some days call for practical. Some days don't.",
    options: [
      "Grounded, please",
      "A little unexpected",
      "Pleasantly weird",
      "Surprise me completely",
    ],
  },
  {
    id: "company",
    type: "chips",
    title: "Who's this window for?",
    sub: "Who's coming along, if anyone.",
    options: ["Just me", "A partner", "Friends", "Family", "Colleagues"],
  },
];

const EMPTY_ANSWERS: IntakeAnswers = {
  topic: "",
  time_available: "",
  budget: "",
  desired_surprise: "",
  company: "",
};

export function IntakeWizard() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<IntakeAnswers>(EMPTY_ANSWERS);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const question = QUESTIONS[step];
  const isLastStep = step === QUESTIONS.length - 1;
  const canContinue = useMemo(
    () => answers[question.id].trim().length > 1,
    [answers, question.id]
  );

  function setAnswer(value: string) {
    setAnswers((prev) => ({ ...prev, [question.id]: value }));
  }

  function goBack() {
    setError(null);
    setStep((prev) => Math.max(0, prev - 1));
  }

  function goNext() {
    if (!canContinue) return;

    if (!isLastStep) {
      setStep((prev) => prev + 1);
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        await submitIntake(answers);
      } catch (err) {
        // Next.js redirect() throws internally on success — anything that
        // reaches here is a genuine failure (e.g. Supabase unreachable).
        setError(
          err instanceof Error
            ? err.message
            : "Something went wrong. Please try again."
        );
      }
    });
  }

  return (
    <div className="w-full max-w-xl">
      <div className="flex items-center gap-2">
        {QUESTIONS.map((q, i) => (
          <div
            key={q.id}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors",
              i <= step ? "bg-accent" : "bg-ink/10"
            )}
          />
        ))}
      </div>
      <p className="mt-3 text-xs font-medium uppercase tracking-widest text-ink/40">
        Step {step + 1} of {QUESTIONS.length}
      </p>

      <h1 className="mt-6 font-serif text-3xl text-ink sm:text-4xl">
        {question.title}
      </h1>
      <p className="mt-3 text-ink/60">{question.sub}</p>

      <div className="mt-8">
        {question.type === "text" ? (
          <textarea
            autoFocus
            value={answers[question.id]}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder={question.placeholder}
            rows={4}
            className="w-full rounded-2xl border border-ink/15 bg-paper px-4 py-3 text-ink shadow-sm outline-none placeholder:text-ink/35 focus:border-accent"
          />
        ) : (
          <div className="flex flex-wrap gap-3">
            {question.options.map((option) => {
              const selected = answers[question.id] === option;
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setAnswer(option)}
                  className={cn(
                    "rounded-full border px-5 py-2.5 text-sm transition-colors",
                    selected
                      ? "border-accent bg-accent text-white"
                      : "border-ink/15 bg-paper text-ink hover:border-accent/50"
                  )}
                >
                  {option}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {error && (
        <p className="mt-4 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <div className="mt-10 flex items-center justify-between">
        {step > 0 ? (
          <Button variant="ghost" onClick={goBack} disabled={isPending}>
            Back
          </Button>
        ) : (
          <span />
        )}
        <Button onClick={goNext} disabled={!canContinue || isPending}>
          {isLastStep
            ? isPending
              ? "Opening…"
              : "See my possibilities"
            : "Continue"}
        </Button>
      </div>
    </div>
  );
}
