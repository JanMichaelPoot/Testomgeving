// The WindowInto brand icon — two overlapping, peeling rounded-square
// cards in a warm-orange-to-sky-blue gradient. Recreated via Gemini from a
// reference logo sheet (no clean source file existed) rather than a hand-
// drawn line icon, since the brand mark itself is now a full-color image,
// not a monochrome shape — see scripts/generate-logo-icon.ts and
// scripts/process-logo-icon.ts for how public/logo/icon-128.png was made.
//
// A plain <img> rather than next/image: every call site sizes this purely
// via Tailwind height/width utility classes with no positioned wrapper,
// which next/image's `fill` mode would require adding everywhere.
/* eslint-disable @next/next/no-img-element */
export function WindowMark({ className }: { className?: string }) {
  return <img src="/logo/icon-128.png" alt="" aria-hidden="true" className={className} />;
}
