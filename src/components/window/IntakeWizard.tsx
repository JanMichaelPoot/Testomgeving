"use client";

import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { PillSlider } from "@/components/ui/PillSlider";
import { LocationAutocomplete } from "@/components/ui/LocationAutocomplete";
import { cn } from "@/lib/utils";
import { isRedirectError } from "@/lib/isRedirectError";
import { trackEvent } from "@/lib/posthog/client";
import { submitIntake, type IntakeAnswers } from "@/app/intake/actions";
import { WIZARD_PAGE_ILLUSTRATIONS } from "@/lib/illustrations";
import type { Dictionary, Option } from "@/lib/i18n/dictionaries";

type StepId = keyof IntakeAnswers;
type IntakeDict = Dictionary["intake"];

type FieldConfig =
  | {
      id: StepId;
      type: "text";
      label: string;
      sub?: string;
      placeholder: string;
      optional?: boolean;
      optionalHint?: string;
      suggestions?: string[];
    }
  | { id: StepId; type: "chips"; label: string; sub?: string; options: Option[] }
  | { id: StepId; type: "multi-chips"; label: string; sub?: string; options: Option[] }
  | { id: StepId; type: "slider"; label: string; sub?: string; options: Option[] }
  | { id: StepId; type: "location"; label: string; sub?: string; placeholder: string };

interface PageConfig {
  id: string;
  heading: string;
  subheading: string;
  intro?: string;
  image: string;
  fields: FieldConfig[];
}

function buildPages(answers: IntakeAnswers, dict: IntakeDict): PageConfig[] {
  const purposeKey = answers.purpose as keyof IntakeDict["purposeFollowUp"];
  const followUp = dict.purposeFollowUp[purposeKey] ?? dict.purposeFollowUp.self;

  return [
    {
      id: "situation",
      heading: dict.pages.situation.heading,
      subheading: dict.pages.situation.subheading,
      image: WIZARD_PAGE_ILLUSTRATIONS[0],
      fields: [
        {
          id: "situation",
          type: "text",
          label: dict.situation.label,
          sub: dict.situation.sub,
          placeholder: dict.situation.placeholder,
          suggestions: dict.situation.suggestions,
          optional: true,
          optionalHint: dict.situation.optionalHint,
        },
        {
          id: "purpose",
          type: "chips",
          label: dict.purpose.label,
          options: dict.purpose.options,
        },
        {
          id: "purposeFollowUp",
          type: "text",
          label: followUp.label,
          sub: followUp.sub,
          placeholder: followUp.placeholder,
        },
      ],
    },
    {
      id: "about",
      heading: dict.pages.about.heading,
      subheading: dict.pages.about.subheading,
      image: WIZARD_PAGE_ILLUSTRATIONS[1],
      fields: [
        {
          id: "ageCategory",
          type: "slider",
          label: dict.ageCategory.label,
          options: dict.ageCategory.options,
        },
        {
          id: "location",
          type: "location",
          label: dict.location.label,
          sub: dict.location.sub,
          placeholder: dict.location.placeholder,
        },
        {
          id: "searchDistance",
          type: "slider",
          label: dict.searchDistance.label,
          options: dict.searchDistance.options,
        },
      ],
    },
    {
      id: "dials",
      heading: dict.pages.dials.heading,
      subheading: dict.pages.dials.subheading,
      image: WIZARD_PAGE_ILLUSTRATIONS[2],
      fields: [
        {
          id: "practicalToWild",
          type: "slider",
          label: dict.practicalToWild.label,
          options: dict.practicalToWild.options,
        },
        {
          id: "surpriseLevel",
          type: "slider",
          label: dict.surpriseLevel.label,
          options: dict.surpriseLevel.options,
        },
        {
          id: "timeAvailable",
          type: "slider",
          label: dict.timeAvailable.label,
          options: dict.timeAvailable.options,
        },
        {
          id: "budget",
          type: "slider",
          label: dict.budget.label,
          options: dict.budget.options,
        },
        {
          id: "effort",
          type: "slider",
          label: dict.effort.label,
          options: dict.effort.options,
        },
      ],
    },
    {
      id: "openness",
      heading: dict.pages.openness.heading,
      subheading: dict.pages.openness.subheading,
      intro: dict.opennessIntro,
      image: WIZARD_PAGE_ILLUSTRATIONS[3],
      fields: [
        {
          id: "solutionTypes",
          type: "multi-chips",
          label: dict.solutionTypes.label,
          sub: dict.solutionTypes.sub,
          options: dict.solutionTypes.options,
        },
        {
          id: "mustHaves",
          type: "text",
          label: dict.mustHaves.label,
          sub: dict.mustHaves.sub,
          placeholder: dict.mustHaves.placeholder,
          optional: true,
          suggestions: dict.mustHaves.suggestions,
        },
        {
          id: "preferences",
          type: "text",
          label: dict.preferences.label,
          sub: dict.preferences.sub,
          placeholder: dict.preferences.placeholder,
          optional: true,
          suggestions: dict.preferences.suggestions,
        },
      ],
    },
    {
      id: "final",
      heading: dict.pages.final.heading,
      subheading: dict.pages.final.subheading,
      image: WIZARD_PAGE_ILLUSTRATIONS[4],
      fields: [
        {
          id: "company",
          type: "chips",
          label: dict.company.label,
          sub: dict.company.sub,
          options: dict.company.options,
        },
      ],
    },
  ];
}

