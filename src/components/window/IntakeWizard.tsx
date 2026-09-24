"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { PillSlider } from "@/components/ui/PillSlider";
import { LocationAutocomplete } from "@/components/ui/LocationAutocomplete";
import { cn } from "@/lib/utils";
import { isRedirectError } from "@/lib/isRedirectError";
import { trackEvent } from "@/lib/posthog/client";
import { submitIntake, type IntakeAnswers } from "@/app/intake/actions";
import { WindowMark } from "@/components/window/WindowMark";
import { IntakeAnswerStrip, IntakeWindowPanel } from "@/components/window/IntakeWindowPanel";
import { buildWindowPanes, minutesLeft } from "@/lib/intakeWindow";
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
  fields: FieldConfig[];
}

function buildPages(answers: IntakeAnswers, dict: IntakeDict): PageConfig[] {
  const purposeKey = answers.purpose as keyof IntakeDict["purposeFollowUp"];
  const followUp = dict.purposeFollowUp[purposeKey] ?? dict.purposeFollowUp.self;
  const companySubKey = answers.purpose as keyof IntakeDict["company"]["sub"];
  const companySub = dict.company.sub[companySubKey] ?? dict.company.sub.self;

  return [
    {
      id: "situation",
      heading: dict.pages.situation.heading,
      subheading: dict.pages.situation.subheading,
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
          suggestions: followUp.suggestions,
        },
      ],
    },
    {
      id: "about",
      heading: dict.pages.about.heading,
      subheading: dict.pages.about.subheading,
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
        {
          id: "freeTimePattern",
          type: "chips",
          label: dict.freeTimePattern.label,
          sub: dict.freeTimePattern.sub,
          options: dict.freeTimePattern.options,
        },
      ],
    },
    {
      id: "dials",
      heading: dict.pages.dials.heading,
      subheading: dict.pages.dials.subheading,
      fields: [
        {
          id: "practicalToWild",
          type: "slider",
          label: dict.practicalToWild.label,
          options: dict.practicalToWild.options,
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
        {
          id: "personalReflection",
          type: "text",
          label: dict.personalReflection.label,
          sub: dict.personalReflection.sub,
          placeholder: dict.personalReflection.placeholder,
          optional: true,
          optionalHint: dict.personalReflection.optionalHint,
          suggestions: dict.personalReflection.suggestions,
        },
      ],
    },
    {
      id: "final",
      heading: dict.pages.final.heading,
      subheading: dict.pages.final.subheading,
      fields: [
        {
          id: "company",
          type: "multi-chips",
          label: dict.company.label,
          sub: companySub,
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
  freeTimePattern: "",
  practicalToWild: "either",
  timeAvailable: "halfday",
  budget: "25",
  effort: "some",
  solutionTypes: [],
  mustHaves: "",
  preferences: "",
  personalReflection: "",
  company: [],
};

// Draft persistence — sessionStorage only (cleared on tab close and never
// synced anywhere), so a refresh or an accidental back-navigation mid-intake
// doesn't throw away answers, without keeping anything beyond the tab's
// lifetime. Guarded for SSR (`typeof window === "undefined"`) and wrapped in
// try/catch since storage can throw or be unavailable (private browsing).
const DRAFT_KEY = "window-intake-draft-v1";

interface IntakeDraft {
  page: number;
  answers: IntakeAnswers;
}

function loadDraft(): IntakeDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { page?: number; answers?: Partial<IntakeAnswers> };
    if (!parsed.answers) return null;
    return {
      page: typeof parsed.page === "number" ? parsed.page : 0,
      answers: { ...EMPTY_ANSWERS, ...parsed.answers },
    };
  } catch {
    return null;
  }
}

// Visiting the wizard saves an (empty) draft as soon as it mounts, so "a draft
// exists" alone can't mean "the person has started" — otherwise a second visit
// from the landing page's start form would never carry its text over. Only a
// draft with actual progress or answers counts as one worth protecting.
function isBlankDraft(draft: IntakeDraft): boolean {
  return draft.page === 0 && JSON.stringify(draft.answers) === JSON.stringify(EMPTY_ANSWERS);
}

const MAX_SITUATION_FROM_URL = 500;

function readSituationFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const value = new URLSearchParams(window.location.search).get("situation");
  const trimmed = (value ?? "").trim().slice(0, MAX_SITUATION_FROM_URL).trim();
  return trimmed || null;
}

