"use client";

import { cn } from "@/lib/utils";

export interface SliderStep {
  /** Short text under the track ("€25", "50 km"). */
  tick: string;
  /** The full wording read out by screen readers and shown as the current value ("Tot €25 per persoon"). */
  label: string;
}

/**
 * A slider with a few fixed steps, built on the native range input (so touch, keyboard and screen readers work as they should).
 *
 * `index` null means "not chosen yet": the handle waits at the start, dimmed, and the value line says so. Touching the slider (a tap on the
 * handle without moving counts) chooses the step it is on, so an untouched slider never silently stands for an answer. `onClear` (when
 * given) adds a small button to go back to "not chosen".
 */
export function StepSlider({
  id,
  label,
  hint,
  steps,
  index,
  onChange,
  onClear,
  clearLabel,
  unsetText,
  className,
}: {
  id: string;
  label: string;
  hint?: string;
  steps: readonly SliderStep[];
  index: number | null;
  onChange: (index: number) => void;
  onClear?: () => void;
  clearLabel?: string;
  unsetText: string;
  className?: string;
}) {
  const last = steps.length - 1;
  const shown = index ?? 0;
  const pct = last === 0 ? 0 : (shown / last) * 100;
  const current = index === null ? unsetText : steps[index]?.label ?? unsetText;
  const commit = (value: string) => onChange(Math.min(last, Math.max(0, Number(value))));

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <label htmlFor={id} className="font-semibold text-ink">
          {label}
        </label>
        <p className={cn("text-sm font-semibold", index === null ? "text-ink/70" : "text-accent-dark")} aria-live="polite" data-testid={`${id}-value`}>
          {current}
        </p>
      </div>
      {hint && <p className="text-sm text-ink/70">{hint}</p>}
      <input
        id={id}
        type="range"
        min={0}
        max={last}
        step={1}
        value={shown}
        data-unset={index === null ? "true" : undefined}
        aria-valuetext={current}
        onInput={(e) => commit(e.currentTarget.value)}
        onChange={(e) => commit(e.currentTarget.value)}
        // A tap on the handle without moving it, or the first key press, still counts as choosing the step it stands on.
        onPointerUp={(e) => commit(e.currentTarget.value)}
        onKeyUp={(e) => {
          if (["Tab", "Shift"].includes(e.key)) return;
          commit(e.currentTarget.value);
        }}
        style={{ ["--pct" as string]: `${pct}%` }}
        className="step-slider"
      />
      <div className="flex justify-between px-[14px] text-xs text-ink/70" aria-hidden="true">
        {steps.map((s, i) => (
          <span key={i} className={cn("w-0 whitespace-nowrap text-center", i === index && "font-bold text-ink")}>
            <span className="inline-block -translate-x-1/2">{s.tick}</span>
          </span>
        ))}
      </div>
      {onClear && index !== null && (
        <button
          type="button"
          onClick={onClear}
          className="inline-flex min-h-11 items-center rounded-lg px-1 text-sm font-semibold text-ink/70 underline-offset-2 hover:text-ink hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-gold/60"
        >
          {clearLabel}
        </button>
      )}
    </div>
  );
}
