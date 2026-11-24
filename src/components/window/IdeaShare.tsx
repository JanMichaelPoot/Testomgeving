"use client";

import { useState, useSyncExternalStore } from "react";
import { trackEvent } from "@/lib/posthog/client";
import { ideaCardPath, ideaShareLink } from "@/lib/ideaShare";
import type { IdeaShareCopy } from "@/lib/i18n/ideaShare";
import { cn } from "@/lib/utils";

// Share ONE idea as a card (Step 242), in the idea dialog: the card as the friend will see it, and four ways to send it. On a phone the share sheet takes the picture and the link
// (WhatsApp and Instagram are in there); on a computer the card can be downloaded and WhatsApp opens with the link. The link's page and the picture are made at
// /shared/<book>/idee/<key> (src/app/shared/[id]/idee/[key]), where the friend lands.

const noop = () => () => {};
// Whether this browser can hand a file to the share sheet. False on the server and in the first render.
function canShareFiles(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.share === "function" && typeof navigator.canShare === "function";
}

export function IdeaShare({ planId, ideaKey, title, siteUrl, copy }: { planId: string; ideaKey: string; title: string; siteUrl: string; copy: IdeaShareCopy }) {
  const [copied, setCopied] = useState(false);
  const sheet = useSyncExternalStore(noop, canShareFiles, () => false);

  const cardPath = ideaCardPath(planId, ideaKey);
  const link = ideaShareLink(siteUrl, planId, ideaKey);
  const text = `${copy.shareText.replace("{title}", title)} ${link}`;
  const filename = `windowinto-${ideaKey}.jpg`;

  async function shareCard() {
    try {
      const blob = await (await fetch(cardPath)).blob();
      const file = new File([blob], filename, { type: blob.type || "image/jpeg" });
      const data = { files: [file], text };
      if (navigator.canShare(data)) await navigator.share(data);
      else await navigator.share({ text });
      trackEvent("idea_shared", { planId, ideaKey, method: "native" });
    } catch {
      // The person closed the share sheet, or the browser refused: the other buttons are right there.
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      trackEvent("idea_shared", { planId, ideaKey, method: "copy" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused; the link stays in the WhatsApp button.
    }
  }

  const action = "inline-flex min-h-11 items-center justify-center rounded-full border border-border bg-paper px-4 text-sm font-semibold text-accent-dark transition-colors hover:border-accent-dark";

  return (
    <section aria-label={copy.heading} className="flex flex-col gap-3 rounded-lg border border-border bg-paper p-4 sm:p-5" data-testid="idea-share">
      <div>
        <h3 className="font-serif text-lg text-ink">{copy.heading}</h3>
        <p className="mt-0.5 text-sm text-ink/70">{copy.sub}</p>
      </div>

      {/* The card is a generated JPEG; a plain img keeps the download and the preview the same file. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={cardPath} alt={copy.previewAlt} width={1200} height={630} loading="lazy" className="h-auto w-full rounded-md border border-border" />

      <div className="flex flex-wrap gap-2.5">
        {sheet && (
          <button type="button" onClick={shareCard} className={cn(action, "border-accent-dark bg-accent-dark text-white hover:bg-accent-dark/90")}>
            {copy.share}
          </button>
        )}
        <a
          href={`https://wa.me/?text=${encodeURIComponent(text)}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackEvent("idea_shared", { planId, ideaKey, method: "whatsapp" })}
          className={action}
        >
          {copy.whatsapp}
        </a>
        <button type="button" onClick={copyLink} className={action} aria-live="polite">
          {copied ? copy.copied : copy.copyLink}
        </button>
        <a href={cardPath} download={filename} onClick={() => trackEvent("idea_shared", { planId, ideaKey, method: "download" })} className={action}>
          {copy.download}
        </a>
      </div>
    </section>
  );
}
