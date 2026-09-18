import { cn } from "@/lib/utils";

// The "WindowInto" text lockup — always paired with <WindowMark />. Colors
// sampled directly from the brand icon's own gradient (warm orange to sky
// blue) so "Into" reads as the same mark, not a separate accent color.
// "Window" itself switches between ink and white depending on what it's
// sitting on (the cream header vs. the walnut-dark footer).
export function Wordmark({ onDark = false, className }: { onDark?: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "font-sans text-lg font-bold tracking-tight",
        onDark ? "text-white" : "text-ink",
        className
      )}
    >
      Window
      <span className="bg-gradient-to-r from-[#F5A623] to-[#4FA8E0] bg-clip-text text-transparent">
        Into
      </span>
    </span>
  );
}
