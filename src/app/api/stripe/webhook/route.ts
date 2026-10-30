import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createServiceRoleClient } from "@/lib/supabase/server";

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

      const sessionId = session.metadata?.session_id;
      if (sessionId) {
        await supabase
          .from("sessions")
          .update({ status: "paid" })
          .eq("id", sessionId);
      }

      // A paid gift voucher becomes active here, so it works even when the giver closes the tab before the Stripe page sends them back.
      // The same function runs on that page; whichever comes first does the work, the other finds it done. Never a reason to fail the webhook.
      if (session.metadata?.kind === "gift_voucher") {
        try {
          const { activateAfterPayment } = await import("@/lib/voucher/activate");
          await activateAfterPayment(session.id);
        } catch (err) {
          console.error("WINDOW: could not activate a gift voucher from the webhook:", err);
        }
      }
      break;
    }
    case "charge.refunded": {
      // A fully refunded voucher that has not been redeemed stops working. (A redeemed one already produced a book: that is a matter for
      // a person, not for this handler.) Dashboard refunds reach this event only if the webhook endpoint listens to it; see docs/cadeaubon.md.
      const charge = event.data.object as Stripe.Charge;
      if (charge.refunded && typeof charge.payment_intent === "string") {
        try {
          const sessions = await getStripe().checkout.sessions.list({ payment_intent: charge.payment_intent, limit: 1 });
          const checkoutId = sessions.data[0]?.id;
          if (checkoutId) {
            await supabase.from("payments").update({ status: "refunded" }).eq("stripe_payment_id", checkoutId);
            const { voidVoucherForCheckout } = await import("@/lib/voucher/store");
            await voidVoucherForCheckout(supabase, checkoutId);
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
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
