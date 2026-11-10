"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { heroLayout } from "@/lib/heroWindow";
import { CASING, GEO, HEAD, REVEAL, SASH_H, SASH_W, SILL_DEPTH, SILL_FRONT } from "@/lib/heroWindowGeometry";
import { paneBox, type WindowItem } from "@/lib/windowLayout";

// The window on the landing page, seen from INSIDE the room looking out: the app's own sash window (layoutWindow, style "schuifraam":
// two sashes of 2 x 2 panes) set in a deep recess of the wall, with a walnut architrave around the opening and a walnut sill that
// sticks out into the room, the light of the window lying on its top face. The wall itself is the hero section's background
// (VensterHero), so there is no card around the window.
//
// The materials are photographs made once (public/illustrations/hero-window: dark-stained oak, limewashed plaster, see
// scripts/generate-hero-window-textures.ts); the geometry, the bevels, the recess, the sill and the light are CSS on top. Everything is
// placed in one coordinate system (GEO, in "units": the sash is 100 wide), so the casing, the recess and the sill always fit the panes.
//
// Every pane shows a real image of the association library, as the world outside. They open one after the other on arrival, one swings
// open a little once, and after that one pane at a time swaps for a spare image. The pictures sit a little behind the glass: they move a
// few pixels against the frame with the pointer and the scroll. Without script the page is complete (all eight images are in the
// markup); with reduced motion nothing animates, swings, swaps or moves.

const TEXTURES = {
  oak: "url(/illustrations/hero-window/oak.jpg)",
  oakH: "url(/illustrations/hero-window/oak-h.jpg)",
  wall: "url(/illustrations/hero-window/wall.jpg)",
  moulding: "url(/illustrations/hero-window/moulding.jpg)",
  mouldingV: "url(/illustrations/hero-window/moulding-v.jpg)",
  sill: "url(/illustrations/hero-window/sill.jpg)",
};

const SWAP_EVERY_MS = 3400;
const FIRST_SWAP_AFTER_MS = 4200;
const FADE_MS = 1100;
const PANE_SIZES = "(min-width: 1024px) 260px, (min-width: 640px) 200px, 150px";

/** Light on the top edge, shadow on the bottom edge: the profile of a horizontal bar. */
const BEVEL_H = "shadow-[inset_0_1px_0_rgba(255,235,205,0.22),inset_0_-1px_0_rgba(0,0,0,0.55)]";
/** The same for a vertical bar. */
const BEVEL_V = "shadow-[inset_1px_0_0_rgba(255,235,205,0.22),inset_-1px_0_0_rgba(0,0,0,0.55)]";

const pct = (v: number, total: number) => `${((v / total) * 100).toFixed(3)}%`;
/** A box in units as a percentage box of the figure. */
const place = (x: number, y: number, w: number, h: number) => ({ left: pct(x, GEO.W), top: pct(y, GEO.H), width: pct(w, GEO.W), height: pct(h, GEO.H) });
/** A polygon in units as a clip-path relative to its own box. */
const polygon = (box: { x: number; y: number; w: number; h: number }, points: [number, number][]) =>
  `polygon(${points.map(([x, y]) => `${pct(x - box.x, box.w)} ${pct(y - box.y, box.h)}`).join(", ")})`;

type Slot = { cur: WindowItem; prev: WindowItem | null };

