import Image from "next/image";
import { cn } from "@/lib/utils";
import { layoutWindow, paneBox, type WindowItem, type WindowKind, type WindowLayout } from "@/lib/windowLayout";

// The window as the thread through the whole product: a walnut frame with a sill, mullions and a pane for every image
// the person chose. The shape comes from src/lib/windowLayout.ts (a fine sash window for a wide profile, a T-window with a
// transom light for a mixed one, big glass for a focused one; the strongest choices in the transom light), so the
// window builds itself while the person chooses: every tap adds a pane and the others glide into their new place.
// The same component is used in the intake, on the waiting screen and on /plan; the PDF cover and the share images
// draw the same rectangles.
//
// No hooks and no hidden-until-animated start state: a pane is visible without any script (see progressStage.test.ts), and a new pane
// appears with the `window-pane-open` animation because its element is new, not because of state.

export type { WindowKind };

const SIZES = {
  icon: { px: 40, label: false },
  panel: { px: 260, label: true },
  hero: { px: 320, label: true },
} as const;

function Pane({
  layout,
  index,
  size,
  animateOpen,
  active,
}: {
  layout: WindowLayout;
  index: number;
  size: keyof typeof SIZES;
  animateOpen: boolean;
  active: boolean;
}) {
  const rect = layout.panes[index];
  const item = rect.item === null ? null : layout.shown[rect.item];
  const box = paneBox(layout, rect);
  const paneWidthPx = Math.max(32, Math.round(SIZES[size].px * (rect.w / layout.width)));
  // Opening one by one (waiting screen, /plan): as many seconds as fit in about three, never slower than before.
  const delay = animateOpen ? Math.round(Math.min(450, 3000 / Math.max(1, layout.panes.length)) * rect.slot) : 0;
  return (
    <div
      className={cn(
        "absolute overflow-hidden bg-cream transition-[left,top,width,height] duration-500 ease-out motion-reduce:transition-none",
        item && "window-pane-open",
      )}
      style={{ ...box, ...(delay ? { animationDelay: `${delay}ms` } : {}) }}
      title={item?.label}
    >
      {item?.image ? (
        <Image src={item.image} alt={item.label} fill sizes={`${paneWidthPx * 2}px`} className="object-cover" />
      ) : item?.placeholder ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-gold-light to-gold text-accent-dark">
          <span aria-hidden="true" className={size === "icon" ? "text-[8px]" : "text-xl"}>
            ✦
          </span>
          {SIZES[size].label && rect.w > 60 && <span className="mt-1 px-1 text-center font-serif text-xs italic leading-tight">{item.placeholder}</span>}
        </div>
      ) : (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[repeating-linear-gradient(135deg,var(--color-surface-active)_0_8px,var(--color-cream)_8px_16px)]"
        />
      )}
      {active && <span aria-hidden="true" className="pointer-events-none absolute inset-0 ring-2 ring-inset ring-gold-light" />}
    </div>
  );
}

export function WindowFrame({
  items,
  size = "panel",
  sill,
  title,
  animateOpen = false,
  activeKind,
  className,
}: {
  items: readonly WindowItem[];
  size?: keyof typeof SIZES;
  /** One line of text answers on the sill below the frame ("Laren · halve dag · met je partner"). */
  sill?: string;
  /** Accessible name of the whole window. */
  title: string;
  animateOpen?: boolean;
  /** The kind of choice the person is making right now: its panes get a gold ring. */
  activeKind?: WindowKind;
  className?: string;
}) {
  const layout = layoutWindow(items);
  const glass = layout.glass;
  const pct = (v: number, total: number) => `${((v / total) * 100).toFixed(3)}%`;
  return (
    <figure className={cn("m-0 w-full", className)} aria-label={title} data-window-style={layout.style} data-window-panes={layout.panes.length}>
      <div className="relative aspect-[3/4] w-full bg-accent-dark shadow-[0_18px_40px_-22px_rgba(60,41,32,0.65)] rounded-t-[3px]">
        {layout.panes.map((rect, i) => {
          const it = rect.item === null ? null : layout.shown[rect.item];
          // Keyed by what is in the pane, so a pane that stays keeps its element (and glides) while a new one appears.
          return (
            <Pane
              key={it ? it.id : `empty-${rect.slot}`}
              layout={layout}
              index={i}
              size={size}
              animateOpen={animateOpen}
              active={!!it && it.kind === activeKind}
            />
          );
        })}
        {/* A fine gold line along the inside of the frame. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute ring-1 ring-gold-light/60"
          style={{ left: pct(glass.x, layout.width), top: pct(glass.y, layout.height), width: pct(glass.w, layout.width), height: pct(glass.h, layout.height) }}
        />
      </div>
      {/* The sill: a little wider than the frame, with the text answers on it. */}
      <figcaption
        className={cn(
          "relative left-1/2 -mt-px w-[104%] -translate-x-1/2 rounded-b-md bg-accent-dark px-3 text-center font-medium leading-snug text-gold-light",
          size === "icon" ? "py-px" : sill ? "py-2 text-xs" : "py-1",
        )}
      >
        {size !== "icon" ? sill : null}
      </figcaption>
    </figure>
  );
}