// Neutral defaults for slider-backed fields — the middle option of each
// scale, so the user can skip a page without having implicitly picked an
// extreme. Keyed to the stable `value`s in the dictionary, not labels.
const EMPTY_ANSWERS: IntakeAnswers = {
  situation: "",
  purpose: "",
  purposeFollowUp: "",
  ageCategory: "35-44",
  location: "",
  searchDistance: "city",
  practicalToWild: "either",
  surpriseLevel: "little",
  timeAvailable: "halfday",
  budget: "25",
  effort: "some",
  solutionTypes: [],
  mustHaves: "",
  preferences: "",
  company: "",
};

function canContinuePage(page: PageConfig, answers: IntakeAnswers): boolean {
  return page.fields.every((field) => {
    if (field.type === "slider") return true;
    if (field.type === "multi-chips") return answers.solutionTypes.length > 0;
    if (field.type === "text") {
      if (field.optional) return true;
      return (answers[field.id] as string).trim().length > 1;
    }
    // chips
    return (answers[field.id] as string).length > 0;
  });
}

export function IntakeWizard({ dict }: { dict: IntakeDict }) {
  const [page, setPage] = useState(0);
  const [answers, setAnswers] = useState<IntakeAnswers>(EMPTY_ANSWERS);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const pages = useMemo(() => buildPages(answers, dict), [answers, dict]);
  const currentPage = pages[page];
  const isLastPage = page === pages.length - 1;
  const canContinue = useMemo(
    () => canContinuePage(currentPage, answers),
    [currentPage, answers]
  );

  function setField(id: StepId, value: string) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  function toggleSolutionType(option: string) {
    setAnswers((prev) => {
      const has = prev.solutionTypes.includes(option);
      return {
        ...prev,
        solutionTypes: has
          ? prev.solutionTypes.filter((o) => o !== option)
          : [...prev.solutionTypes, option],
      };
    });
  }

  function goBack() {
    setError(null);
    setPage((prev) => Math.max(0, prev - 1));
  }

  function goNext() {
    if (!canContinue) return;

    trackEvent("intake_page_completed", { page: currentPage.id, index: page });

    if (!isLastPage) {
      setPage((prev) => prev + 1);
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        await submitIntake(answers);
      } catch (err) {
        if (isRedirectError(err)) throw err;
        setError(err instanceof Error ? err.message : dict.errorGeneric);
      }
    });
  }

  function renderField(field: FieldConfig) {
    switch (field.type) {
      case "text":
        return (
          <div key={field.id}>
            <p className="font-medium text-ink">{field.label}</p>
            {field.sub && <p className="mt-1 text-sm text-ink/60">{field.sub}</p>}
            {field.suggestions && field.suggestions.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {field.suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setField(field.id, suggestion)}
                    className="rounded-full border border-ink/15 bg-paper px-3.5 py-1.5 text-xs text-ink/70 transition-colors hover:border-accent/50 hover:text-ink"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
            <textarea
              value={answers[field.id] as string}
              onChange={(e) => setField(field.id, e.target.value)}
              placeholder={field.placeholder}
              rows={3}
              className="mt-3 w-full rounded-2xl border border-ink/15 bg-paper px-4 py-3 text-ink shadow-sm outline-none placeholder:text-ink/35 focus:border-accent"
            />
            {field.optionalHint && !(answers[field.id] as string).trim() && (
              <p className="mt-2 text-xs text-ink/45">{field.optionalHint}</p>
            )}
          </div>
        );
      case "chips": {
        const currentValue = answers[field.id] as string;
        return (
          <div key={field.id}>
            <p className="font-medium text-ink">{field.label}</p>
            {field.sub && <p className="mt-1 text-sm text-ink/60">{field.sub}</p>}
            <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {field.options.map((option) => {
                const selected = currentValue === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setField(field.id, option.value)}
                    className={cn(
                      "min-h-11 rounded-2xl border-2 px-4 py-3.5 text-left text-sm font-medium shadow-sm transition-all hover:shadow-md",
                      selected
                        ? "border-accent bg-accent/10 text-accent-dark"
                        : "border-ink/12 bg-paper text-ink hover:border-accent/40"
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        );
      }
      case "multi-chips":
        return (
          <div key={field.id}>
            <p className="font-medium text-ink">{field.label}</p>
            {field.sub && <p className="mt-1 text-sm text-ink/60">{field.sub}</p>}
            <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {field.options.map((option) => {
                const selected = answers.solutionTypes.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleSolutionType(option.value)}
                    className={cn(
                      "min-h-11 rounded-2xl border-2 px-4 py-3.5 text-left text-sm font-medium shadow-sm transition-all hover:shadow-md",
                      selected
                        ? "border-accent bg-accent/10 text-accent-dark"
                        : "border-ink/12 bg-paper text-ink hover:border-accent/40"
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        );
      case "location":
        return (
          <div key={field.id}>
            <p className="font-medium text-ink">{field.label}</p>
            {field.sub && <p className="mt-1 text-sm text-ink/60">{field.sub}</p>}
            <LocationAutocomplete
              value={answers[field.id] as string}
              onChange={(value) => setField(field.id, value)}
              placeholder={field.placeholder}
            />
          </div>
        );
      case "slider":
        return (
          <PillSlider
            key={field.id}
            label={field.label}
            options={field.options.map((o) => o.label)}
            value={
              field.options.find((o) => o.value === (answers[field.id] as string))
                ?.label ?? field.options[0].label
            }
            onChange={(label) => {
              const match = field.options.find((o) => o.label === label);
              if (match) setField(field.id, match.value);
            }}
          />
        );
    }
  }

  return (
    <div className="w-full max-w-4xl">
      <div className="flex items-center gap-1.5">
        {pages.map((p, i) => (
          <div
            key={p.id}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors",
              i <= page ? "bg-accent" : "bg-ink/10"
            )}
          />
        ))}
      </div>
      <p className="mt-3 text-xs font-medium uppercase tracking-widest text-ink/40">
        {dict.stepWord} {page + 1} {dict.ofWord} {pages.length}
      </p>

      <div className="mt-6 grid gap-8 sm:grid-cols-[280px_1fr] sm:items-start">
        <div className="sm:sticky sm:top-6">
          <div className="relative aspect-4/3 w-full overflow-hidden rounded-2xl shadow-sm">
            <Image
              src={currentPage.image}
              alt=""
              fill
              sizes="(min-width: 640px) 280px, 100vw"
              className="object-cover"
              priority={page === 0}
            />
          </div>
        </div>

        <div>
          <h1 className="font-serif text-3xl text-ink sm:text-4xl">
            {currentPage.heading}
          </h1>
          <p className="mt-2 text-ink/60">{currentPage.subheading}</p>
          {currentPage.intro && (
            <p className="mt-4 rounded-2xl bg-accent/5 px-4 py-3 text-sm text-ink/70">
              {currentPage.intro}
            </p>
          )}

          <div className="mt-8 space-y-8">
            {currentPage.fields.map((field) => renderField(field))}
          </div>

          {error && (
            <p className="mt-4 text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          <div className="mt-10 flex items-center justify-between">
            {page > 0 ? (
              <Button variant="ghost" onClick={goBack} disabled={isPending}>
                {dict.back}
              </Button>
            ) : (
              <span />
            )}
            <Button onClick={goNext} disabled={!canContinue || isPending}>
              {isLastPage
                ? isPending
                  ? dict.opening
                  : dict.makeThisReal
                : dict.continueLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
