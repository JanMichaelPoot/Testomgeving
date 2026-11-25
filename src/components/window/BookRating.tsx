"use client";

import { useId, useState, useTransition } from "react";
import { saveBookFeedback } from "@/app/plan/bookFeedbackActions";
import { ShareButton } from "@/components/window/ShareButton";
import { FriendCodeList, type FriendShare } from "@/components/window/FriendCodeList";
import { trackEvent } from "@/lib/posthog/client";
import { COMMENT_MAX, isEnthusiastic } from "@/lib/bookFeedback";
import type { BookFeedbackCopy } from "@/lib/i18n/bookFeedback";
import { cn } from "@/lib/utils";

export type BookRatingFriend = FriendShare;

export interface BookRatingProps {
  planId: string;
  locale: "nl" | "en";
  copy: BookFeedbackCopy;
  /** What is already stored for this book (the buyer came back to the page). */
  initial: { rating: number; comment: string; quoteConsent: boolean } | null;
  /** Friend codes that can still be used; empty when the order has none (the plain share button is then shown instead). */
  friends: BookRatingFriend[];
  friendAmount: string;
  friendDate: string;
  share: { url: string; label: string; copiedLabel: string; whatsappLabel: string };
}

// One question at the bottom of the book (Step 241): how valuable was it, 1 to 5. A tap saves at once. 4 or 5 opens the sharing block (the friend codes, one tap to WhatsApp)
// and an optional sentence that may be shown on the site; 1 to 3 asks what was missing and sells nothing. Sharing never depends on the answer being stored.
export function BookRating({ planId, locale, copy, initial, friends, friendAmount, friendDate, share }: BookRatingProps) {
  const [rating, setRating] = useState<number | null>(initial?.rating ?? null);
  const [comment, setComment] = useState(initial?.comment ?? "");
  const [consent, setConsent] = useState(initial?.quoteConsent ?? false);
  const [phase, setPhase] = useState<"idle" | "sent" | "error">(initial && initial.comment.trim() !== "" ? "sent" : "idle");
  const [, startTransition] = useTransition();
  // Only the sending of the sentence shows "saving": a tap on a score saves quietly in the background.
  const [sending, setSending] = useState(false);
  const commentId = useId();

  const high = isEnthusiastic(rating);
  const hasText = comment.trim() !== "";

  function pick(n: number) {
    if (n === rating) return;
    setRating(n);
    if (!isEnthusiastic(n)) setConsent(false);
    // A failed send belongs to the answer it was for: a new score starts fresh.
    if (phase === "error") setPhase("idle");
    startTransition(async () => {
      let stored = false;
      try {
        stored = (await saveBookFeedback(planId, locale, { rating: n })).ok;
      } catch {
        stored = false;
      }
      trackEvent("book_rated", { planId, rating: n, stored });
    });
  }

  function send() {
    if (rating === null || !hasText) return;
    setSending(true);
    startTransition(async () => {
      let stored = false;
      try {
        stored = (await saveBookFeedback(planId, locale, { rating, comment, quoteConsent: high && consent })).ok;
      } catch {
        stored = false;
      }
      trackEvent("book_feedback_sent", { planId, rating, has_comment: true, quote_consent: high && consent, stored });
      setPhase(stored ? "sent" : "error");
      setSending(false);
    });
  }

  return (
    <section aria-labelledby={`${commentId}-heading`} className="mt-8 rounded-2xl border border-border bg-paper p-6 sm:p-8" data-testid="book-rating">
      <h2 id={`${commentId}-heading`} className="font-serif text-2xl leading-snug text-ink sm:text-3xl">
        {copy.heading}
      </h2>

      <div role="group" aria-labelledby={`${commentId}-heading`} className="mt-4">
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={rating === n}
              aria-label={copy.scoreAria.replace("{n}", String(n))}
              onClick={() => pick(n)}
              data-testid={`book-rating-${n}`}
              className={cn(
                "inline-flex h-12 min-w-12 flex-1 items-center justify-center rounded-lg border text-base font-semibold transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-gold/35 sm:flex-none sm:px-6",
                rating === n ? "border-accent-dark bg-accent-dark text-paper" : "border-border bg-cream text-ink hover:border-accent-dark",
              )}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-xs text-ink/70 sm:max-w-[22rem]">
          <span>{copy.scaleLow}</span>
          <span>{copy.scaleHigh}</span>
        </div>
      </div>

      {rating !== null && high && (
        <div className="mt-6 flex flex-col gap-5 border-t border-border pt-6" data-testid="book-rating-high">
          <p className="text-base text-ink">
            <strong className="font-semibold">{copy.highLead}</strong>{" "}
            {friends.length > 0 ? copy.friendLead.replace("{amount}", friendAmount) : copy.shareLead}
          </p>

          {friends.length > 0 ? (
            <FriendCodeList friends={friends} copy={copy} amount={friendAmount} date={friendDate} onShare={() => trackEvent("book_friend_code_shared", { planId, rating })} />
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <ShareButton
                url={share.url}
                label={share.label}
                copiedLabel={share.copiedLabel}
                whatsappLabel={share.whatsappLabel}
                className="min-h-11 border-accent-dark bg-transparent px-5 py-0 text-sm font-semibold text-accent-dark shadow-none hover:bg-accent-dark hover:text-paper"
              />
            </div>
          )}

          {phase === "sent" ? (
            <p role="status" className="text-sm font-medium text-accent-dark">
              {copy.thanks}
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              <label htmlFor={commentId} className="text-sm font-semibold text-ink">
                {copy.quoteLabel}
              </label>
              <textarea
                id={commentId}
                value={comment}
                maxLength={COMMENT_MAX}
                onChange={(e) => setComment(e.target.value)}
                placeholder={copy.quotePlaceholder}
                rows={2}
                className="w-full rounded-lg border border-border bg-cream p-3 text-sm text-ink focus:border-accent focus:outline-none"
              />
              <label className="flex items-start gap-2.5 text-sm text-ink/80">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 accent-accent-dark" />
                <span>{copy.consentLabel}</span>
              </label>
              <SendRow copy={copy} disabled={sending || !hasText} onSend={send} pending={sending} error={phase === "error"} />
            </div>
          )}
        </div>
      )}

      {rating !== null && !high && (
        <div className="mt-6 flex flex-col gap-3 border-t border-border pt-6" data-testid="book-rating-low">
          {phase === "sent" ? (
            <p role="status" className="text-sm font-medium text-accent-dark">
              {copy.thanksLow}
            </p>
          ) : (
            <>
              <label htmlFor={commentId} className="text-base font-semibold text-ink">
                {copy.lowLead}
              </label>
              <textarea
                id={commentId}
                value={comment}
                maxLength={COMMENT_MAX}
                onChange={(e) => setComment(e.target.value)}
                placeholder={copy.lowPlaceholder}
                rows={3}
                className="w-full rounded-lg border border-border bg-cream p-3 text-sm text-ink focus:border-accent focus:outline-none"
              />
              <p className="text-xs text-ink/70">{copy.lowNote}</p>
              <SendRow copy={copy} disabled={sending || !hasText} onSend={send} pending={sending} error={phase === "error"} />
            </>
          )}
        </div>
      )}
    </section>
  );
}

function SendRow({ copy, disabled, onSend, pending, error }: { copy: BookFeedbackCopy; disabled: boolean; onSend: () => void; pending: boolean; error: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <button
        type="button"
        onClick={onSend}
        disabled={disabled}
        className="min-h-11 rounded-lg bg-accent-dark px-5 text-sm font-semibold text-white transition-colors hover:bg-accent disabled:opacity-40"
      >
        {pending ? copy.sending : copy.send}
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {copy.error}
        </p>
      )}
    </div>
  );
}
