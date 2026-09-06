"use server";

import { redirect } from "next/navigation";
import { getSessionId } from "@/lib/session";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import { WINDOW_PLAN_PRICE } from "@/lib/pricing";

export async function createCheckoutSession(
  waiverConfirmed: boolean,
  giftRecipientEmail?: string
) {
  if (!waiverConfirmed) {
    throw new Error(
      "Please confirm you understand the withdrawal waiver before continuing."
    );
  }

  const sessionId = await getSessionId();
  if (!sessionId) {
    throw new Error("No active session.");
  }

  const supabase = createServiceRoleClient();

  const { data: intake } = await supabase
    .from("intake_answers")
    .select("id")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!intake) {
    throw new Error("That session could not be found.");
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!;

  const checkoutSession = await getStripe().checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: WINDOW_PLAN_PRICE.currency,
          unit_amount: WINDOW_PLAN_PRICE.amountCents,
          product_data: {
            name: "Your WINDOW Idea Book",
            description: "A personalized set of possibilities, made real.",
          },
        },
        quantity: 1,
      },
    ],
    success_url: `${siteUrl}/plan?checkout_session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/checkout`,
    metadata: {
      session_id: sessionId,
      // The buyer still pays and gets Stripe's own receipt at their own
      // email; this only redirects where *our* delivery email (the PDF +
      // the /plan link) goes. Empty string, not omitted, so a later read
      // never has to distinguish "no metadata" from "not a gift".
      gift_recipient_email: giftRecipientEmail?.trim() || "",
    },
  });

  if (!checkoutSession.url) {
    throw new Error("Could not start checkout.");
  }

  const { error: paymentError } = await supabase.from("payments").insert({
    session_id: sessionId,
    stripe_payment_id: checkoutSession.id,
    amount: WINDOW_PLAN_PRICE.amountCents,
    currency: WINDOW_PLAN_PRICE.currency,
    status: "pending",
    withdrawal_waiver_confirmed_at: new Date().toISOString(),
  });

  if (paymentError) {
    throw new Error(paymentError.message);
  }

  await supabase
    .from("sessions")
    .update({ status: "converged" })
    .eq("id", sessionId);

  redirect(checkoutSession.url);
}

// Skips Stripe entirely so the Idea Book is generated immediately, without
// a real payment.
export async function skipPaymentForTesting() {
  const sessionId = await getSessionId();
  if (!sessionId) {
    throw new Error("No active session.");
  }

  redirect(`/plan?test_session_id=${encodeURIComponent(sessionId)}`);
}
