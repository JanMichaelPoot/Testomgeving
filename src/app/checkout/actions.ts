"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionId } from "@/lib/session";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import { WINDOW_PLAN_PRICE } from "@/lib/pricing";
import { nextOrderNumber } from "@/lib/orderNumber";
import { recordTermsAcceptance, recordDigitalDeliveryConsent } from "@/lib/consent";
import { LEGAL_VERSIONS } from "@/lib/legal/versions";
import { getLocale } from "@/lib/language";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { disableDeviceMemory, enableDeviceMemory, getDeviceId } from "@/lib/discovery/historyStore";

// Model C digital sale compliance: two separate, independently required
// checkboxes on /checkout (see CheckoutPanel.tsx) — termsAccepted (the
// Algemene Voorwaarden) and digitalDeliveryConsent (immediate digital
// delivery + the resulting loss of the statutory 14-day right of
// withdrawal, combined in one checkbox because that pairing is explicitly
// allowed; see the project's compliance brief section 6). Both are
// re-validated here, server-side — the disabled button on the client is a
// UX nicety, not the actual gate, per "vertrouw nooit uitsluitend op
// frontend-validatie".
export async function createCheckoutSession(
  termsAccepted: boolean,
  digitalDeliveryConsent: boolean,
  giftRecipientEmail?: string,
  // The optional "remember what I was shown on this device" choice (fase 5): true = opt in,
  // false = opt out (and delete what was stored), undefined = leave as it is.
  rememberDevice?: boolean
) {
  const locale = await getLocale();
  const dict = getDictionary(locale).checkout;

  if (!termsAccepted) {
    throw new Error(dict.errorTermsRequired);
  }
  if (!digitalDeliveryConsent) {
    throw new Error(dict.errorConsentRequired);
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
    // A `payment=cancelled` marker so /checkout can show
    // dict.checkout.errorPaymentFailed when Stripe sends the buyer back
    // here — a declined card or an abandoned Checkout page both land here
    // (see src/app/checkout/page.tsx). A genuinely paid order never
    // reaches this URL at all.
    cancel_url: `${siteUrl}/checkout?payment=cancelled`,
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

  const orderNumber = await nextOrderNumber(supabase);

  const { data: order, error: paymentError } = await supabase
    .from("payments")
    .insert({
      session_id: sessionId,
      stripe_payment_id: checkoutSession.id,
      amount: WINDOW_PLAN_PRICE.amountCents,
      currency: WINDOW_PLAN_PRICE.currency,
      status: "pending",
      order_number: orderNumber,
      product_id: "windowinto-pdf",
      withdrawal_waiver_confirmed_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (paymentError || !order) {
    throw new Error(paymentError?.message ?? "Could not create the order.");
  }

  // Consent is written here, tied to this specific order, *before* the
  // buyer is sent to Stripe — never after payment is confirmed, and never
  // only as a client-side boolean. See the compliance brief's ordering
  // requirement ("no PDF may be delivered before the necessary consent has
  // been recorded") — PDF generation only ever happens later, once Stripe
  // confirms payment (src/app/plan/data.ts), so this ordering already
  // guarantees that.
  const hdrs = await headers();
  const ipAddress = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const userAgent = hdrs.get("user-agent") || null;

  const termsConsentText = `${dict.termsAcceptanceLabelPrefix} ${dict.termsAcceptanceLinkText} ${dict.termsAcceptanceLabelSuffix}`.trim();

  await recordTermsAcceptance(supabase, {
    orderId: order.id,
    termsVersion: LEGAL_VERSIONS.terms,
    consentText: termsConsentText,
  });

  await recordDigitalDeliveryConsent(supabase, {
    orderId: order.id,
    consentVersion: LEGAL_VERSIONS.digital_delivery_consent,
    withdrawalAcknowledgedVersion: LEGAL_VERSIONS.withdrawal_information,
    consentText: dict.digitalDeliveryConsentLabel,
    ipAddress,
    userAgent,
  });

  await supabase
    .from("sessions")
    .update({ status: "converged" })
    .eq("id", sessionId);

  // Best effort and never a reason to block a payment.
  if (rememberDevice === true) await enableDeviceMemory(supabase, sessionId);
  else if (rememberDevice === false) await disableDeviceMemory(supabase);

  redirect(checkoutSession.url);
}

// Skips Stripe entirely so the Idea Book is generated immediately, without
// a real payment. Test-mode only (see TestModeBanner.tsx) — deliberately
// does not write an order/consent trail, since no real purchase happens.
export async function skipPaymentForTesting() {
  const sessionId = await getSessionId();
  if (!sessionId) {
    throw new Error("No active session.");
  }

  // A device that already opted in keeps its memory in test mode too, the same as the
  // real checkout's switch, which starts on for such a device.
  if (await getDeviceId()) await enableDeviceMemory(createServiceRoleClient(), sessionId);

  redirect(`/plan?test_session_id=${encodeURIComponent(sessionId)}`);
}
