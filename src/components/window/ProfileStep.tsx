"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";
import { AXIS_IDS, type AxisId, type AxesOverride } from "@/lib/discovery/associationProfile";
import type { ProfileStory } from "@/lib/discovery/profileStory";
import type { VensterDictionary } from "@/lib/i18n/venster";
import { cn } from "@/lib/utils";

// The last screen of the image intake, "Zo kijken wij door jouw venster" (R2.1): the window, what
// we read in it in a few sentences, what stands out, four sliders to steer, what we look for and
// leave out, one optional line of their own, and a teaser. All sentences come from
// buildProfileStory (fixed parts, no AI); this component only shows them and passes changes up.

type Copy = VensterDictionary["profile"];

const SLIDER_MIN = -2;
const SLIDER_MAX = 2;

export function ProfileStep({
  copy,
  story,
  override,
  onAxis,
  heading,
  windowView,
  missTitle,
  reflection,
  onReflection,
  adjusting,
  onToggleAdjust,
  correctionTags,
  tagLabels,
  corrections,
  onToggleCorrection,
  payment,
}: {
  copy: Copy;
  story: ProfileStory;
  override: AxesOverride;
  onAxis: (axis: AxisId, value: number) => void;
  heading: string;
  /** The window (WindowFrame) at hero size, with the text answers on its sill. */
  windowView: ReactNode;
  missTitle: string;
  reflection: string;
  onReflection: (text: string) => void;
  adjusting: boolean;
  onToggleAdjust: () => void;
  correctionTags: string[];
  tagLabels: Record<string, string>;
  corrections: string[];
  onToggleCorrection: (tag: string) => void;
  /** The order block (price, what you get, the payment): the last thing on the screen, so there is no separate checkout page. */
  payment: ReactNode;
}) {
  // On a phone the sliders and the filters sit in a block that starts closed; on a computer it is always open.
  const [moreOpen, setMoreOpen] = useState(false);
  const open = moreOpen || adjusting;

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.09em] text-gold">{copy.kicker}</p>
      <h1 className="mt-2 font-serif text-[28px] leading-tight text-ink sm:text-4xl">{heading}</h1>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)] lg:gap-12">
        <div className="mx-auto w-44 sm:w-56 lg:mx-0 lg:w-full">
          {windowView}
        </div>

        <div className="min-w-0">
          {story.pickedCards.length > 0 && (
            <ul className="flex gap-2" aria-hidden="true">
              {story.pickedCards.map((c) => (
                <li key={c.id} className="relative h-14 w-14 overflow-hidden rounded-xl border border-border">
                  <Image src={c.image} alt="" fill sizes="56px" className="object-cover" />
                </li>
              ))}
            </ul>
          )}

          {/* The portrait: one line that says what is being looked for, then a few sentences that read the choices. */}
          <div aria-live="polite">
            <p className="mt-4 font-serif text-2xl leading-snug text-ink sm:text-3xl">{story.headline}</p>
            <p className="mt-3 max-w-prose text-base leading-relaxed text-ink/75 sm:text-lg">{story.story}</p>
          </div>

          <div className="mt-5 rounded-2xl border border-border bg-surface-active px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-[0.09em] text-gold">{copy.tensionLabel}</p>
            <p className="mt-1 text-ink/80">{story.tension.text}</p>
          </div>

          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="profile-more"
            className="mt-5 flex min-h-11 w-full items-center justify-between rounded-xl border border-border bg-paper px-4 text-sm font-semibold text-ink lg:hidden"
          >
            {copy.moreTitle}
            <span aria-hidden="true" className={cn("transition-transform", open && "rotate-180")}>
              ▾
            </span>
          </button>

          <div id="profile-more" className={cn("mt-5 space-y-6", open ? "block" : "hidden", "lg:block")}>
            <section aria-labelledby="profile-axes">
              <h2 id="profile-axes" className="font-semibold text-ink">
                {copy.axesTitle}
              </h2>
              <div className="mt-3 space-y-4">
                {AXIS_IDS.map((axis) => {
                  const value = Math.max(SLIDER_MIN, Math.min(SLIDER_MAX, Math.round(story.axes[axis] * 2)));
                  const labels = copy.axes[axis];
                  const text = value < 0 ? labels.low : value > 0 ? labels.high : `${labels.low} / ${labels.high}`;
                  return (
                    <div key={axis}>
                      <label htmlFor={`axis-${axis}`} className="flex items-baseline justify-between text-sm">
                        <span className="font-medium text-ink">{labels.label}</span>
                        {override[axis] !== undefined && <span className="text-xs text-gold">{text}</span>}
                      </label>
                      <div className="mt-1 flex items-center gap-3 text-xs text-ink/55">
                        <span className="w-16 shrink-0 text-right">{labels.low}</span>
                        <input
                          id={`axis-${axis}`}
                          type="range"
                          min={SLIDER_MIN}
                          max={SLIDER_MAX}
                          step={1}
                          value={value}
                          aria-valuetext={text}
                          onChange={(e) => onAxis(axis, Number(e.target.value) / 2)}
                          className="h-11 min-w-0 flex-1 cursor-pointer accent-accent-dark"
                        />
                        <span className="w-16 shrink-0">{labels.high}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <div className="grid gap-5 sm:grid-cols-2">
              <section aria-labelledby="profile-seek">
                <h2 id="profile-seek" className="text-sm font-semibold text-ink">
                  {copy.seekTitle}
                </h2>
                <ul className="mt-2 space-y-1.5 text-sm text-ink/80">
                  {story.seek.map((line) => (
                    <li key={line} className="flex gap-2">
                      <span aria-hidden="true" className="text-gold">
                        +
                      </span>
                      {line}
                    </li>
                  ))}
                </ul>
              </section>
              {story.omit.length > 0 && (
                <section aria-labelledby="profile-omit">
                  <h2 id="profile-omit" className="text-sm font-semibold text-ink">
                    {copy.omitTitle}
                  </h2>
                  <ul className="mt-2 space-y-1.5 text-sm text-ink/80">
                    {story.omit.map((line) => (
                      <li key={line} className="flex gap-2">
                        <span aria-hidden="true" className="text-ink/40">
                          −
                        </span>
                        {line}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>

            {adjusting && (
              <section aria-labelledby="profile-fix">
                <h2 id="profile-fix" className="text-sm font-semibold text-ink">
                  {copy.fixPrompt}
                </h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {correctionTags.map((t) => {
                    const on = corrections.includes(t);
                    return (
                      <button
                        key={t}
                        type="button"
                        aria-pressed={on}
                        onClick={() => onToggleCorrection(t)}
                        className={cn(
                          "min-h-11 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                          on ? "border-accent-dark bg-accent-dark text-paper" : "border-border bg-paper text-ink hover:border-walnut-light",
                        )}
                      >
                        {tagLabels[t] ?? t}
                      </button>
                    );
                  })}
                </div>
              </section>
            )}
          </div>

          <button
            type="button"
            onClick={onToggleAdjust}
            aria-pressed={adjusting}
            className="mt-5 min-h-11 rounded-full border border-border bg-paper px-5 text-sm font-semibold text-ink transition-colors hover:border-walnut-light"
          >
            {adjusting ? copy.adjustDone : copy.adjust}
          </button>

          <section className="mt-8" aria-labelledby="profile-miss">
            <h2 id="profile-miss" className="font-semibold text-ink">
              {missTitle}
            </h2>
            <p className="mt-1 text-sm text-ink/60">{copy.missSub}</p>
            {story.suggestions.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {story.suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => onReflection(s)}
                    className="min-h-11 rounded-full border border-border bg-paper px-3.5 py-1.5 text-xs text-ink/70 transition-colors hover:border-ink/40 hover:text-ink"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            <textarea
              value={reflection}
              onChange={(e) => onReflection(e.target.value.slice(0, 400))}
              placeholder={copy.missPlaceholder}
              aria-labelledby="profile-miss"
              rows={3}
              className="mt-3 w-full rounded-lg border border-border bg-paper px-4 py-3 leading-relaxed text-ink outline-none placeholder:text-ink/35 focus:border-ink"
            />
          </section>

          <p className="mt-6 font-serif text-lg italic text-accent-dark">{copy.teaser}</p>
        </div>
      </div>
      <div className="mt-12">{payment}</div>
    </div>
  );
}
