import { cn } from "@/lib/utils";

// A small indicator above the two image pages: first explore widely (diverge), then find a direction (converge). It is there so the
// visitor understands why they are doing this, without a page of theory: two steps, the current one marked, one line each.

export interface DiscoveryFlowCopy {
  label: string;
  diverge: { title: string; sub: string };
  converge: { title: string; sub: string };
}

const STROKE = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** One dot on the left that fans out into three lines. */
function FanOut() {
  return (
    <svg viewBox="0 0 28 20" width="28" height="20" aria-hidden="true" {...STROKE}>
      <circle cx="4" cy="10" r="1.6" fill="currentColor" />
      <path d="M6 10 L24 3M6 10 L24 10M6 10 L24 17" />
    </svg>
  );
}

/** Three lines that come together in one dot on the right. */
function FanIn() {
  return (
    <svg viewBox="0 0 28 20" width="28" height="20" aria-hidden="true" {...STROKE}>
      <circle cx="24" cy="10" r="1.6" fill="currentColor" />
      <path d="M4 3 L22 10M4 10 L22 10M4 17 L22 10" />
    </svg>
  );
}

export function DiscoveryFlow({ active, copy, className }: { active: "diverge" | "converge"; copy: DiscoveryFlowCopy; className?: string }) {
  const steps = [
    { id: "diverge" as const, ...copy.diverge, glyph: <FanOut /> },
    { id: "converge" as const, ...copy.converge, glyph: <FanIn /> },
  ];
  return (
    <ol aria-label={copy.label} data-testid="discovery-flow" className={cn("flex items-stretch gap-1.5 rounded-xl border border-border bg-paper p-1.5", className)}>
      {steps.map((step, i) => {
        const on = step.id === active;
        return (
          <li key={step.id} className="contents">
            <div
              aria-current={on ? "step" : undefined}
              data-active={on ? "true" : "false"}
              className={cn(
                "flex min-h-11 flex-1 items-center gap-2.5 rounded-lg px-3 py-1.5 text-left transition-colors",
                on ? "bg-accent-dark text-paper" : "text-ink/70",
              )}
            >
              <span className={on ? "text-gold-light" : "text-ink/70"}>{step.glyph}</span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold leading-tight">{step.title}</span>
                <span className={cn("hidden text-xs leading-snug sm:block", on ? "text-paper/80" : "text-ink/70")}>{step.sub}</span>
              </span>
            </div>
            {i === 0 && (
              <span aria-hidden="true" className="flex items-center text-ink/70">
                <svg viewBox="0 0 12 12" width="12" height="12" {...STROKE}>
                  <path d="M3 2l5 4-5 4" />
                </svg>
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
