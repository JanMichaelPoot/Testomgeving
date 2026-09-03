"use server";

import { redirect } from "next/navigation";
import { getSessionId } from "@/lib/session";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import { WINDOW_PLAN_PRICE } from "@/lib/pricing";

export async function createCheckoutSession(
  ideaId: string,
  waiverConfirmed: boolean
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

  const { data: idea, error: ideaError } = await supabase
    .from("ideas")
    .select("id, session_id, title, status")
    .eq("id", ideaId)
    .single();

  if (
    ideaError ||
    !idea ||
    idea.session_id !== sessionId ||
    idea.status !== "liked"
  ) {
    throw new Error("That idea could not be found in this session.");
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
            name: "Your Window Plan",
            description: idea.title,
          },
        },
        quantity: 1,
      },
    ],
    success_url: `${siteUrl}/plan?checkout_session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/converge`,
    metadata: {
      session_id: sessionId,
      idea_id: ideaId,
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