function saveDraft(draft: IntakeDraft) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Storage full or unavailable — the draft simply isn't persisted.
  }
}

function clearDraft() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // Nothing to do if storage is unavailable.
  }
}

// Selection card used by both the single-choice ("chips") and multi-choice
// ("multi-chips") field types — a 2px ink border plus a light fill and a
// checkmark communicates "selected" without relying on a color/contrast
// shift alone.
function ChipOption({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "flex min-h-13 items-center justify-between gap-3 rounded-lg border-2 px-4 py-3.5 text-left text-sm font-medium transition-colors",
        selected
          ? "border-ink bg-surface-active text-ink"
          : "border-border bg-paper text-ink hover:border-ink/30"
      )}
    >
      <span>{label}</span>
      {selected && (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0">
          <path d="M3 8.5l3.2 3.2L13 4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

function canContinuePage(page: PageConfig, answers: IntakeAnswers): boolean {
  return page.fields.every((field) => {
    if (field.type === "slider") return true;
    if (field.type === "multi-chips") return (answers[field.id] as string[]).length > 0;
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
  const [hydrated, setHydrated] = useState(false);
  const [touchedSliders, setTouchedSliders] = useState<Set<StepId>>(new Set());

  // Restore a draft (if any) once on mount, then start persisting on every
  // change. The hydrated gate stops that first restore from immediately
  // re-saving itself, and stops us from ever overwriting a real draft with
  // the initial empty-answers render.
  useEffect(() => {
    // Deliberate one-time sync from an external system (sessionStorage) that
    // can only be read after mount, to keep server and first-client render
    // identical for hydration. Not a subscription, so the cascading-render
    // caution behind this rule doesn't apply here.
    const draft = loadDraft();
    if (draft && !isBlankDraft(draft)) {
      // One-time hydration-safe restore from sessionStorage, not a render loop.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPage(draft.page);
      setAnswers(draft.answers);
    } else {
      // No real draft to protect: pick up what the landing page's start form
      // sent along (?situation=). Read once on mount, never re-applied.
      const fromLanding = readSituationFromUrl();
      if (fromLanding) {
        setAnswers((prev) => ({ ...prev, situation: fromLanding }));
      }
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveDraft({ page, answers });
  }, [hydrated, page, answers]);

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

  // Shared by every multi-select field (solutionTypes, company) — generic
  // over the field id rather than one hardcoded array, since Fase 5 added
  // a second multi-chips field alongside the original solutionTypes one.
  function toggleMultiChip(fieldId: StepId, option: string) {
    setAnswers((prev) => {
      const current = prev[fieldId] as string[];
      const has = current.includes(option);
      return {
        ...prev,
        [fieldId]: has ? current.filter((o) => o !== option) : [...current, option],
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
        if (isRedirectError(err)) {
          clearDraft();
          throw err;
        }
        setError(err instanceof Error ? err.message : dict.errorGeneric);
      }
    });
  }

  function renderField(field: FieldConfig) {
    switch (field.type) {
      case "text": {
        const inputId = `field-${field.id}`;
        return (
          <div key={field.id}>
            <label htmlFor={inputId} className="block font-medium text-ink">
              {field.label}
            </label>
            {field.sub && <p className="mt-1 text-sm text-ink/60">{field.sub}</p>}
            {field.suggestions && field.suggestions.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {field.suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setField(field.id, suggestion)}
                    className="rounded-full border border-border bg-paper px-3.5 py-1.5 text-xs text-ink/70 transition-colors hover:border-ink/40 hover:text-ink"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
            <textarea
              id={inputId}
              value={answers[field.id] as string}
              onChange={(e) => setField(field.id, e.target.value)}
              placeholder={field.placeholder}
              rows={3}
              className="mt-3 w-full rounded-lg border border-border bg-paper px-4 py-3 text-ink leading-relaxed outline-none placeholder:text-ink/35 focus:border-ink"
            />
            {field.optionalHint && !(answers[field.id] as string).trim() && (
              <p className="mt-2 text-xs text-ink/45">{field.optionalHint}</p>
            )}
          </div>
        );
      }
      case "chips": {
        const currentValue = answers[field.id] as string;
        const labelId = `field-${field.id}-label`;
        return (
          <div key={field.id}>
            <p id={labelId} className="font-medium text-ink">
              {field.label}
            </p>
            {field.sub && <p className="mt-1 text-sm text-ink/60">{field.sub}</p>}
            <div
              role="group"
              aria-labelledby={labelId}
              className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2"
            >
              {field.options.map((option) => {
                const selected = currentValue === option.value;
                return (
                  <ChipOption
                    key={option.value}
                    label={option.label}
                    selected={selected}
                    onClick={() => setField(field.id, option.value)}
                  />
                );
              })}
            </div>
          </div>
        );
      }
      case "multi-chips": {
        const labelId = `field-${field.id}-label`;
        return (
          <div key={field.id}>
            <p id={labelId} className="font-medium text-ink">
              {field.label}
            </p>
            {field.sub && <p className="mt-1 text-sm text-ink/60">{field.sub}</p>}
            <div
              role="group"
              aria-labelledby={labelId}
              className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2"
            >
              {field.options.map((option) => {
                const selected = (answers[field.id] as string[]).includes(option.value);
                return (
                  <ChipOption
                    key={option.value}
                    label={option.label}
                    selected={selected}
                    onClick={() => toggleMultiChip(field.id, option.value)}
                  />
                );
              })}
            </div>
          </div>
        );
      }
      case "location": {
        const inputId = `field-${field.id}`;
        return (
          <div key={field.id}>
            <label htmlFor={inputId} className="block font-medium text-ink">
              {field.label}
            </label>
            {field.sub && <p className="mt-1 text-sm text-ink/60">{field.sub}</p>}
            <LocationAutocomplete
              id={inputId}
              value={answers[field.id] as string}
              onChange={(value) => setField(field.id, value)}
              placeholder={field.placeholder}
            />
          </div>
        );
      }
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
            touched={touchedSliders.has(field.id)}
            onChange={(label) => {
              const match = field.options.find((o) => o.label === label);
              if (match) setField(field.id, match.value);
              setTouchedSliders((prev) => new Set(prev).add(field.id));
            }}
          />
        );
    }
  }

  const progressPercent = ((page + 1) / pages.length) * 100;
  const windowPanes = buildWindowPanes(answers, dict, EMPTY_ANSWERS, touchedSliders);
  const timeLeft = minutesLeft(page);

  return (
    <div className="flex w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-border bg-paper md:flex-row">
      {/* Left (desktop): the "Jouw venster" panel that fills with the answers
          given so far — replaces the per-page still-life photos. */}
      <IntakeWindowPanel panes={windowPanes} dict={dict.window} />

      {/* Right: form */}
      <div className="flex flex-1 flex-col">
        <div className="px-6 pt-8 sm:px-10">
          <div className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-2 rounded-full bg-surface-active px-3 py-1 text-xs font-medium text-ink/70">
              <WindowMark className="h-3.5 w-3.5" />
              {dict.stepWord} {page + 1} {dict.ofWord} {pages.length}
              {" · "}
              {timeLeft > 0
                ? dict.window.timeLeft.replace("{n}", String(timeLeft))
                : dict.window.almostDone}
            </span>
          </div>
          <IntakeAnswerStrip panes={windowPanes} />
          <div className="mt-4 h-0.5 w-full overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-ink transition-[width] duration-300 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <div key={currentPage.id} className="animate-window-page-in flex-1 px-6 pb-4 pt-8 sm:px-10">
          <h1 className="font-sans text-2xl font-semibold tracking-[-0.02em] text-ink sm:text-3xl">
            {currentPage.heading}
          </h1>
          <p className="mt-2 text-ink/60">{currentPage.subheading}</p>
          {currentPage.intro && (
            <p className="mt-4 rounded-lg border border-border bg-surface-active px-4 py-3 text-sm text-ink/70">
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
        </div>

        <div className="flex items-center justify-between border-t border-border px-6 py-6 sm:px-10">
          {page > 0 ? (
            <Button variant="ghost" onClick={goBack} disabled={isPending}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M13 8H3M7 4L3 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
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
            {!isLastPage && (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
