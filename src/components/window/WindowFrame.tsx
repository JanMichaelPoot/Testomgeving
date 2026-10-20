import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

// The window as the thread through the whole product ("Het venster", fase 4): an arched
// walnut frame with a fine gold inner line and four panes, one per image step of the intake
// (worlds, places, moments, senses). A pane fills with the photos chosen in that step: one
// photo fills it, two to four make a small collage with thin mullions, so every chosen image
// keeps a little pane of its own (the "every answer its own pane" rule of Stap 59). Text
// answers do not fill a pane; they appear as a gold "window sill" line below the frame.
// The same component is used in the intake, at checkout, on the waiting screen and on /plan.

export type WindowPaneKey = "worlds" | "places" | "moments" | "senses";

export interface WindowPane {
  key: WindowPaneKey;
  label: string;
  images: { src: string; alt: string }[];
  /** Shown instead of photos when the step was answered without photos ("Verras me"). */
  placeholder?: string;
  /** Interactive frames link each pane to the step that fills it. */
  href?: string;
  /** The pane the person is filling right now. */
  active?: boolean;
}

const SIZES = {
  icon: { frame: "p-[3px]", gap: "gap-[2px]", label: false, sizes: "40px" },
  panel: { frame: "p-2", gap: "gap-1.5", label: true, sizes: "(min-width: 1024px) 180px, 40vw" },
  hero: { frame: "p-2.5 sm:p-3", gap: "gap-1.5 sm:gap-2", label: true, sizes: "(min-width: 1024px) 220px, 45vw" },
} as const;

// An arch on top, small rounded corners at the bottom. Underscores are spaces in Tailwind.
const ARCH_OUTER = "rounded-[50%_50%_14px_14px/34%_34%_14px_14px]";
const ARCH_INNER = "rounded-[50%_50%_6px_6px/32%_32%_6px_6px]";

function Collage({ images, sizes }: { images: WindowPane["images"]; sizes: string }) {
  const shown = images.slice(0, 4);
  const layout =
    shown.length === 1 ? "grid-cols-1 grid-rows-1" : shown.length === 2 ? "grid-cols-2 grid-rows-1" : "grid-cols-2 grid-rows-2";
  return (
    <div className={cn("absolute inset-0 grid gap-px bg-accent-dark", layout)}>
      {shown.map((img, i) => (
        <div key={`${img.src}-${i}`} className={cn("relative overflow-hidden", shown.length === 3 && i === 0 && "row-span-2")}>
          <Image src={img.src} alt={img.alt} fill sizes={sizes} className="object-cover motion-safe:animate-window-fade-in" />
        </div>
      ))}
    </div>
  );
}

function Pane({ pane, size, index, animateOpen }: { pane: WindowPane; size: keyof typeof SIZES; index: number; animateOpen: boolean }) {
  const s = SIZES[size];
  const full = pane.images.length > 0;
  const content = (
    <>
      {full ? (
        <Collage images={pane.images} sizes={s.sizes} />
      ) : pane.placeholder ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-gold-light to-gold text-accent-dark">
          <span aria-hidden="true" className={size === "icon" ? "text-[10px]" : "text-2xl"}>
            ✦
          </span>
          {s.label && <span className="mt-1 px-2 text-center font-serif text-sm italic leading-tight">{pane.placeholder}</span>}
        </div>
      ) : (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[repeating-linear-gradient(135deg,var(--color-surface-active)_0_8px,var(--color-cream)_8px_16px)]"
        />
      )}
      {s.label && (
        <span
          className={cn(
            "pointer-events-none absolute inset-x-0 bottom-0 px-2 pb-1.5 pt-5 text-[10px] font-bold uppercase tracking-[0.08em]",
            full ? "bg-gradient-to-t from-black/55 to-transparent text-white" : "text-accent/60",
          )}
        >
          {pane.label}
        </span>
      )}
      {pane.active && <span aria-hidden="true" className="pointer-events-none absolute inset-0 ring-2 ring-inset ring-gold-light" />}
    </>
  );
  const className = cn(
    "relative block overflow-hidden bg-cream",
    animateOpen && "window-pane-open",
    pane.href && "transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-gold/60",
  );
  const style = animateOpen ? { animationDelay: `${index * 450}ms` } : undefined;
  if (pane.href) {
    return (
      <Link href={pane.href} className={className} style={style} aria-label={pane.label}>
        {content}
      </Link>
    );
  }
  return (
    <div className={className} style={style}>
      {content}
    </div>
  );
}

export function WindowFrame({
  panes,
  size = "panel",
  sill,
  title,
  animateOpen = false,
  className,
}: {
  panes: WindowPane[];
  size?: keyof typeof SIZES;
  /** One line of text answers below the frame ("Laren · halve dag · met je partner"). */
  sill?: string;
  /** Accessible name of the whole window. */
  title: string;
  animateOpen?: boolean;
  className?: string;
}) {
  const s = SIZES[size];
  return (
    <figure className={cn("m-0 w-full", className)} aria-label={title}>
      <div className={cn("relative aspect-[3/4] w-full bg-accent-dark shadow-[0_18px_40px_-22px_rgba(60,41,32,0.65)]", ARCH_OUTER, s.frame)}>
        <div className={cn("h-full w-full overflow-hidden ring-1 ring-gold-light/60", ARCH_INNER)}>
          <div className={cn("grid h-full w-full grid-cols-2 grid-rows-2 bg-accent-dark", s.gap)}>
            {panes.map((pane, i) => (
              <Pane key={pane.key} pane={pane} size={size} index={i} animateOpen={animateOpen} />
            ))}
          </div>
        </div>
      </div>
      {sill && size !== "icon" && (
        <figcaption className="mx-auto -mt-px w-[92%] rounded-b-md bg-accent-dark px-3 py-2 text-center text-xs font-medium leading-snug text-gold-light">
          {sill}
        </figcaption>
      )}
    </figure>
  );
}
