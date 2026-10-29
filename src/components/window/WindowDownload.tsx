"use client";

import { trackEvent } from "@/lib/posthog/client";

// "Download your window as a picture": a plain link to /api/window-image (ids only, no text). Counts the click, never what was chosen.
export function WindowDownload({ href, label, images }: { href: string; label: string; images: number }) {
  return (
    <a
      href={href}
      download="windowinto-venster.jpg"
      onClick={() => trackEvent("window_exported", { images })}
      className="mt-3 inline-flex min-h-11 items-center justify-center text-sm font-semibold text-accent-dark underline underline-offset-2 hover:text-accent"
    >
      {label}
    </a>
  );
}
