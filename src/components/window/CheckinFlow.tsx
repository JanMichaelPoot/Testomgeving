"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { saveCheckin } from "@/app/terugkoppeling/actions";
import { FriendCodeList, type FriendShare } from "@/components/window/FriendCodeList";
import { CHECKIN_ANSWERS, CHECKIN_COMMENT_MAX, type CheckinAnswer } from "@/lib/checkin";
import type { CheckinCopy } from "@/lib/i18n/checkin";
import type { BookFeedbackCopy } from "@/lib/i18n/bookFeedback";
import { trackEvent } from "@/lib/posthog/client";
import { cn } from "@/lib/utils";

export interface CheckinFlowProps {
  token: string;
  copy: CheckinCopy["page"];
  /** The friend-code lines (shared with the rating block under the book). */
  friendCopy: BookFeedbackCopy;
  initialAnswer: CheckinAnswer | null;
  initialComment: string;
  initialConsent: boolean;
  /** The book, for "back to your book"; null when it cannot be built. */
  bookHref: string | null;
  friends: FriendShare[];
  friendAmount: string;
  friendDate: string;
}

// The page behind the three buttons of the check-in mail (Step 243). Opening it with an answer records that answer (once, from the browser: a mail scanner that only
// fetches the page does not run it, so a link that is merely checked cannot answer for the buyer). The three answers are there to change it. "Done" asks for one sentence
// that may be shown on the site (with consent) and shows the friend codes, "planned" points back to the book, "not" asks what held the buyer back (never shown).
export function CheckinFlow({ token, copy, friendCopy, initialAnswer, initialComment, initialConsent, bookHref, friends, friendAmount, friendDate }: CheckinFlowProps) {
  const [answer, setAnswer] = useState<CheckinAnswer | null>(initialAnswer);
  const [comment, setComment] = useState(initialComment);
  const [consent, setConsent] = useState(initialConsent);
  const [phase, setPhase] = useState<"idle" | "sent" | "error">(initialComment.trim() !== "" ? "sent" : "idle");
  const [sending, setSending] = useState(false);
  const [, startTransition] = useTransition();
  const commentId = useId();
  const recorded = useRef(false);

  // The answer from the mail's button is recorded once, when the page has really been opened in a browser.
  useEffect(() => {
    if (recorded.current || !initialAnswer) return;
    recorded.current = true;
    void saveCheckin(token, { answer: initialAnswer })
      .then((r) => r.ok)
      .catch(() => false)
      .then((stored) => trackEvent("checkin_answered", { choice: initialAnswer, stored }));
  }, [token, initialAnswer]);

  function choose(next: CheckinAnswer) {
    if (next === answer) return;
    setAnswer(next);
    if (next !== "done") setConsent(false);
    if (phase === "error") setPhase("idle");
    startTransition(async () => {
      let stored = false;
      try {
        stored = (await saveCheckin(token, { answer: next })).ok;
      } catch {
        stored = false;
      }
      trackEvent("checkin_answered", { choice: next, stored });
    });
  }

  const hasText = comment.trim() !== "";
  function send() {
    if (!answer || !hasText) return;
    setSending(true);
    startTransition(async () => {
      let stored = false;
      try {
        stored = (await saveCheckin(token, { answer, comment, quoteConsent: answer === "done" && consent })).ok;
      } catch {
        stored = false;
      }
      trackEvent("checkin_comment_sent", { choice: answer, has_comment: true, quote_consent: answer === "done" && consent, stored });
      setPhase(stored ? "sent" : "error");
      setSending(false);
    });
  }

  const labels: Record<CheckinAnswer, string> = { done: copy.done, planned: copy.planned, not: copy.not };

  return (
    <div className="flex flex-col gap-6">
      <div role="group" aria-label={copy.switchLabel} className="flex flex-col gap-2" data-testid="checkin-answers">
        {CHECKIN_ANSWERS.map((a) => (
          <button
            key={a}
            type="button"
            aria-pressed={answer === a}
            onClick={() => choose(a)}
            data-testid={`checkin-${a}`}
            className={cn(
              "min-h-12 rounded-lg border px-4 py-2.5 text-left text-[15px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-gold/35",
              answer === a ? "border-accent-dark bg-accent-dark text-paper" : "border-border bg-paper text-ink hover:border-accent-dark",
            )}
          >
            {labels[a]}
          </button>
        ))}
      </div>

      {answer === "done" && (
        <div className="flex flex-col gap-5 border-t border-border pt-6" data-testid="checkin-done-panel">
          <p className="font-serif text-2xl leading-snug text-ink">{copy.doneHeading}</p>
          {phase === "sent" ? (
            <p role="status" className="text-sm font-medium text-accent-dark">
              {copy.thanks}
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              <label htmlFor={commentId} className="text-sm font-semibold text-ink">
                {copy.doneAsk}
              </label>
              <textarea
                id={commentId}
                value={comment}
                maxLength={CHECKIN_COMMENT_MAX}
                onChange={(e) => setComment(e.target.value)}
                placeholder={copy.donePlaceholder}
                rows={3}
                className="w-full rounded-lg border border-border bg-cream p-3 text-sm text-ink focus:border-accent focus:outline-none"
              />
              <label className="flex items-start gap-2.5 text-sm text-ink/80">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 accent-accent-dark" />
                <span>{copy.consent}</span>
              </label>
              <SendRow copy={copy} disabled={sending || !hasText} onSend={send} sending={sending} error={phase === "error"} />
            </div>
          )}
          {friends.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-base text-ink">{friendCopy.friendLead.replace("{amount}", friendAmount)}</p>
              <FriendCodeList friends={friends} copy={friendCopy} amount={friendAmount} date={friendDate} onShare={() => trackEvent("checkin_friend_code_shared", { choice: "done" })} />
            </div>
          )}
        </div>
      )}

      {answer === "planned" && (
        <div className="flex flex-col gap-4 border-t border-border pt-6" data-testid="checkin-planned-panel">
          <p className="font-serif text-2xl leading-snug text-ink">{copy.plannedHeading}</p>
          <p className="text-base leading-relaxed text-ink/80">{copy.plannedBody}</p>
          {bookHref && (
            <Link
              href={bookHref}
              className="inline-flex min-h-12 items-center justify-center self-start rounded-lg bg-accent-dark px-6 text-sm font-semibold text-white transition-colors hover:bg-accent"
            >
              {copy.toBook}
            </Link>
          )}
        </div>
      )}

      {answer === "not" && (
        <div className="flex flex-col gap-3 border-t border-border pt-6" data-testid="checkin-not-panel">
          <p className="font-serif text-2xl leading-snug text-ink">{copy.notHeading}</p>
          {phase === "sent" ? (
            <p role="status" className="text-sm font-medium text-accent-dark">
              {copy.thanks}
            </p>
          ) : (
            <>
              <label htmlFor={commentId} className="text-sm font-semibold text-ink">
                {copy.notAsk}
              </label>
              <textarea
                id={commentId}
                value={comment}
                maxLength={CHECKIN_COMMENT_MAX}
                onChange={(e) => setComment(e.target.value)}
                placeholder={copy.notPlaceholder}
                rows={3}
                className="w-full rounded-lg border border-border bg-cream p-3 text-sm text-ink focus:border-accent focus:outline-none"
              />
              <p className="text-xs text-ink/70">{copy.notNote}</p>
              <SendRow copy={copy} disabled={sending || !hasText} onSend={send} sending={sending} error={phase === "error"} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SendRow({ copy, disabled, onSend, sending, error }: { copy: CheckinCopy["page"]; disabled: boolean; onSend: () => void; sending: boolean; error: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <button type="button" onClick={onSend} disabled={disabled} className="min-h-11 rounded-lg bg-accent-dark px-5 text-sm font-semibold text-white transition-colors hover:bg-accent disabled:opacity-40">
        {sending ? copy.sending : copy.send}
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {copy.error}
        </p>
      )}
    </div>
  );
}
