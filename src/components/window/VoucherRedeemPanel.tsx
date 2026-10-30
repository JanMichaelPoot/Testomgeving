"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { ComplianceCheckbox } from "@/components/window/CheckoutPanel";
import { redeemVoucher } from "@/app/cadeau/actions";
import type { GiftCopy } from "@/lib/i18n/gift";
import { isValidEmail } from "@/lib/voucher/text";

// The last screen of the intake for someone who came with a gift voucher: instead of paying, redeem. `beforeRedeem` stores the answers first
// (the same function the paying panel uses), then the server makes the book's order from the voucher. If anything fails, the voucher is not used up.
export function VoucherRedeemPanel({ copy, beforeRedeem }: { copy: GiftCopy["panel"]; beforeRedeem: () => Promise<void> }) {
  const router = useRouter();
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [email, setEmail] = useState("");
  const [followUp, setFollowUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const trimmed = email.trim();
  const emailOk = trimmed === "" || isValidEmail(trimmed);
  const canSubmit = termsAccepted && emailOk;

  function submit() {
    if (!canSubmit) return;
    setError(null);
    startTransition(async () => {
      try {
        await beforeRedeem();
        const result = await redeemVoucher({ termsAccepted, email: trimmed, followUp: followUp && trimmed !== "" });
        if (result.ok) {
          router.push(`/plan?gift=${result.token}`);
          return;
        }
        setError(result.reason === "terms" ? copy.errorTerms : result.reason === "email" ? copy.errorEmail : copy.errors[result.reason]);
      } catch (err) {
        setError(err instanceof Error && err.message ? err.message : copy.errors.generic);
      }
    });
  }

  return (
    <div>
      <div className="mb-6">
        <label htmlFor="redeem-email" className="block text-xs font-medium uppercase tracking-widest text-ink/70">
          {copy.emailLabel}
        </label>
        <input
          id="redeem-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={!emailOk}
          className="mt-1.5 w-full rounded-lg border border-border bg-paper px-3.5 py-2.5 text-sm text-ink outline-none placeholder:text-ink/70 focus:border-ink"
        />
        <p className="mt-1.5 text-xs text-ink/70">{copy.emailHint}</p>
      </div>

      <div className="mb-6 rounded-lg border border-border bg-cream p-5">
        <div className="flex items-start justify-between gap-4">
          <span id="redeem-followup-label" className="text-sm font-medium text-ink">
            {copy.followUpLabel}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={followUp}
            aria-labelledby="redeem-followup-label"
            onClick={() => setFollowUp((f) => !f)}
            className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${followUp ? "bg-accent" : "bg-ink/15"}`}
          >
            <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${followUp ? "translate-x-6" : "translate-x-1"}`} />
          </button>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-ink/70">{copy.followUpHint}</p>
      </div>

      <div className="mb-6">
        <ComplianceCheckbox checked={termsAccepted} onChange={setTermsAccepted}>
          {copy.termsLabelPrefix}{" "}
          <Link href="/terms" target="_blank" className="underline underline-offset-2 hover:text-ink">
            {copy.termsLinkText}
          </Link>{" "}
          {copy.termsLabelSuffix}
        </ComplianceCheckbox>
      </div>

      {error && (
        <p className="mb-4 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <Button onClick={submit} disabled={!canSubmit || isPending} size="lg" className="w-full justify-center">
        {isPending ? copy.ctaPending : copy.cta}
      </Button>
    </div>
  );
}
