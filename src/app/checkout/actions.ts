"use server";

import { redirect } from "next/navigation";
import { getSessionId } from "@/lib/session";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import { WINDOW_PLAN_PRICE } from "@/lib/pricing";

export async function createCheckoutSession(waiverConfirmed: boolean) {
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

// Test-only bypass: skips Stripe entirely so the Idea Book can be reviewed
// during the test phase without a real payment. Refuses outside
// development regardless of how it's reached.
export async function skipPaymentForTesting() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("The test bypass is not available in production.");
  }

  const sessionId = await getSessionId();
  if (!sessionId) {
    throw new Error("No active session.");
  }

  redirect(`/plan?test_session_id=${sessionId}`);
}
