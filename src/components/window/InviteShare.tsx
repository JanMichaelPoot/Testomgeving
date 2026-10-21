"use client";

import { useState, useSyncExternalStore } from "react";
import { trackEvent } from "@/lib/posthog/client";
import { cn } from "@/lib/utils";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { INVITE_FORMATS, inviteCardPath, inviteLink, type InviteFormat, type InviteLocale } from "@/lib/shareInvite";

// Share the general invitation card (R3): a picture for an Instagram story, a WhatsApp status or a
// chat, the same for everybody and with nothing personal on it. On a phone the share sheet of the
// device takes the picture and the link (Instagram and WhatsApp are in there); where that does not
// exist (a computer) the picture can be downloaded and WhatsApp opens with the link.
//
// The picture itself is made at /share-card/<format>-<locale> (src/app/share-card/[card]/route.tsx).

const noop = () => () => {};
// Whether this browser can hand a file to the share sheet. False on the server and in the first render.
function canShareFiles(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.share === "function" && typeof navigator.canShare === "function";
}

export function InviteShare({
  locale,
  copy,
  siteUrl,
  source,
  defaultOpen = false,
  className,
}: {
  locale: InviteLocale;
  copy: Dictionary["venster"]["invite"];
  siteUrl: string;
  /** Where the button sits, for the measurements. */
  source: "page" | "plan";
  defaultOpen?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [format, setFormat] = useState<InviteFormat>("story");
  const [copied, setCopied] = useState(false);
  const sheet = useSyncExternalStore(noop, canShareFiles, () => false);

  const cardPath = inviteCardPath(format, locale);
  const link = inviteLink(siteUrl, format);
  const filename = `windowinto-${format === "story" ? "verhaal" : "vierkant"}-${locale}.jpg`;

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) trackEvent("invite_card_opened", { source });
  }

  async function shareImage() {
    try {
      const blob = await (await fetch(cardPath)).blob();
      const file = new File([blob], filename, { type: blob.type || "image/jpeg" });
      const data = { files: [file], text: `${copy.shareText} ${link}` };
      if (!navigator.canShare(data)) return;
      await navigator.share(data);
      trackEvent("invite_card_shared", { format, method: "native", source });
    } catch {
      // The person closed the share sheet, or the browser refused: nothing to do, the other buttons are right there.
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      trackEvent("invite_card_shared", { format, method: "copy", source });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused; the link stays in the WhatsApp button.
    }
  }

  const action =
    "inline-flex min-h-12 items-center justify-center rounded-full border border-border bg-paper px-5 text-sm font-semibold text-accent-dark transition-colors hover:border-accent-dark";

  return (
    <div className={className}>
      {/* On the page made for it (defaultOpen) the panel is simply there; the button is for the plan page. */}
      {!defaultOpen && (
        <button
          type="button"
          aria-expanded={open}
          aria-controls="invite-panel"
          onClick={toggle}
          className="inline-flex min-h-12 items-center justify-center rounded-full border border-ink/15 bg-paper px-6 text-sm font-medium text-ink shadow-sm transition-colors hover:bg-ink/5"
        >
          {copy.button}
        </button>
      )}

      {open && (
        <div id="invite-panel" className={cn(!defaultOpen && "mt-4", "rounded-lg border border-border bg-paper p-4 sm:p-5")}>
          <h2 className="font-serif text-xl text-ink">{copy.heading}</h2>
          <p className="mt-1 text-sm text-ink/65">{copy.sub}</p>

          <div role="group" aria-label={copy.formatLabel} className="mt-4 inline-flex rounded-full border border-border p-1">
            {INVITE_FORMATS.map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={format === f}
                onClick={() => setFormat(f)}
                className={cn(
                  "min-h-11 rounded-full px-5 text-sm font-semibold transition-colors",
                  format === f ? "bg-accent-dark text-white" : "text-ink/70 hover:text-ink",
                )}
              >
                {f === "story" ? copy.formatStory : copy.formatSquare}
              </button>
            ))}
          </div>

          <div className="mt-4 flex justify-center rounded-md bg-surface-active p-3">
            {/* The card is a generated JPEG; a plain img keeps the download and the preview the same file. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cardPath}
              alt={copy.previewAlt}
              width={1080}
              height={format === "story" ? 1920 : 1080}
              className={cn("h-auto rounded-md shadow-sm", format === "story" ? "max-h-[28rem] w-auto" : "max-h-[22rem] w-auto")}
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-2.5">
            {sheet && (
              <button type="button" onClick={shareImage} className={cn(action, "border-accent-dark bg-accent-dark text-white hover:bg-accent-dark/90")}>
                {copy.share}
              </button>
            )}
            <a href={cardPath} download={filename} onClick={() => trackEvent("invite_card_shared", { format, method: "download", source })} className={action}>
              {copy.download}
            </a>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`${copy.shareText} ${link}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackEvent("invite_card_shared", { format, method: "whatsapp", source })}
              className={action}
            >
              {copy.whatsapp}
            </a>
            <button type="button" onClick={copyLink} className={action} aria-live="polite">
              {copied ? copy.copied : copy.copyLink}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
