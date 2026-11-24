import { DISCOUNT_CENTS, VALID_DAYS, generateCode, type DiscountStore } from "@/lib/discountCode";

// The reward for the buyer (Step 239): when a friend has paid for a book with one of the friend codes (Step 238), the buyer who passed that code on gets a code of EUR 2.50 of their
// own for a next book, by e-mail. Called when a payment is confirmed (the Stripe webhook), after the friend's code has been used up. Everything is injected, so the rules are
// tested without a database or a mail service; src/lib/referralRewardLive.ts wires the real ones.
//
//   - Once per friend code: the claim (DiscountStore.claimReward) is one atomic step, so a payment that Stripe confirms twice rewards once.
//   - Not for yourself: when the friend's own address is the buyer's (the buyer used a code they gave themselves), nothing is given. The friend code is spent either way.
//   - Never a reason to hold up a payment: this never throws; it answers with what happened, and the webhook logs it.
//   - If the reward code cannot be made, the claim is taken back so a later attempt can give it; if only the mail fails, the code exists and shows in the admin overview as not sent.

export interface Referrer {
  /** Where the book of the referring buyer was sent. */
  email: string | null;
  language: "nl" | "en";
  orderNumber: string | null;
}

export interface RewardMail {
  to: string;
  locale: "nl" | "en";
  code: string;
  amountCents: number;
  expiresAt: Date;
  orderNumber: string | null;
}

export interface RewardDeps {
  store: DiscountStore;
  findReferrer(paymentId: string): Promise<Referrer | null>;
  sendMail(mail: RewardMail): Promise<void>;
  now?: Date;
  pick?: (n: number) => number;
}

export type RewardOutcome =
  | { status: "granted"; code: string }
  /** The code was made but the buyer has no address or the mail failed: it shows in the admin overview. */
  | { status: "unmailed"; code: string; reason: string }
  | { status: "none"; reason: "no_code" | "not_rewardable" | "self" }
  | { status: "failed"; reason: string };

const norm = (email: string | null | undefined) => (email ?? "").trim().toLowerCase();

/** `redeemerEmails`: the addresses the friend ordered with (the delivery address and the one at Stripe), to tell a friend from the buyer themselves. */
export async function rewardReferrer(deps: RewardDeps, stripeSessionId: string, redeemerEmails: (string | null | undefined)[]): Promise<RewardOutcome> {
  const now = deps.now ?? new Date();
  const { store } = deps;
  let claimedId: string | null = null;
  let rewardMade = false;
  try {
    const codeId = await store.codeIdForOrder(stripeSessionId);
    if (!codeId) return { status: "none", reason: "no_code" };
    const claim = await store.claimReward(codeId, now);
    if (!claim) return { status: "none", reason: "not_rewardable" };
    claimedId = codeId;

    const referrer = await deps.findReferrer(claim.paymentId);
    const mine = norm(referrer?.email);
    if (mine && redeemerEmails.map(norm).includes(mine)) return { status: "none", reason: "self" };

    let reward: { id: string; code: string; expiresAt: Date } | null = null;
    for (let attempt = 0; attempt < 6 && !reward; attempt++) {
      const stored = await store.insert({
        code: generateCode(deps.pick),
        paymentId: claim.paymentId,
        amountCents: DISCOUNT_CENTS,
        expiresAt: new Date(now.getTime() + VALID_DAYS * 86_400_000),
        kind: "reward",
        reason: `vriend gebruikte ${claim.code}`,
      });
      if (stored !== "taken") reward = { id: stored.id, code: stored.code, expiresAt: stored.expiresAt };
    }
    if (!reward) throw new Error("no free code found");
    rewardMade = true;

    if (!referrer?.email) return { status: "unmailed", code: reward.code, reason: "no address for the buyer" };
    try {
      await deps.sendMail({ to: referrer.email, locale: referrer.language, code: reward.code, amountCents: DISCOUNT_CENTS, expiresAt: reward.expiresAt, orderNumber: referrer.orderNumber });
      await store.markMailed(reward.id, now).catch(() => {});
      return { status: "granted", code: reward.code };
    } catch (err) {
      return { status: "unmailed", code: reward.code, reason: err instanceof Error ? err.message : String(err) };
    }
  } catch (err) {
    // The reward could not be made: the claim goes back, so the same friend code can still give it later (the table without migration 0030 fails right at the claim: nothing to undo).
    if (claimedId && !rewardMade) await store.unclaimReward(claimedId).catch(() => {});
    return { status: "failed", reason: err instanceof Error ? err.message : String(err) };
  }
}
