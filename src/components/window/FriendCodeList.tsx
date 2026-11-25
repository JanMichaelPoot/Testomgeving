"use client";

export interface FriendShare {
  code: string;
  /** WhatsApp with the message and the link ready, built on the server. */
  whatsappUrl: string;
}

export interface FriendCodeListCopy {
  friendRow: string;
  friendSend: string;
  friendReward: string;
  friendValid: string;
}

// The friend codes of an order with one tap to WhatsApp each, the reward line and the validity line (Step 238/239). Shared by the rating block under the book (Step 241)
// and the check-in page (Step 243): both show it at the moment the buyer is happiest. What counts as a share is the caller's (`onShare`).
export function FriendCodeList({ friends, copy, amount, date, onShare }: { friends: FriendShare[]; copy: FriendCodeListCopy; amount: string; date: string; onShare: () => void }) {
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-2">
        {friends.map((f, i) => (
          <li key={f.code} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg border border-border bg-cream px-4 py-2.5">
            <span className="text-sm text-ink/70">{copy.friendRow.replace("{n}", String(i + 1))}</span>
            <span className="font-mono text-sm font-semibold tracking-wide text-ink">{f.code}</span>
            <a
              href={f.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onShare}
              className="inline-flex min-h-11 items-center text-sm font-semibold text-accent-dark underline underline-offset-2 hover:text-accent"
            >
              {copy.friendSend} →
            </a>
          </li>
        ))}
      </ul>
      <p className="text-sm text-ink/75">{copy.friendReward.replace("{amount}", amount)}</p>
      <p className="text-xs text-ink/70">{copy.friendValid.replace("{date}", date)}</p>
    </div>
  );
}
