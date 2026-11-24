import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseStore } from "@/lib/discountCode";
import { sendRewardEmail } from "@/lib/email/reward";
import { rewardReferrer, type RewardOutcome } from "@/lib/referralReward";
import { siteUrl } from "@/lib/siteUrl";

// The real parts for src/lib/referralReward.ts: the database, and the mail service. Called by the Stripe webhook once a payment is confirmed and its code is used up.
// Never throws, and logs what happened as one line ("event":"referral_reward") with no address in it.
export async function rewardReferrerForOrder(supabase: SupabaseClient, stripeSessionId: string, redeemerEmails: (string | null | undefined)[]): Promise<RewardOutcome> {
  const outcome = await rewardReferrer(
    {
      store: supabaseStore(supabase),
      async findReferrer(paymentId) {
        const [{ data: pay }, { data: plan }] = await Promise.all([
          supabase.from("payments").select("order_number").eq("id", paymentId).maybeSingle(),
          supabase.from("window_plans").select("recipient_email, language").eq("payment_id", paymentId).maybeSingle(),
        ]);
        if (!pay && !plan) return null;
        return {
          email: (plan as { recipient_email?: string | null } | null)?.recipient_email ?? null,
          language: (plan as { language?: string } | null)?.language === "en" ? "en" : "nl",
          orderNumber: (pay as { order_number?: string | null } | null)?.order_number ?? null,
        };
      },
      async sendMail(mail) {
        await sendRewardEmail({ ...mail, siteUrl: siteUrl() });
      },
    },
    stripeSessionId,
    redeemerEmails,
  );
  // "none" is the normal case for most orders (they used no friend code): only a buyer who used their own code is worth a line.
  if (outcome.status !== "none" || outcome.reason === "self") {
    const line = JSON.stringify({
      level: outcome.status === "granted" || outcome.status === "none" ? "info" : "error",
      event: "referral_reward",
      at: new Date().toISOString(),
      status: outcome.status,
      reason: "reason" in outcome ? outcome.reason.slice(0, 200) : undefined,
    });
    if (outcome.status === "granted" || outcome.status === "none") console.log(line);
    else console.error(line);
  }
  return outcome;
}
