"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { trackEvent } from "@/lib/posthog/client";

// Three pages of the sample book as pictures, each opening in a lightbox (a native <dialog>: focus trap, Escape, inert background and
// focus back to the opening button come with it). Arrow keys and the two buttons move between the pages.
export interface Spread {
  src: string;
  alt: string;
  name: string;
}

export interface SampleLabels {
  open: string;
  close: string;
  previous: string;
  next: string;
  counter: string; // {n} {total}
}

const WIDTH = 1000;
const HEIGHT = 1415;

const LIGHTBOX_BUTTON =
  "inline-flex min-h-11 items-center rounded-lg border border-white/40 px-4 text-sm font-semibold text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-gold-light";

export function SampleSpreads({ spreads, labels }: { spreads: Spread[]; labels: SampleLabels }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (openIndex !== null && !el.open) el.showModal();
    if (openIndex === null && el.open) el.close();
  }, [openIndex]);

  useEffect(() => {
    if (openIndex === null) return;
    const previous = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = previous;
    };
  }, [openIndex]);

  const total = spreads.length;
  const step = (delta: number) => setOpenIndex((i) => (i === null ? i : (i + delta + total) % total));

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      step(1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      step(-1);
    }
  }

  const current = openIndex === null ? null : spreads[openIndex];

  return (
    <>
      <ul className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-6 sm:overflow-visible sm:px-0">
        {spreads.map((spread, i) => (
          <li key={spread.src} className="w-[72%] shrink-0 snap-center sm:w-auto">
            <button
              type="button"
              onClick={() => {
                setOpenIndex(i);
                trackEvent("sample_opened", { index: i });
              }}
              aria-label={`${labels.open}: ${spread.name}`}
              className="group block w-full overflow-hidden rounded-lg border border-border bg-paper text-left shadow-[0_24px_48px_-32px_rgba(60,41,32,0.5)] transition hover:border-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-gold/60"
            >
              <Image
                src={spread.src}
                alt={spread.alt}
                width={WIDTH}
                height={HEIGHT}
                sizes="(min-width: 1024px) 300px, (min-width: 640px) 30vw, 72vw"
                className="h-auto w-full transition-transform duration-300 group-hover:scale-[1.02]"
              />
            </button>
            <p className="mt-2 text-center text-xs font-medium uppercase tracking-[0.1em] text-ink/70">{spread.name}</p>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialog}
        aria-label={current ? current.name : undefined}
        onClose={() => setOpenIndex(null)}
        onKeyDown={onKeyDown}
        onClick={(event) => {
          if (event.target === dialog.current) setOpenIndex(null);
        }}
        className="m-auto max-h-[96dvh] w-[calc(100%-1rem)] max-w-3xl overflow-visible bg-transparent p-0 backdrop:bg-ink/75"
      >
        {current && openIndex !== null && (
          <div className="flex flex-col items-center gap-3">
            <div className="flex w-full items-center justify-between gap-3 text-white">
              <p className="text-sm" aria-live="polite">
                {labels.counter.replace("{n}", String(openIndex + 1)).replace("{total}", String(total))}
              </p>
              <button type="button" onClick={() => setOpenIndex(null)} className={LIGHTBOX_BUTTON}>
                {labels.close}
              </button>
            </div>
            <Image
              src={current.src}
              alt={current.alt}
              width={WIDTH}
              height={HEIGHT}
              sizes="(min-width: 768px) 640px, 96vw"
              className="max-h-[78dvh] w-auto max-w-full rounded-lg bg-paper object-contain"
              priority
            />
            <div className="flex w-full items-center justify-between gap-3">
              <button type="button" onClick={() => step(-1)} className={LIGHTBOX_BUTTON}>
                {labels.previous}
              </button>
              <button type="button" onClick={() => step(1)} className={LIGHTBOX_BUTTON}>
                {labels.next}
              </button>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