// What a pane shows until its image has arrived: a soft sand colour, a little different from pane to pane, like frosted glass.
const PANE_TONES = [
  "linear-gradient(160deg, #ece2d1, #d9cbb5)",
  "linear-gradient(160deg, #e7e1d4, #d3c9b7)",
  "linear-gradient(160deg, #eadfce, #d6c7b0)",
  "linear-gradient(160deg, #e9e3d6, #d5cab8)",
];
/** What shows behind the pane that swings open: the bright outside. */
const OUTSIDE = "linear-gradient(180deg, #fff9ec, #f7e8cd)";

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
  const layout = heroLayout(items);
  const glass = layout.glass;
  const [slots, setSlots] = useState<Slot[]>(() => layout.panes.map((rect) => ({ cur: layout.shown[rect.item!], prev: null })));
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
  // The meeting rail is the bar between the two middle rows; the latch sits in the middle of it.
  const meeting = horizontal[Math.floor(horizontal.length / 2)];
  // The pane that swings open once: the top one of the right column.
  const swingSlot = layout.panes.reduce((best, p) => (p.x > best.x || (p.x === best.x && p.y < best.y) ? p : best), layout.panes[0]).slot;

  // Parts of the room, in units.
  const casingLeft = { x: 6, y: HEAD, w: CASING, h: GEO.wallY - HEAD };
  const casingRight = { x: 6 + CASING + 2 * REVEAL + SASH_W, y: HEAD, w: CASING, h: GEO.wallY - HEAD };
  const head = { x: 3, y: 0, w: 134, h: HEAD };
  const reveal = { x: 6 + CASING, y: HEAD, w: SASH_W + 2 * REVEAL, h: GEO.wallY - HEAD };
  const rx0 = reveal.x;
  const rx1 = reveal.x + reveal.w;
  const sx0 = GEO.sashX;
  const sx1 = GEO.sashX + SASH_W;
  const sill = { x: 2, y: GEO.backY, w: 136, h: SILL_DEPTH };

  return (
    <figure ref={figureRef} className="relative m-0 w-full" aria-label={title} style={{ aspectRatio: `${GEO.W} / ${GEO.H}` }}>
      {/* The recess: the thickness of the wall, seen on three sides. The right side catches the light of the window, the left side is in
          shade, the top is darkest; all of it limewashed plaster. */}
      {(
        [
          { key: "top", pts: [[rx0, HEAD], [rx1, HEAD], [sx1, GEO.sashY], [sx0, GEO.sashY]], shade: "linear-gradient(180deg, rgba(70,42,20,0.6), rgba(70,42,20,0.2))" },
          { key: "left", pts: [[rx0, HEAD], [sx0, GEO.sashY], [sx0, GEO.backY], [rx0, GEO.wallY]], shade: "linear-gradient(90deg, rgba(70,42,20,0.46), rgba(70,42,20,0.14))" },
          { key: "right", pts: [[rx1, HEAD], [sx1, GEO.sashY], [sx1, GEO.backY], [rx1, GEO.wallY]], shade: "linear-gradient(270deg, rgba(70,42,20,0.16), rgba(255,240,208,0.32))" },
        ] as { key: string; pts: [number, number][]; shade: string }[]
      ).map((side) => (
        <div
          key={side.key}
          aria-hidden="true"
          className="absolute"
          style={{
            ...place(reveal.x, reveal.y, reveal.w, reveal.h),
            clipPath: polygon(reveal, side.pts),
            backgroundColor: "#e4d8c4",
            backgroundImage: `${side.shade}, ${TEXTURES.wall}`,
            backgroundSize: "100% 100%, cover",
          }}
        />
      ))}

      {/* The architrave: a head board that overhangs a little and two side boards, walnut, standing on the wall around the opening. */}
      {[casingLeft, casingRight].map((b, i) => (
        <div
          key={i}
          aria-hidden="true"
          className={`absolute shadow-[7px_9px_14px_-6px_rgba(40,25,15,0.5),inset_0_0_0_1px_rgba(0,0,0,0.5),inset_2px_0_0_rgba(255,235,205,0.14)]`}
          style={{ ...place(b.x, b.y, b.w, b.h), backgroundColor: "#3c2920", backgroundImage: TEXTURES.mouldingV, backgroundSize: "100% 100%" }}
        />
      ))}
      <div
        aria-hidden="true"
        className={`absolute shadow-[0_10px_14px_-5px_rgba(40,25,15,0.55),inset_0_0_0_1px_rgba(0,0,0,0.5)] ${BEVEL_H}`}
        style={{ ...place(head.x, head.y, head.w, head.h), backgroundColor: "#3c2920", backgroundImage: TEXTURES.moulding, backgroundSize: "100% 100%" }}
      />

      {/* The sash frame, set into the recess: walnut, with the panes, the reflection and the latch. */}
      <div
        className="absolute shadow-[0_0_0_2px_rgba(0,0,0,0.5),inset_1px_1px_0_rgba(255,235,205,0.22),inset_-1px_-1px_0_rgba(0,0,0,0.55)]"
        style={{ ...place(GEO.sashX, GEO.sashY, SASH_W, SASH_H), backgroundColor: "#3c2920", backgroundImage: TEXTURES.oak, backgroundSize: "170% auto", backgroundPosition: "70% 0" }}
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
          const swings = rect.slot === swingSlot;
          return (
            <div
              key={rect.slot}
              className="window-pane-open absolute overflow-hidden"
              style={{
                ...paneBox(layout, rect),
                background: swings ? OUTSIDE : PANE_TONES[rect.slot % PANE_TONES.length],
                perspective: "700px",
                animationDelay: `${rect.slot * 140}ms`,
              }}
            >
              <div className={swings ? "hero-pane-leaf hero-pane-leaf--swing absolute inset-0" : "hero-pane-leaf absolute inset-0"}>
                <div className="hero-pane-parallax absolute inset-0">
                  {slot.prev && <PaneImage item={slot.prev} priority={false} />}
                  <div key={slot.cur.id} className={slot.prev ? "hero-pane-swap absolute inset-0" : "absolute inset-0"}>
                    <PaneImage item={slot.cur} priority={i < 4} />
                  </div>
                </div>
                {swings && <div aria-hidden="true" className="hero-pane-swing-shade absolute inset-0 bg-[#1f140b]" />}
              </div>
            </div>
          );
        })}

        {/* The frame shades the glass a little at the top and the left, and the daylight is a touch bright at the edges of each pane. */}
        {layout.panes.map((rect) => (
          <div
            key={`s${rect.slot}`}
            aria-hidden="true"
            className="pointer-events-none absolute shadow-[inset_0_4px_6px_rgba(20,12,6,0.5),inset_3px_0_5px_rgba(20,12,6,0.26),inset_0_0_14px_rgba(255,246,228,0.22)]"
            style={paneBox(layout, rect)}
          />
        ))}

        {/* The reflection across the whole glass: a soft diagonal sheen and two thin streaks. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bg-[linear-gradient(115deg,rgba(255,255,255,0.3)_0%,rgba(255,255,255,0.06)_30%,rgba(255,255,255,0)_42%,rgba(255,255,255,0.16)_50%,rgba(255,255,255,0)_55%,rgba(255,255,255,0.1)_70%,rgba(255,255,255,0)_74%,rgba(255,255,255,0)_100%)]"
          style={box(glass.x, glass.y, glass.w, glass.h)}
        />

        {/* The latch on the meeting rail: a small brass cam. */}
        <div
          aria-hidden="true"
          className="absolute rounded-[2px] shadow-[0_1px_2px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,244,214,0.7)]"
          style={{
            left: pct(layout.width / 2 - 14, layout.width),
            top: pct(meeting.y + meeting.h / 2 - 5, layout.height),
            width: pct(28, layout.width),
            height: pct(10, layout.height),
            background: "linear-gradient(180deg, #e2c987 0%, #b08a4a 45%, #7e5f27 100%)",
          }}
        />
      </div>

      {/* The sill: a walnut board that sticks out into the room. Its top face is seen from above, wider in front than at the window,
          with the light of the window lying on it: bright in the middle, shaded at the sides, the centre stile of the sash as a soft bar. */}
      <div
        aria-hidden="true"
        className="absolute"
        style={{
          ...place(sill.x, sill.y, sill.w, sill.h),
          clipPath: polygon(sill, [[sx0, GEO.backY], [sx1, GEO.backY], [sill.x + sill.w, GEO.frontY], [sill.x, GEO.frontY]]),
          backgroundColor: "#5a4030",
          backgroundImage: [
            "linear-gradient(90deg, transparent 47.2%, rgba(35,22,12,0.22) 49.3%, rgba(35,22,12,0.22) 50.7%, transparent 52.8%)",
            "linear-gradient(90deg, rgba(20,12,6,0.42) 0%, rgba(20,12,6,0) 16%, rgba(255,238,204,0.16) 32%, rgba(255,238,204,0.16) 68%, rgba(20,12,6,0) 84%, rgba(20,12,6,0.36) 100%)",
            "linear-gradient(180deg, rgba(255,240,210,0.2), rgba(20,12,6,0.16))",
            TEXTURES.sill,
          ].join(", "),
          backgroundSize: "100% 100%, 100% 100%, 100% 100%, 100% 100%",
          backgroundPosition: "0 0, 0 0, 0 0, 0 0",
        }}
      />
      <div
        aria-hidden="true"
        className="absolute shadow-[0_16px_20px_-8px_rgba(40,25,15,0.6),inset_0_1px_0_rgba(255,235,205,0.3),inset_0_-1px_0_rgba(0,0,0,0.5)]"
        style={{
          ...place(0, GEO.frontY, GEO.W, SILL_FRONT),
          backgroundColor: "#3c2920",
          backgroundImage: `linear-gradient(180deg, rgba(255,235,200,0.3) 0%, rgba(255,235,200,0) 28%, rgba(0,0,0,0) 62%, rgba(0,0,0,0.34) 100%), ${TEXTURES.moulding}`,
          backgroundSize: "100% 100%, 100% 100%",
          backgroundPosition: "0 0, 0 0",
          borderRadius: "1.5px",
        }}
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
