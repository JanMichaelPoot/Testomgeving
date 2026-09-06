"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface PillSliderProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
}

// A discrete, labeled slider styled as a pill-shaped track. Interaction is
// click-or-drag (pointer events) rather than a native <input type="range">,
// so it looks like a slider but behaves like the app's existing chip
// buttons — easier to keep visually consistent and accessible.
export function PillSlider({ options, value, onChange, label }: PillSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const activeIndex = Math.max(0, options.indexOf(value));
  const lastIndex = options.length - 1;
  const percent = lastIndex === 0 ? 0 : (activeIndex / lastIndex) * 100;

  const indexFromClientX = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) return activeIndex;
      const rect = track.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      return Math.round(ratio * lastIndex);
    },
    [activeIndex, lastIndex]
  );

  const selectFromClientX = useCallback(
    (clientX: number) => {
      const index = indexFromClientX(clientX);
      const next = options[index];
      if (next !== undefined && next !== value) onChange(next);
    },
    [indexFromClientX, onChange, options, value]
  );

  useEffect(() => {
    if (!dragging) return;

    function handleMove(e: PointerEvent) {
      selectFromClientX(e.clientX);
    }
    function handleUp() {
      setDragging(false);
    }

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [dragging, selectFromClientX]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = options[Math.min(lastIndex, activeIndex + 1)];
      if (next) onChange(next);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      const next = options[Math.max(0, activeIndex - 1)];
      if (next) onChange(next);
    } else if (e.key === "Home") {
      e.preventDefault();
      const first = options[0];
      if (first) onChange(first);
    } else if (e.key === "End") {
      e.preventDefault();
      const last = options[lastIndex];
      if (last) onChange(last);
    }
  }

  return (
    <div>
      {label && (
        <p className="text-xs font-medium uppercase tracking-widest text-ink/40">
          {label}
        </p>
      )}
      <p className="mt-1 text-lg font-medium text-ink">{options[activeIndex]}</p>

      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-valuemin={0}
        aria-valuemax={lastIndex}
        aria-valuenow={activeIndex}
        aria-valuetext={options[activeIndex]}
        aria-label={label}
        onKeyDown={handleKeyDown}
        onPointerDown={(e) => {
          setDragging(true);
          selectFromClientX(e.clientX);
        }}
        className="relative mt-4 h-11 w-full cursor-pointer touch-none rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
      >
        {/* Visual track only — kept slim on purpose. The 44px-tall parent
            above is the actual hit target, so mobile taps land reliably
            without making the bar itself look chunky. */}
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-ink/10" />
        <div
          className="pointer-events-none absolute left-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-accent"
          style={{ width: `${percent}%` }}
        />
        {options.map((option, index) => {
          const stopPercent = lastIndex === 0 ? 0 : (index / lastIndex) * 100;
          const filled = index <= activeIndex;
          const isThumb = index === activeIndex;
          return (
            <div
              key={option}
              className={cn(
                "absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition-colors",
                isThumb
                  ? "h-5 w-5 border-accent-dark bg-white shadow-sm"
                  : "h-3 w-3",
                !isThumb && filled && "border-accent bg-accent",
                !isThumb && !filled && "border-ink/20 bg-paper"
              )}
              style={{ left: `${stopPercent}%` }}
            />
          );
        })}
      </div>

      <div className="mt-2 flex items-center justify-between text-xs text-ink/40">
        <span>{options[0]}</span>
        <span>{options[lastIndex]}</span>
      </div>
    </div>
  );
}
