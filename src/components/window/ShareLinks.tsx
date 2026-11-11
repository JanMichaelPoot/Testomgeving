"use client";

import { useState, useSyncExternalStore } from "react";
import { trackEvent } from "@/lib/posthog/client";
import { cn } from "@/lib/utils";

// A row of share icons for the landing page: WhatsApp, Instagram, Facebook, X, LinkedIn and e-mail, plus the share sheet of the
// device where there is one (a phone: Instagram, WhatsApp and everything installed are in there). Instagram has no web address
// that takes a link, so its button opens the share sheet where it exists and otherwise copies the link with a short note.
// The link is the landing page itself, tagged with where it was shared from. Nothing personal is shared.

export type SharePlatform = "native" | "whatsapp" | "instagram" | "facebook" | "x" | "linkedin" | "email";

export interface ShareLinksCopy {
  heading: string;
  nativeLabel: string;
  whatsapp: string;
  instagram: string;
  facebook: string;
  x: string;
  linkedin: string;
  email: string;
  /** Shown after the link has been copied for Instagram. */
  copiedForInstagram: string;
  /** The message that goes with the link. */
  text: string;
  emailSubject: string;
}

const noop = () => () => {};
const canShare = () => typeof navigator !== "undefined" && typeof navigator.share === "function";

function taggedLink(siteUrl: string, platform: SharePlatform): string {
  const base = siteUrl.replace(/\/+$/, "");
  return `${base}/?utm_source=landing_share&utm_medium=${platform}`;
}

const ICON_PROPS = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

const ICONS: Record<SharePlatform, React.ReactNode> = {
  native: (
    <svg {...ICON_PROPS}>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
    </svg>
  ),
  whatsapp: (
    <svg {...ICON_PROPS}>
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
      <path d="M9 9.2c.3 2.3 2.5 4.5 4.8 4.8l1.3-1.2-1.9-1-.9.8c-.7-.3-1.4-1-1.7-1.7l.8-.9-1-1.9z" />
    </svg>
  ),
  instagram: (
    <svg {...ICON_PROPS}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="0.6" fill="currentColor" />
    </svg>
  ),
  facebook: (
    <svg {...ICON_PROPS}>
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  ),
  x: (
    <svg {...ICON_PROPS}>
      <path d="M4 4l11.7 16H20L8.3 4z" />
      <path d="M4.2 20l6.9-6.9M12.9 10.9L19.8 4" />
    </svg>
  ),
  linkedin: (
    <svg {...ICON_PROPS}>
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect x="2" y="9" width="4" height="12" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  ),
  email: (
    <svg {...ICON_PROPS}>
      <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  ),
};

const BUTTON =
  "inline-flex size-11 items-center justify-center rounded-full border border-border bg-paper text-accent-dark transition-colors hover:border-accent-dark hover:bg-accent-dark hover:text-paper focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-gold/60";

export function ShareLinks({ siteUrl, copy, className }: { siteUrl: string; copy: ShareLinksCopy; className?: string }) {
  const [note, setNote] = useState<string | null>(null);
  const sheet = useSyncExternalStore(noop, canShare, () => false);

  function track(platform: SharePlatform) {
    trackEvent("landing_share_clicked", { platform });
  }

  async function nativeShare(platform: SharePlatform) {
    track(platform);
    try {
      await navigator.share({ url: taggedLink(siteUrl, platform), text: copy.text });
    } catch {
      // The share sheet was closed, or the browser refused: the other buttons are right there.
    }
  }

  async function instagram() {
    if (sheet) return nativeShare("instagram");
    track("instagram");
    try {
      await navigator.clipboard.writeText(taggedLink(siteUrl, "instagram"));
      setNote(copy.copiedForInstagram);
      setTimeout(() => setNote(null), 4000);
    } catch {
      // Clipboard access can be refused; nothing more to do.
    }
  }

  const text = encodeURIComponent(copy.text);
  const links: { platform: Exclude<SharePlatform, "native" | "instagram">; label: string; href: string }[] = [
    { platform: "whatsapp", label: copy.whatsapp, href: `https://wa.me/?text=${encodeURIComponent(`${copy.text} ${taggedLink(siteUrl, "whatsapp")}`)}` },
    { platform: "facebook", label: copy.facebook, href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(taggedLink(siteUrl, "facebook"))}` },
    { platform: "x", label: copy.x, href: `https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(taggedLink(siteUrl, "x"))}` },
    { platform: "linkedin", label: copy.linkedin, href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(taggedLink(siteUrl, "linkedin"))}` },
    { platform: "email", label: copy.email, href: `mailto:?subject=${encodeURIComponent(copy.emailSubject)}&body=${encodeURIComponent(`${copy.text} ${taggedLink(siteUrl, "email")}`)}` },
  ];

  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      <p className="text-xs font-semibold uppercase tracking-[0.09em] text-ink/70">{copy.heading}</p>
      <ul className="flex flex-wrap items-center gap-2.5">
        {sheet && (
          <li>
            <button type="button" onClick={() => nativeShare("native")} aria-label={copy.nativeLabel} title={copy.nativeLabel} className={cn(BUTTON, "bg-accent-dark text-paper hover:bg-accent")}>
              {ICONS.native}
            </button>
          </li>
        )}
        <li>
          <a href={links[0].href} target="_blank" rel="noopener noreferrer" aria-label={links[0].label} title={links[0].label} onClick={() => track("whatsapp")} className={BUTTON}>
            {ICONS.whatsapp}
          </a>
        </li>
        <li>
          <button type="button" onClick={instagram} aria-label={copy.instagram} title={copy.instagram} className={BUTTON}>
            {ICONS.instagram}
          </button>
        </li>
        {links.slice(1).map((l) => (
          <li key={l.platform}>
            <a
              href={l.href}
              target={l.platform === "email" ? undefined : "_blank"}
              rel="noopener noreferrer"
              aria-label={l.label}
              title={l.label}
              onClick={() => track(l.platform)}
              className={BUTTON}
            >
              {ICONS[l.platform]}
            </a>
          </li>
        ))}
      </ul>
      <p className="min-h-5 text-sm text-ink/80" role="status" aria-live="polite">
        {note}
      </p>
    </div>
  );
}
