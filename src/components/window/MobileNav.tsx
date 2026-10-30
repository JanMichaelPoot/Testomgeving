"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

// The header navigation below the md breakpoint, where the inline links are hidden: a menu button that opens a small panel with the
// same links. Closes on a link press, on Escape and on a press outside, and hands focus back to the button after Escape.
export function MobileNav({
  menuLabel,
  links,
}: {
  menuLabel: string;
  links: { href: string; label: string; external?: boolean }[];
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    }
    function onPointer(event: PointerEvent) {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <div ref={root} className="relative md:hidden">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={menuLabel}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-paper text-ink transition hover:border-ink focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-gold/60"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>
      {open && (
        <nav id={panelId} aria-label={menuLabel} className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-60 rounded-lg border border-border bg-paper p-2 shadow-[0_20px_40px_-24px_rgba(60,41,32,0.5)]">
          <ul className="flex flex-col">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  {...(link.external ? { target: "_blank", rel: "noreferrer" } : {})}
                  onClick={() => setOpen(false)}
                  className="flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-ink hover:bg-surface-active focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-gold/60"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
