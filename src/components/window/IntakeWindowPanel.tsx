import { cn } from "@/lib/utils";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { PaneGroup } from "@/lib/intakeWindow";

export interface WindowPane {
  id: string;
  label: string;
  // Null while the person hasn't answered this one yet.
  value: string | null;
  // The wizard page this pane belongs to (its colour, and when it lights up).
  group: PaneGroup;
  // Spans both columns.
  wide?: boolean;
}

// One tone per wizard page. The class names are written out in full so Tailwind can
// see them; the colours are the --color-pane-* tokens in globals.css.
const TONES: Record<
  PaneGroup,
  { filled: string; bar: string; emptyBorder: string; emptyLabel: string; activeRing: string; chip: string }
> = {
  situation: {
    filled: "bg-pane-sand",
    bar: "bg-pane-sand-strong",
    emptyBorder: "border-pane-sand-strong/40",
    emptyLabel: "text-pane-sand-strong",
    activeRing: "ring-pane-sand-strong",
    chip: "border-l-pane-sand-strong",
  },
  about: {
    filled: "bg-pane-sage",
    bar: "bg-pane-sage-strong",
    emptyBorder: "border-pane-sage-strong/40",
    emptyLabel: "text-pane-sage-strong",
    activeRing: "ring-pane-sage-strong",
    chip: "border-l-pane-sage-strong",
  },
  dials: {
    filled: "bg-pane-terracotta",
    bar: "bg-pane-terracotta-strong",
    emptyBorder: "border-pane-terracotta-strong/40",
    emptyLabel: "text-pane-terracotta-strong",
    activeRing: "ring-pane-terracotta-strong",
    chip: "border-l-pane-terracotta-strong",
  },
  openness: {
    filled: "bg-pane-sky",
    bar: "bg-pane-sky-strong",
    emptyBorder: "border-pane-sky-strong/40",
    emptyLabel: "text-pane-sky-strong",
    activeRing: "ring-pane-sky-strong",
    chip: "border-l-pane-sky-strong",
  },
  interests: {
    filled: "bg-pane-sky",
    bar: "bg-pane-sky-strong",
    emptyBorder: "border-pane-sky-strong/40",
    emptyLabel: "text-pane-sky-strong",
    activeRing: "ring-pane-sky-strong",
    chip: "border-l-pane-sky-strong",
  },
  final: {
    filled: "bg-pane-plum",
    bar: "bg-pane-plum-strong",
    emptyBorder: "border-pane-plum-strong/40",
    emptyLabel: "text-pane-plum-strong",
    activeRing: "ring-pane-plum-strong",
    chip: "border-l-pane-plum-strong",
  },
};

// The desktop-only left column of the intake wizard: a dark walnut panel
// with a small window frame that fills with the person's own answers as they
// go — purely a mirror of wizard state, nothing here is stored or submitted.
// Every answer has its own pane and each wizard page its own colour; the panes
// of the page that is open are outlined, so it is clear where an answer lands.
// A decorative duplicate of what the form already says, so it is hidden from
// assistive tech.
export function IntakeWindowPanel({
  panes,
  dict,
  activeGroup,
}: {
  panes: WindowPane[];
  dict: Dictionary["intake"]["window"];
  activeGroup?: PaneGroup;
}) {
  const filledCount = panes.filter((p) => p.value !== null).length;

  return (
    <div aria-hidden="true" className="hidden shrink-0 bg-accent-dark p-8 md:block md:w-2/5 lg:p-10">
      {/* The wizard's pages differ a lot in height. The dark column stretches
          with the card, but the window itself keeps its size and follows the
          scroll instead of ballooning on the long pages. */}
      <div className="sticky top-24 flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold-light">{dict.eyebrow}</p>
          <p className="font-serif text-3xl leading-[1.15] text-paper">{dict.heading}</p>
        </div>

        <div className="grid auto-rows-[72px] grid-cols-2 gap-1.5 rounded-sm border-[6px] border-walnut-light bg-black/25 p-1.5">
          {panes.map((pane) => {
            const tone = TONES[pane.group];
            const filled = pane.value !== null;
            const active = pane.group === activeGroup;
            return (
              <div
                key={pane.id}
                className={cn(
                  "relative flex flex-col justify-end gap-0.5 overflow-hidden rounded-[3px] px-3 py-2 transition-[background-color,box-shadow] duration-500",
                  pane.wide && "col-span-2",
                  filled ? tone.filled : cn("border border-dashed bg-white/[0.04]", tone.emptyBorder),
                  active && cn("ring-2 ring-inset", tone.activeRing),
                )}
              >
                {filled && <span className={cn("absolute inset-y-0 left-0 w-1", tone.bar)} />}
                <span
                  className={cn(
                    "text-[10px] font-semibold uppercase tracking-[0.1em]",
                    filled ? "text-muted" : tone.emptyLabel,
                  )}
                >
                  {pane.label}
                </span>
                {/* Keyed by the value so a changed answer re-runs the fade-in. */}
                <span
                  key={pane.value ?? "empty"}
                  className={cn(
                    "line-clamp-2 break-words font-serif leading-[1.2]",
                    pane.wide ? "text-[15px]" : "text-[14px]",
                    filled ? "animate-window-fade-in text-accent-dark" : "text-paper/30",
                  )}
                >
                  {pane.value ?? "…"}
                </span>
              </div>
            );
          })}
        </div>

        <p className="text-[13px] leading-relaxed text-paper/70">
          {dict.hint.replace("{n}", String(filledCount)).replace("{total}", String(panes.length))}
        </p>
      </div>
    </div>
  );
}

// Mobile counterpart: no side column, just the answers so far as a compact
// horizontally scrolling strip above the questions, each with its page colour.
export function IntakeAnswerStrip({ panes }: { panes: WindowPane[] }) {
  const filled = panes.filter((p) => p.value !== null);
  if (filled.length === 0) return null;

  return (
    <ul
      aria-hidden="true"
      className="-mx-6 mt-4 flex gap-2 overflow-x-auto px-6 pb-1 [scrollbar-width:none] sm:-mx-10 sm:px-10 md:hidden [&::-webkit-scrollbar]:hidden"
    >
      {filled.map((pane) => (
        <li
          key={pane.id}
          className={cn(
            "flex max-w-[14rem] shrink-0 flex-col rounded-md border border-l-4 border-border px-3 py-1.5",
            TONES[pane.group].filled,
            TONES[pane.group].chip,
          )}
        >
          <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">{pane.label}</span>
          <span className="truncate text-[13px] font-medium text-accent-dark">{pane.value}</span>
        </li>
      ))}
    </ul>
  );
}
