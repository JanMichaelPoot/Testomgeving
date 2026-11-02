"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { heroLayout } from "@/lib/heroWindow";
import { paneBox, type WindowItem } from "@/lib/windowLayout";

// The window on the landing page: the app's own sash window (layoutWindow, style "schuifraam": two sashes of 2 x 2 panes),
// built to look like one you could touch. The materials are photographs made once (public/illustrations/hero-window:
// dark-stained oak, limewashed plaster, honed limestone, see scripts/generate-hero-window-textures.ts); the geometry, the
// bevels, the recess of the glass, the reflection and the light are CSS on top, so the frame always fits its panes exactly.
//
// Every pane shows a real image of the association library. They open one after the other on arrival, and after that one
// pane at a time swaps for a spare image. Without script the page is complete (all eight images are in the markup); with
// reduced motion nothing animates or swaps.

const TEXTURES = {
  oak: "url(/illustrations/hero-window/oak.jpg)",
  oakH: "url(/illustrations/hero-window/oak-h.jpg)",
  plaster: "url(/illustrations/hero-window/plaster.jpg)",
  stone: "url(/illustrations/hero-window/stone.jpg)",
};

const SWAP_EVERY_MS = 3400;
const FIRST_SWAP_AFTER_MS = 4200;
const FADE_MS = 1100;
const PANE_SIZES = "(min-width: 1024px) 260px, (min-width: 640px) 200px, 150px";

/** Light on the top edge, shadow on the bottom edge: the profile of a horizontal bar. */
const BEVEL_H = "shadow-[inset_0_1px_0_rgba(255,235,205,0.22),inset_0_-1px_0_rgba(0,0,0,0.55)]";
/** The same for a vertical bar. */
const BEVEL_V = "shadow-[inset_1px_0_0_rgba(255,235,205,0.22),inset_-1px_0_0_rgba(0,0,0,0.55)]";

type Slot = { cur: WindowItem; prev: WindowItem | null };

function PaneImage({ item, priority }: { item: WindowItem; priority: boolean }) {
  return <Image src={item.image!} alt={item.label} fill priority={priority} sizes={PANE_SIZES} className="object-cover" />;
}

function StoneSlab({ className, shadow }: { className: string; shadow: string }) {
  return (
    <div
      aria-hidden="true"
      className={`relative z-10 w-[112%] -ml-[6%] rounded-[2px] ${className} ${shadow}`}
      style={{ backgroundColor: "#cfc7b8", backgroundImage: TEXTURES.stone, backgroundSize: "cover" }}
    >
      {/* A slab, not a roll: a thin lit edge on top, an even face, and a darker lower edge. */}
      <div className="absolute inset-x-0 top-0 h-[22%] bg-[linear-gradient(180deg,rgba(255,255,255,0.42),rgba(255,255,255,0))]" />
      <div className="absolute inset-x-0 bottom-0 h-[28%] bg-[linear-gradient(180deg,rgba(60,41,32,0),rgba(60,41,32,0.34))]" />
      <div className="absolute inset-0 rounded-[2px] shadow-[inset_0_1px_0_rgba(255,255,255,0.5),inset_0_-1px_0_rgba(60,41,32,0.5)]" />
    </div>
  );
}

