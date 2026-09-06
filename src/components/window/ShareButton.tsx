"use client";

import { useState } from "react";
import { trackEvent } from "@/lib/posthog/client";

// Fase A of the referral loop from the improvement plan: a free, purely
// measurable share action — no discount, no incentive yet. The goal right
// now is finding out whether people share at all before building anything
// more elaborate on top of that.
export function ShareButton({
  url,
  label,
  copiedLabel,
}: {
  url: string;
  label: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    trackEvent("idea_book_share_clicked", { url });

    if (navigator.share) {
      try {
        await navigator.share({ url });
        return;
      } catch {
        // The user canceled the share sheet, or it's unsupported for this
        // context — fall through to the clipboard copy instead.
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied by the browser — nothing more to
      // do here, the button just silently doesn't confirm.
    }
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      className="inline-flex items-center justify-center gap-2 rounded-full border border-ink/15 bg-paper px-6 py-3 text-sm font-medium text-ink shadow-sm transition-colors hover:bg-ink/5"
    >
      {copied ? copiedLabel : label}
    </button>
  );
}
