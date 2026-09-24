"use client";

import { useCallback } from "react";
import { cn } from "@/lib/utils";

// How the segments are laid out, chosen from the option set itself rather
// than the viewport: one equal-width row only works while every label fits
// its slot. Long labels ("Verras me volledig, neem me mee naar iets wilds")
// in a row at phone width wrap into unreadable one-word-per-line columns, so
// those stack as full-width rows instead; a longer run of very short labels
// (the age brackets) wraps onto two rows on narrow containers.
type Layout = "row" | "wrap" | "stack";

const ROW_MAX_OPTIONS = 4;
const ROW_MAX_LABEL = 16;
const WRAP_MAX_LABEL = 8;

export function pickLayout(options: string[]): Layout {
  const longest = Math.max(...options.map((o) => o.length));
  if (options.length <= ROW_MAX_OPTIONS && longest <= ROW_MAX_LABEL) return "row";
  if (longest <= WRAP_MAX_LABEL) return "wrap";
  return "stack";
}

interface PillSliderProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
  // Whether the user has actually interacted with this slider, vs. it still
  // sitting on its neutral default. Sliders can't be "empty" the way a text
  // field or an unpicked chip can, so without this cue a default reads as a
  // deliberate answer — this renders a small hollow-vs-filled dot instead.
  touched?: boolean;
}

// A discrete segmented control — one button per option, in a single
// role="radiogroup" row — rather than a drag-handle slider. For the small,
// fixed option sets these dials use (3-6 steps), a segmented control reads
// its current value at a glance and gives every step equal, legible
// contrast; a thumb-on-a-track needs a reader to first find the thumb, then
// compare its position against faint tick marks.
export function PillSlider({ options, value, onChange, label, touched = false }: PillSliderProps) {
  const activeIndex = Math.max(0, options.indexOf(value));
  const lastIndex = options.length - 1;
  const layout = pickLayout(options);

  const focusSegment = useCallback((container: HTMLElement, index: number) => {
    const buttons = container.querySelectorAll<HTMLButtonElement>('[role="radio"]');
    buttons[index]?.focus();
  }, []);

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    let next = activeIndex;
    // The WAI-ARIA radio-group pattern: Right/Down go forward, Left/Up go
    // back. Down = "next" matters now that long option sets are stacked
    // vertically; the arrows used to follow a slider's up = more convention.
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = Math.min(lastIndex, activeIndex + 1);
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = Math.max(0, activeIndex - 1);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = lastIndex;
    else return;

    e.preventDefault();
    const value = options[next];
    if (value !== undefined) {
      onChange(value);
      focusSegment(e.currentTarget, next);
    }
  }

  return (
    // Container queries (not viewport breakpoints): the wizard's form column is
    // narrower than the viewport on desktop, where the side panel takes 40%.
    <div className="@container">
      {label && (
        <p className="text-xs font-medium uppercase tracking-widest text-ink/50">
          {label}
        </p>
      )}
      <p className="mt-1 flex items-center gap-2 text-base font-semibold text-ink">
        {options[activeIndex]}
        <span
          aria-hidden="true"
          title={touched ? undefined : "Standaardwaarde — nog niet aangeraakt"}
          className={cn(
            "inline-block h-1.5 w-1.5 rounded-full transition-colors",
            touched ? "bg-accent" : "border border-ink/25 bg-transparent"
          )}
        />
      </p>

      <div
        role="radiogroup"
        aria-label={label}
        onKeyDown={handleKeyDown}
        className={cn(
          "mt-3 grid gap-1.5 rounded-lg border border-border bg-paper p-1.5",
          layout === "wrap" && "grid-cols-4 @md:grid-cols-7",
          layout === "stack" && "grid-cols-1"
        )}
        style={
          layout === "row"
            ? { gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }
            : undefined
        }
      >
        {options.map((option, index) => {
          const selected = index === activeIndex;
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(option)}
              className={cn(
                "min-h-11 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                layout === "stack" ? "px-4 py-2.5 text-left" : "px-1.5 text-center",
                selected
                  ? "bg-ink text-white"
                  : "text-ink/55 hover:bg-surface-active hover:text-ink"
              )}
            >
              {option}
            </button>
          );
        })}
      </div>

      {/* The end labels only add something to a compact row; stacked or
          wrapped, every option is already spelled out. */}
      {layout === "row" && (
        <div className="mt-2 flex items-center justify-between text-xs font-medium text-ink/50">
          <span>{options[0]}</span>
          <span>{options[lastIndex]}</span>
        </div>
      )}
    </div>
  );
}
