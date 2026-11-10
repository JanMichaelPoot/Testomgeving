"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import FRAME from "@/lib/heroWindowFrame.json";
import type { WindowItem } from "@/lib/windowLayout";

// The window on the landing page, seen from INSIDE the room looking out. The frame is a photograph (one Gemini picture, made once by
// scripts/generate-hero-window-photo.ts: a deep-set walnut sash window with a moulded architrave, plaster reveal and sill; its glass was
// flat chroma green, which scripts/process-hero-window-photo.ts cut out as transparent glass and measured, see heroWindowFrame.json).
// The library images sit behind that glass, in the measured pane rectangles, so they show through a real photographed frame.
//
// Every pane shows a real image of the association library, as the world outside. They open one after the other on arrival, and after that
// one pane at a time swaps for a spare image. The pictures sit a little behind the glass: they move a few pixels against the frame with the
// pointer and the scroll. Without script the page is complete (all eight images are in the markup); with reduced motion nothing animates,
// swaps or moves. The edge of the photographed wall fades into the wall of the hero section, so there is no card around the window.

const SWAP_EVERY_MS = 3400;
const FIRST_SWAP_AFTER_MS = 4200;
const FADE_MS = 1100;
const PANE_SIZES = "(min-width: 1024px) 200px, (min-width: 640px) 170px, 130px";

const pct = (v: number) => `${(v * 100).toFixed(3)}%`;

// What a pane shows until its image has arrived: a soft sand colour, a little different from pane to pane, like frosted glass.
const PANE_TONES = [
  "linear-gradient(160deg, #ece2d1, #d9cbb5)",
  "linear-gradient(160deg, #e7e1d4, #d3c9b7)",
  "linear-gradient(160deg, #eadfce, #d6c7b0)",
  "linear-gradient(160deg, #e9e3d6, #d5cab8)",
];

// The photographed plaster wall around the window fades out at its edges into the wall of the hero section.
const EDGE_FADE =
  "linear-gradient(to right, transparent 0%, #000 8%, #000 92%, transparent 100%), linear-gradient(to bottom, transparent 0%, #000 6%, #000 92%, transparent 100%)";

type Slot = { cur: WindowItem; prev: WindowItem | null };

// A picture that has not arrived by the time the page is hydrated fades in when it does (hero-pane-img in globals.css). Done with a
// data attribute and no state, and only after hydration: without script every image simply shows as soon as the browser has it.
function PaneImage({ item, priority }: { item: WindowItem; priority: boolean }) {
  return (
    <Image
      ref={(el) => {
        if (el && !el.complete) el.dataset.pending = "1";
      }}
      onLoad={(e) => e.currentTarget.removeAttribute("data-pending")}
      src={item.image!}
      alt={item.label}
      fill
      priority={priority}
      sizes={PANE_SIZES}
      className="hero-pane-img object-cover"
    />
  );
}