export function HeroWindow({ items, spare, title }: { items: readonly WindowItem[]; spare: readonly WindowItem[]; title: string }) {
  const layout = heroLayout(items);
  const glass = layout.glass;
  const [slots, setSlots] = useState<Slot[]>(() => layout.panes.map((rect) => ({ cur: layout.shown[rect.item!], prev: null })));
  const queue = useRef<WindowItem[]>([...spare]);
  const tick = useRef(0);

  // One pane at a time swaps for the next spare image, scattered over the window (a step of 3 visits all eight panes before repeating).
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let interval: ReturnType<typeof setInterval> | undefined;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const swap = () => {
      if (document.hidden || queue.current.length === 0) return;
      const at = (tick.current * 3) % layout.panes.length;
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
    // The layout of eight panes never changes while the page is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pct = (v: number, total: number) => `${((v / total) * 100).toFixed(3)}%`;
  const box = (x: number, y: number, w: number, h: number) => ({ left: pct(x, layout.width), top: pct(y, layout.height), width: pct(w, layout.width), height: pct(h, layout.height) });

  // The bars of the sash: the meeting rail and the glazing bars between the rows (grain along them), the centre stile between the
  // columns, and the head and foot. Drawn a little thicker than the gaps of the layout so they read as timber, centred on the gap.
  const rows = [...new Set(layout.panes.map((p) => p.y))].sort((a, b) => a - b).map((y) => layout.panes.find((p) => p.y === y)!);
  const cols = [...new Set(layout.panes.map((p) => p.x))].sort((a, b) => a - b).map((x) => layout.panes.find((p) => p.x === x)!);
  const centred = (from: number, to: number, min: number) => {
    const gap = to - from;
    const t = Math.max(gap, min);
    return { at: from + gap / 2 - t / 2, t };
  };
  const horizontal = [
    { x: glass.x, y: 0, w: glass.w, h: glass.y },
    ...rows.slice(0, -1).map((r, i) => {
      const gap = rows[i + 1].y - (r.y + r.h);
      const { at, t } = centred(r.y + r.h, rows[i + 1].y, gap > 5 ? gap + 3 : 5);
      return { x: glass.x, y: at, w: glass.w, h: t };
    }),
    { x: glass.x, y: glass.y + glass.h, w: glass.w, h: layout.height - (glass.y + glass.h) },
  ];
  const vertical = cols.slice(0, -1).map((c, i) => {
    const { at, t } = centred(c.x + c.w, cols[i + 1].x, 7);
    return { x: at, y: glass.y, w: t, h: glass.h };
  });

  return (
    <figure className="relative m-0 w-full" aria-label={title}>
      {/* The wall: limewashed plaster, lit from the upper left, darker towards the edges. */}
      <div
        className="relative overflow-hidden rounded-[10px] px-[9%] pt-[7%] pb-[7%] shadow-[0_40px_70px_-40px_rgba(60,41,32,0.65)]"
        style={{ backgroundColor: "#e4d8c4", backgroundImage: TEXTURES.plaster, backgroundSize: "cover" }}
      >
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-cream/35" />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(90%_65%_at_18%_0%,rgba(255,244,222,0.6),transparent_70%),radial-gradient(130%_100%_at_50%_45%,transparent_52%,rgba(60,41,32,0.32)_100%)]"
        />

        <div className="relative">
          {/* The lintel: a stone head over the window, a little wider, with its shadow below. */}
          <StoneSlab className="mb-[-0.6%] aspect-[112/9]" shadow="shadow-[0_14px_18px_-6px_rgba(50,35,22,0.55)]" />

          {/* The casing: thick oak around the sash window, grain along each side. */}
          <div
            className="relative p-[4.5%] shadow-[14px_18px_30px_-8px_rgba(50,35,22,0.55),inset_0_0_0_1px_rgba(0,0,0,0.55),inset_2px_2px_0_rgba(255,235,205,0.18)]"
            style={{ backgroundColor: "#3c2920", backgroundImage: TEXTURES.oak, backgroundSize: "150% auto", backgroundPosition: "20% 0" }}
          >
            {(["top", "bottom"] as const).map((side) => (
              <div
                key={side}
                aria-hidden="true"
                className={`absolute inset-x-0 ${side === "top" ? "top-0" : "bottom-0"} ${BEVEL_H}`}
                style={{ paddingBottom: "4.5%", backgroundImage: TEXTURES.oakH, backgroundSize: "110% auto", backgroundPosition: side === "top" ? "0 10%" : "60% 70%" }}
              />
            ))}

            {/* The sash frame: oak, set into the casing. */}
            <div
              className="relative aspect-[3/4] w-full shadow-[0_0_0_2px_rgba(0,0,0,0.5),inset_1px_1px_0_rgba(255,235,205,0.22),inset_-1px_-1px_0_rgba(0,0,0,0.55)]"
              style={{ backgroundColor: "#3c2920", backgroundImage: TEXTURES.oak, backgroundSize: "170% auto", backgroundPosition: "70% 0" }}
            >
              {vertical.map((b, i) => (
                <div
                  key={`v${i}`}
                  aria-hidden="true"
                  className={`absolute ${BEVEL_V}`}
                  style={{ ...box(b.x, b.y, b.w, b.h), backgroundImage: TEXTURES.oak, backgroundSize: "400% auto", backgroundPosition: `${20 + i * 30}% 0` }}
                />
              ))}
              {horizontal.map((b, i) => (
                <div
                  key={`h${i}`}
                  aria-hidden="true"
                  className={`absolute ${BEVEL_H}`}
                  style={{ ...box(b.x, b.y, b.w, b.h), backgroundImage: TEXTURES.oakH, backgroundSize: "130% auto", backgroundPosition: `${(i * 37) % 80}% ${(i * 53) % 90}%` }}
                />
              ))}

              {layout.panes.map((rect, i) => {
                const slot = slots[i];
                return (
                  <div
                    key={rect.slot}
                    className="window-pane-open absolute overflow-hidden bg-cream"
                    style={{ ...paneBox(layout, rect), animationDelay: `${rect.slot * 140}ms` }}
                  >
                    {slot.prev && <PaneImage item={slot.prev} priority={false} />}
                    <div key={slot.cur.id} className={slot.prev ? "hero-pane-swap absolute inset-0" : "absolute inset-0"}>
                      <PaneImage item={slot.cur} priority={i < 4} />
                    </div>
                  </div>
                );
              })}

              {/* The glass is set back into the frame: darker towards the bars, with the deepest shadow under the top bar and along the left. */}
              {layout.panes.map((rect) => (
                <div
                  key={`s${rect.slot}`}
                  aria-hidden="true"
                  className="pointer-events-none absolute shadow-[inset_0_6px_10px_rgba(20,12,6,0.6),inset_5px_0_8px_rgba(20,12,6,0.38),inset_0_0_16px_rgba(20,12,6,0.32),inset_-1px_-2px_3px_rgba(20,12,6,0.3)]"
                  style={paneBox(layout, rect)}
                />
              ))}

              {/* The reflection across the whole glass: a soft diagonal sheen and two thin streaks. */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute bg-[linear-gradient(115deg,rgba(255,255,255,0.3)_0%,rgba(255,255,255,0.06)_30%,rgba(255,255,255,0)_42%,rgba(255,255,255,0.16)_50%,rgba(255,255,255,0)_55%,rgba(255,255,255,0.1)_70%,rgba(255,255,255,0)_74%,rgba(255,255,255,0)_100%)]"
                style={box(glass.x, glass.y, glass.w, glass.h)}
              />
            </div>
          </div>

          {/* The sill: honed limestone, wider than the window, with the light of the window on its top face. */}
          <StoneSlab className="-mt-px aspect-[112/12]" shadow="shadow-[0_18px_22px_-8px_rgba(50,35,22,0.65)]" />
        </div>
      </div>

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
