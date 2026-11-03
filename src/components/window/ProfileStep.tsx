"use client";

import Image from "next/image";
import { useEffect, useState, type ReactNode } from "react";
import { AXIS_IDS, type AxisId, type AxesOverride } from "@/lib/discovery/associationProfile";
import type { InterpretBlocks } from "@/lib/discovery/interpretation";
import type { ProfileStory } from "@/lib/discovery/profileStory";
import type { VensterDictionary } from "@/lib/i18n/venster";
import { trackEvent } from "@/lib/posthog/client";
import { cn } from "@/lib/utils";

// The last screen of the image intake, "Wat jouw keuzes ons vertellen": the window, a short personal reading of what was chosen (an opening,
// the red thread, the direction of discovery, a look ahead), the images that were chosen, and the controls to steer (four sliders, extra
// themes, one line of their own). The reading is fixed text built from the choices (profileStory.ts) and shown at once; when the model-written
// version arrives (interpretation.ts, only from the facts of the choices) it replaces the fixed text. This component only shows and passes
// changes up.

type Copy = VensterDictionary["profile"];

const SLIDER_MIN = -2;
const SLIDER_MAX = 2;
/** At most this many model-written readings per browser tab: moving the sliders must not turn into a stream of calls. */
const MAX_READINGS_PER_TAB = 4;

/** What the reading is made from: ids only. The server rebuilds the facts from them and calls the model (or not). */
export interface ReadingRequest {
  associations: string[];
  interests: string[];
  corrections: string[];
  axesOverride?: AxesOverride;
  searchContext?: string;
  purpose?: string;
  recipientName?: string;
}

export type ReadingFetcher = (request: ReadingRequest) => Promise<{ ok: true; blocks: InterpretBlocks } | { ok: false }>;

function readingsThisTab(): number {
  try {
    return Number(sessionStorage.getItem("window-readings") ?? "0") || 0;
  } catch {
    return 0;
  }
}

function countReading() {
  try {
    sessionStorage.setItem("window-readings", String(readingsThisTab() + 1));
  } catch {
    // no storage: the server's own limit still holds
  }
}

/**
 * The reading that is shown: the fixed one at once, the model-written one when it has arrived for exactly these choices. A failure,
 * a limit or a missing key never changes anything the visitor sees.
 */