export function HeroWindow({ items, spare, title }: { items: readonly WindowItem[]; spare: readonly WindowItem[]; title: string }) {
  const panes = FRAME.panes;
  const [slots, setSlots] = useState<Slot[]>(() => panes.map((_, i) => ({ cur: items[i % items.length], prev: null })));
  const queue = useRef<WindowItem[]>([...spare]);
  const tick = useRef(0);
  const figureRef = useRef<HTMLElement>(null);

  // One pane at a time swaps for the next spare image, scattered over the window (a step of 3 visits all eight panes before repeating).
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let interval: ReturnType<typeof setInterval> | undefined;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const swap = () => {
      if (document.hidden || queue.current.length === 0) return;
      const at = (tick.current * 3) % panes.length;
      tick.current += 1;
      const next = queue.current.shift()!;
      setSlots((prev) => {
        const copy = [...prev];
        queue.current.push(copy[at].cur);
        copy[at] = { cur: next, prev: copy[at].cur };
        return copy;
      });
      timers.push(setTimeout(() => setSlots((prev) => prev.map((s, i) => (i === at ? { ...s, prev: null } : s))), FADE_MS));
    };
    const start = setTimeout(() => {
      swap();
      interval = setInterval(swap, SWAP_EVERY_MS);
    }, FIRST_SWAP_AFTER_MS);
    return () => {
      clearTimeout(start);
      if (interval) clearInterval(interval);
      timers.forEach(clearTimeout);
    };
    // The eight panes never change while the page is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The world outside is a little behind the glass: the pictures move a few pixels against the frame with the pointer (computers) and the
  // scroll (everything). Two CSS variables on the figure, written through requestAnimationFrame; the CSS does the rest (globals.css).
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = figureRef.current;
    if (!el) return;
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    let frame = 0;
    let px = 0;
    let py = 0;
    const apply = () => {
      frame = 0;
      const rect = el.getBoundingClientRect();
      const scroll = Math.max(-1, Math.min(1, (rect.top + rect.height / 2 - window.innerHeight / 2) / window.innerHeight));
      el.style.setProperty("--hx", px.toFixed(3));
      el.style.setProperty("--hy", Math.max(-1, Math.min(1, py * 0.6 + scroll)).toFixed(3));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(apply);
    };
    const onMove = (e: PointerEvent) => {
      px = (e.clientX / window.innerWidth - 0.5) * 2;
      py = (e.clientY / window.innerHeight - 0.5) * 2;
      schedule();
    };
    window.addEventListener("scroll", schedule, { passive: true });
    if (finePointer) window.addEventListener("pointermove", onMove, { passive: true });
    schedule();
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("pointermove", onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  // The whole glass, for the reflection that lies across all eight panes.
  const gx0 = Math.min(...panes.map((p) => p.x));
  const gy0 = Math.min(...panes.map((p) => p.y));
  const gx1 = Math.max(...panes.map((p) => p.x + p.w));
  const gy1 = Math.max(...panes.map((p) => p.y + p.h));

  return (
    <figure ref={figureRef} className="relative m-0 w-full" aria-label={title} style={{ aspectRatio: `${FRAME.aspect}` }}>
      {/* The world outside, behind the glass. */}
      {panes.map((rect, i) => {
        const slot = slots[i];
        return (
          <div
            key={i}
            className="window-pane-open absolute overflow-hidden"
            style={{
              left: pct(rect.x),
              top: pct(rect.y),
              width: pct(rect.w),
              height: pct(rect.h),
              background: PANE_TONES[i % PANE_TONES.length],
              animationDelay: `${i * 140}ms`,
            }}
          >
            <div className="hero-pane-parallax absolute inset-0">
              {slot.prev && <PaneImage item={slot.prev} priority={false} />}
              <div key={slot.cur.id} className={slot.prev ? "hero-pane-swap absolute inset-0" : "absolute inset-0"}>
                <PaneImage item={slot.cur} priority={i < 4} />
              </div>
            </div>
          </div>
        );
      })}

      {/* The photographed frame, with transparent glass. Its wall fades out at the edges. */}
      <Image
        src="/illustrations/hero-window/frame.webp"
        alt=""
        aria-hidden="true"
        fill
        priority
        sizes="(min-width: 1024px) 640px, (min-width: 640px) 420px, 300px"
        className="pointer-events-none select-none object-cover"
        style={{ maskImage: EDGE_FADE, WebkitMaskImage: EDGE_FADE, maskComposite: "intersect", WebkitMaskComposite: "source-in" }}
      />

      {/* The glass: each pane sits a little deep behind the frame (a soft shade at the top and the left, a touch of daylight at the edges)
          and one reflection lies across all of it. */}
      {panes.map((rect, i) => (
        <div
          key={`g${i}`}
          aria-hidden="true"
          className="pointer-events-none absolute shadow-[inset_0_5px_8px_rgba(20,12,6,0.42),inset_4px_0_7px_rgba(20,12,6,0.22),inset_0_0_14px_rgba(255,246,228,0.2)]"
          style={{ left: pct(rect.x), top: pct(rect.y), width: pct(rect.w), height: pct(rect.h) }}
        />
      ))}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bg-[linear-gradient(115deg,rgba(255,255,255,0.26)_0%,rgba(255,255,255,0.05)_30%,rgba(255,255,255,0)_42%,rgba(255,255,255,0.14)_50%,rgba(255,255,255,0)_55%,rgba(255,255,255,0.09)_70%,rgba(255,255,255,0)_74%,rgba(255,255,255,0)_100%)]"
        style={{ left: pct(gx0), top: pct(gy0), width: pct(gx1 - gx0), height: pct(gy1 - gy0) }}
      />

      {/* The spare images wait, invisible, so a swap shows a picture that has already arrived. */}
      <div aria-hidden="true" className="pointer-events-none absolute size-px overflow-hidden opacity-0">
        {spare.map((s) => (
          <div key={s.id} className="relative size-px">
            <Image src={s.image!} alt="" fill sizes={PANE_SIZES} loading="lazy" fetchPriority="low" />
          </div>
        ))}
      </div>
    </figure>
  );
}
