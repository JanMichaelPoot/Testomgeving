import { DOOR_ORDER } from "@/lib/possibilityMap";
import { cn } from "@/lib/utils";

type Door = (typeof DOOR_ORDER)[number];

// The brand's window-frame motif, one per door: the sash swings open a
// little further with every door (door 1 is shut, door 4 is wide open) and
// the light behind it gets warmer. The glow steps are mixes of two existing
// tokens rather than new colours.
const SASH_POINTS: Record<Door, string> = {
  natural: "6,6 38,6 38,46 6,46",
  discovery: "6,6 30,9 30,43 6,46",
  unexpected: "6,6 20,11 20,41 6,46",
  stretch: "6,6 11,13 11,39 6,46",
};

const GLOW: Record<Door, string> = {
  natural: "var(--color-surface-active)",
  discovery: "color-mix(in srgb, var(--color-gold-light) 25%, var(--color-surface-active))",
  unexpected: "color-mix(in srgb, var(--color-gold-light) 55%, var(--color-surface-active))",
  stretch: "var(--color-gold-light)",
};

// Where the handle sits on the sash's free edge (x of the polygon's
// right-hand side, vertically centred).
const HANDLE_X: Record<Door, number> = { natural: 34, discovery: 26.5, unexpected: 16.5, stretch: 8.5 };

export function DoorIcon({ door, className }: { door: Door; className?: string }) {
  return (
    <svg
      width="44"
      height="52"
      viewBox="0 0 44 52"
      fill="none"
      aria-hidden="true"
      className={cn("shrink-0", className)}
    >
      <rect x="2" y="2" width="40" height="48" rx="3" strokeWidth="2" className="fill-paper stroke-accent-dark" />
      <rect x="6" y="6" width="32" height="40" style={{ fill: GLOW[door] }} />
      {/* A pane divider in the light behind the sash, like a real casement. */}
      <path d="M22 6v40M6 26h32" strokeWidth="0.75" className="stroke-accent-dark/15" />
      <polygon
        points={SASH_POINTS[door]}
        strokeWidth="1.5"
        strokeLinejoin="round"
        className="fill-accent stroke-accent-dark"
      />
      <circle cx={HANDLE_X[door]} cy="26" r="1.6" className="fill-gold-light" />
    </svg>
  );
}