function useReading(fixed: InterpretBlocks, request: ReadingRequest | null, fetchReading: ReadingFetcher | undefined) {
  const requestKey = request ? JSON.stringify(request) : "";
  const [ai, setAi] = useState<{ key: string; blocks: InterpretBlocks } | null>(null);

  useEffect(() => {
    if (!request || !fetchReading) return;
    let cancelled = false;
    const cacheKey = `window-reading:${requestKey}`;
    let cached: InterpretBlocks | null = null;
    try {
      const hit = sessionStorage.getItem(cacheKey);
      cached = hit ? (JSON.parse(hit) as InterpretBlocks) : null;
    } catch {
      cached = null;
    }
    // The same choices are answered from this tab's memory; changed choices wait a moment (the sliders are still moving).
    const timer = setTimeout(
      async () => {
        if (cancelled) return;
        if (cached) {
          setAi({ key: requestKey, blocks: cached });
          return;
        }
        if (readingsThisTab() >= MAX_READINGS_PER_TAB) return;
        countReading();
        const result = await fetchReading(request).catch(() => null);
        if (cancelled || !result || !result.ok) return;
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify(result.blocks));
        } catch {
          // fine
        }
        setAi({ key: requestKey, blocks: result.blocks });
      },
      cached ? 0 : 1100,
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // `request` is fully described by requestKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey, fetchReading]);

  const written = ai && ai.key === requestKey ? ai.blocks : null;
  return { blocks: written ?? fixed, written: !!written };
}

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
  notes,
  readingRequest,
  fetchReading,
  orderCue,
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
  /** Optional notes above the order block (the two-page intake names a chosen activity that a limit rules out). */
  notes?: ReactNode;
  /** The choices the model-written reading is made from; null (or no fetcher) keeps the fixed reading. */
  readingRequest?: ReadingRequest | null;
  fetchReading?: ReadingFetcher;
  /** The line above the order block that says the order is below ("Ga verder om jouw ontdekkingsboek te bestellen"). */
  orderCue?: string;
}) {
  // The sliders and the extra themes sit in a block that starts closed.
  const [moreOpen, setMoreOpen] = useState(false);
  const open = moreOpen || adjusting;
  const { blocks, written } = useReading(story.interpretation, readingRequest ?? null, fetchReading);

  useEffect(() => {
    trackEvent("reading_shown", { source: written ? "ai" : "fixed" });
  }, [written]);

  const title = "text-xs font-bold uppercase tracking-[0.09em] text-gold-text";

  return (
    <div>
      <p className={title}>{copy.kicker}</p>
      <h1 className="mt-2 font-serif text-[28px] leading-tight text-ink sm:text-4xl">{heading}</h1>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)] lg:gap-12">
        <div className="mx-auto w-44 sm:w-56 lg:mx-0 lg:w-full">{windowView}</div>

        <div className="min-w-0">
          {/* The reading: an opening, the red thread, the direction. Redactional, not a list: three short pieces of text and the images they are about. */}
          <article aria-live="polite" data-testid="reading">
            <p className="font-serif text-2xl leading-snug text-ink sm:text-3xl" data-testid="reading-opening">
              {blocks.opening}
            </p>

            {story.chosenCards.length > 0 && (
              <figure className="mt-5" aria-label={copy.interpret.chosenLabel}>
                <ul className="grid grid-cols-4 gap-2 sm:gap-3" data-testid="reading-images">
                  {story.chosenCards.map((c) => (
                    <li key={c.id} className="min-w-0">
                      <div className="relative aspect-[4/5] overflow-hidden rounded-xl border border-border">
                        <Image src={c.image} alt="" fill sizes="(min-width: 1024px) 120px, 22vw" className="object-cover" />
                      </div>
                      <span className="mt-1 block text-[11px] leading-tight text-ink/70 sm:text-xs">{c.label}</span>
                    </li>
                  ))}
                </ul>
              </figure>
            )}

            <div className="mt-6 grid gap-5 sm:grid-cols-2 sm:gap-8">
              <section aria-labelledby="reading-thread">
                <h2 id="reading-thread" className={title}>
                  {copy.interpret.threadTitle}
                </h2>
                <p className="mt-2 text-base leading-relaxed text-ink/80" data-testid="reading-thread">
                  {blocks.thread}
                </p>
              </section>
              <section aria-labelledby="reading-direction">
                <h2 id="reading-direction" className={title}>
                  {copy.interpret.directionTitle}
                </h2>
                <p className="mt-2 text-base leading-relaxed text-ink/80" data-testid="reading-direction">
                  {blocks.direction}
                </p>
              </section>
            </div>

            <section aria-labelledby="reading-outlook" className="mt-6 rounded-2xl border border-border bg-surface-active px-5 py-4">
              <h2 id="reading-outlook" className={title}>
                {copy.interpret.outlookTitle}
              </h2>
              <p className="mt-2 font-serif text-lg leading-snug text-ink" data-testid="reading-outlook">
                {copy.interpret.outlook}
              </p>
            </section>
            {written && (
              <p className="mt-2 text-xs text-ink/70" data-testid="reading-ai-note">
                {copy.interpret.aiNote}
              </p>
            )}
          </article>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              aria-expanded={open}
              aria-controls="profile-more"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-paper px-4 text-sm font-semibold text-ink transition-colors hover:border-walnut-light"
            >
              {copy.moreTitle}
              <span aria-hidden="true" className={cn("transition-transform", open && "rotate-180")}>
                ▾
              </span>
            </button>
            <button
              type="button"
              onClick={onToggleAdjust}
              aria-pressed={adjusting}
              className="min-h-11 rounded-full border border-border bg-paper px-5 text-sm font-semibold text-ink transition-colors hover:border-walnut-light"
            >
              {adjusting ? copy.adjustDone : copy.adjust}
            </button>
          </div>

          <div id="profile-more" className={cn("mt-5 space-y-6", open ? "block" : "hidden")}>
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
                        {override[axis] !== undefined && <span className="text-xs text-gold-text">{text}</span>}
                      </label>
                      <div className="mt-1 flex items-center gap-3 text-xs text-ink/70">
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

          <section className="mt-8" aria-labelledby="profile-miss">
            <h2 id="profile-miss" className="font-semibold text-ink">
              {missTitle}
            </h2>
            <p className="mt-1 text-sm text-ink/70">{copy.missSub}</p>
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
              className="mt-3 w-full rounded-lg border border-border bg-paper px-4 py-3 leading-relaxed text-ink outline-none placeholder:text-ink/70 focus:border-ink"
            />
          </section>
        </div>
      </div>
      {notes}
      {orderCue && (
        <a
          href="#bestellen"
          data-testid="order-cue"
          className="mt-12 flex min-h-11 flex-col items-center gap-1 rounded-xl px-4 py-3 text-center text-ink outline-none transition-colors hover:bg-surface-active focus-visible:ring-[3px] focus-visible:ring-gold/60"
        >
          <span className="font-serif text-xl leading-snug sm:text-2xl">{orderCue}</span>
          <svg className="scroll-cue h-6 w-6 text-accent-dark" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </a>
      )}
      <div className={orderCue ? "mt-4" : "mt-12"}>{payment}</div>
    </div>
  );
}
