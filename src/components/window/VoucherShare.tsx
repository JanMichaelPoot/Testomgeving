"use client";

import { useState } from "react";
import { fill, type GiftCopy } from "@/lib/i18n/gift";

// Copy-the-link and WhatsApp on the "your voucher is ready" page. The link is the recipient's page for this code (src/app/cadeau/[code]).
// Clipboard access can be refused (older in-app browsers): then the link stays visible and selectable, the button just says nothing happened.
export function VoucherShare({ copy, link }: { copy: GiftCopy["done"]; link: string }) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  const button = "inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-cream px-4 text-sm font-semibold text-ink transition-colors hover:border-ink";

  return (
    <div className="flex flex-col gap-3">
      <p className="break-all rounded-lg bg-surface-active px-3 py-2 text-xs text-ink/80 select-all">{link}</p>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={copyLink} className={button}>
          <span aria-live="polite">{copied ? copy.copied : copy.copyLink}</span>
        </button>
        <a href={`https://wa.me/?text=${encodeURIComponent(fill(copy.whatsappText, { link }))}`} target="_blank" rel="noopener noreferrer" className={button}>
          {copy.whatsapp}
        </a>
      </div>
    </div>
  );
}
