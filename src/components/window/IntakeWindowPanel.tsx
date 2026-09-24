import { cn } from "@/lib/utils";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export interface WindowPane {
  id: string;
  label: string;
  // Null while the person hasn't answered this one yet.
  value: string | null;
}

// The desktop-only left column of the intake wizard: a dark walnut panel
// with a small window frame (2 x 4 panes) that fills with the person's own
// answers as they go — purely a mirror of wizard state, nothing here is
// stored or submitted. Decorative duplicate of what the form already says,
// so it is hidden from assistive tech.
export function IntakeWindowPanel({
  panes,
  dict,
}: {
  panes: WindowPane[];
  dict: Dictionary["intake"]["window"];
}) {
  const filledCount = panes.filter((p) => p.value !== null).length;

  return (
    <div
      aria-hidden="true"
      className="hidden shrink-0 bg-accent-dark p-8 md:block md:w-2/5 lg:p-10"
    >
      {/* The wizard's pages differ a lot in height. The dark column stretches
          with the card, but the window itself keeps its size and follows the
          scroll instead of ballooning on the long pages. */}
      <div className="sticky top-24 flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold-light">
            {dict.eyebrow}
          </p>
          <p className="font-serif text-3xl leading-[1.15] text-paper">
            {dict.heading}
          </p>
        </div>

        <div className="grid auto-rows-[96px] grid-cols-2 gap-1.5 rounded-sm border-[6px] border-walnut-light bg-black/25 p-1.5">
          {panes.map((pane) => (
            <div
              key={pane.id}
              className={cn(
                "flex flex-col justify-end gap-1 rounded-[3px] p-3.5 transition-colors duration-500",
                pane.value !== null
                  ? "bg-cream"
                  : "border border-dashed border-gold-light/35 bg-gold-light/10",
              )}
            >
              <span
                className={cn(
                  "text-[11px] font-semibold uppercase tracking-[0.1em]",
                  pane.value !== null ? "text-muted" : "text-walnut-light",
                )}
              >
                {pane.label}
              </span>
              {/* Keyed by the value so a changed answer re-runs the fade-in. */}
              <span
                key={pane.value ?? "empty"}
                className={cn(
                  "line-clamp-3 break-words font-serif text-[17px] leading-tight",
                  pane.value !== null
                    ? "animate-window-fade-in text-accent-dark"
                    : "text-walnut-light",
                )}
              >
                {pane.value ?? "…"}
              </span>
            </div>
          ))}
        </div>

        <p className="text-[13px] leading-relaxed text-paper/70">
          {dict.hint
            .replace("{n}", String(filledCount))
            .replace("{total}", String(panes.length))}
        </p>
      </div>
    </div>
  );
}

// Mobile counterpart: no side column, just the answers so far as a compact
// horizontally scrolling strip above the questions.
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
          className="flex max-w-[14rem] shrink-0 flex-col rounded-md border border-border bg-cream px-3 py-1.5"
        >
          <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
            {pane.label}
          </span>
          <span className="truncate text-[13px] font-medium text-accent-dark">
            {pane.value}
          </span>
        </li>
      ))}
    </ul>
  );
}
