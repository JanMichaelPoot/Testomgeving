import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { supabaseStore } from "@/lib/discountCode";
import { rewardReferrerForOrder } from "@/lib/referralRewardLive";

// Payment bookkeeping only. Generating the actual Window Plan content
// (steps, PDF, email) happens on the /plan screen — a separate build block.
export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    return NextResponse.json(
      {
        error: `Webhook signature verification failed: ${
          err instanceof Error ? err.message : "unknown error"
        }`,
      },
      { status: 400 }
    );
  }

  const supabase = createServiceRoleClient();

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object as Stripe.Checkout.Session;

      await supabase
        .from("payments")
        .update({ status: "succeeded" })
        .eq("stripe_payment_id", session.id);

      // The discount code of this order (if it used one) is used up for good now that the payment is confirmed. Never a reason to fail the webhook.
      try {
        await supabaseStore(supabase).redeemForOrder(session.id, new Date());
      } catch (err) {
        console.error("WINDOW: could not use up the discount code of a paid order:", err);
      }

      // If that code was one a buyer passed on to this friend (Step 239), the buyer gets a code of their own, by mail. Once per friend code, never for the buyer themselves, and
      // never a reason to fail the webhook: it answers with what happened and logs it.
      try {
        await rewardReferrerForOrder(supabase, session.id, [session.metadata?.delivery_email, session.customer_details?.email, session.customer_email]);
      } catch (err) {
        console.error("WINDOW: the reward for a friend's order failed:", err instanceof Error ? err.message : err);
      }

      const sessionId = session.metadata?.session_id;
      if (sessionId) {
        await supabase
          .from("sessions")
          .update({ status: "paid" })
          .eq("id", sessionId);
      }
      break;
    }
    case "charge.refunded": {
      // A refund made in the dashboard reaches this event only if the webhook endpoint listens to it (docs/start-checklist.md).
      const charge = event.data.object as Stripe.Charge;
      if (charge.refunded && typeof charge.payment_intent === "string") {
        try {
          const sessions = await getStripe().checkout.sessions.list({ payment_intent: charge.payment_intent, limit: 1 });
          const checkoutId = sessions.data[0]?.id;
          if (checkoutId) {
            await supabase.from("payments").update({ status: "refunded" }).eq("stripe_payment_id", checkoutId);
          }
        } catch (err) {
          console.error("WINDOW: could not process a refund in the webhook:", err);
        }
      }
      break;
    }
    case "checkout.session.async_payment_failed":
    case "checkout.session.expired": {
      const session = event.data.object as Stripe.Checkout.Session;

      await supabase
        .from("payments")
        .update({ status: "failed" })
        .eq("stripe_payment_id", session.id);
      // A payment that failed or ran out lets the code go again.
      try {
        await supabaseStore(supabase).releaseForOrder(session.id);
      } catch (err) {
        console.error("WINDOW: could not release the discount code of a failed order:", err);
      }
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
