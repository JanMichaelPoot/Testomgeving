"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { siteUrl as getSiteUrl } from "@/lib/siteUrl";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import { nextOrderNumber } from "@/lib/orderNumber";
import { recordTermsAcceptance, recordDigitalDeliveryConsent } from "@/lib/consent";
import { LEGAL_VERSIONS } from "@/lib/legal/versions";
import { getLocale } from "@/lib/language";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getGiftCopy } from "@/lib/i18n/gift";
import { getVisitorPrice } from "@/lib/visitorPrice";
import { isMissingColumnError } from "@/lib/supabase/errors";
import { cleanMessage, cleanName, isValidEmail } from "@/lib/voucher/text";
import { attachPayment, createPendingVoucher } from "@/lib/voucher/store";

export interface VoucherCheckoutInput {
  recipientName: string;
  giverName: string;
  message: string;
  /** Where the code and card go; empty = the address typed at Stripe. */
  email: string;
  termsAccepted: boolean;
  deliveryConsent: boolean;
}

// The giver pays for a voucher (improvement brief B3). The same order bookkeeping as a book (src/app/checkout/actions.ts): a session that anchors the
// order, a payments row, the two consent records written *before* the giver is sent to Stripe, and every server-side check repeated here: the
// disabled button on the page is not the gate. What differs: the product is the voucher, the price is the gift price, and nothing is
// generated: the voucher becomes active when Stripe says it is paid (src/lib/voucher/activate.ts).
export async function createVoucherCheckout(input: VoucherCheckoutInput) {
  const locale = await getLocale();
  const copy = getGiftCopy(locale).buy;
  const checkoutDict = getDictionary(locale).checkout;

  if (!input.termsAccepted) throw new Error(copy.errorTerms);
  if (!input.deliveryConsent) throw new Error(copy.errorConsent);
  const email = (input.email ?? "").trim();
  if (email && !isValidEmail(email)) throw new Error(copy.errorEmail);

  const recipientName = cleanName(input.recipientName);
  const giverName = cleanName(input.giverName);
  const message = cleanMessage(input.message);

  const supabase = createServiceRoleClient();
  const price = await getVisitorPrice("gift");

  // The session only anchors the order and its consent records: the giver does no intake.
  const { data: session, error: sessionError } = await supabase.from("sessions").insert({ status: "started" }).select("id").single();
  if (sessionError || !session) throw new Error(copy.errorGeneric);

  // Before Stripe, so a missing table (migration 0022 not run) fails here with nothing charged.
  let voucher;
  try {
    voucher = await createPendingVoucher(supabase, {
      amountCents: price.cents,
      currency: "eur",
      locale,
      giverName,
      recipientName,
      message,
      buyerSessionId: session.id,
      buyerEmail: email || null,
      priceVariant: price.variant,
    });
  } catch (err) {
    console.error("WINDOW: could not create the gift voucher; has migration 0022 been run?", err);
    throw new Error(copy.errorGeneric);
  }

  const siteUrl = getSiteUrl();
  const checkout = await getStripe().checkout.sessions.create({
    mode: "payment",
    locale: locale === "nl" ? "nl" : "en",
    line_items: [
      {
        price_data: {
          currency: "eur",
          unit_amount: price.cents,
          product_data: {
            name: locale === "nl" ? "WindowInto cadeaubon" : "WindowInto gift voucher",
            description: locale === "nl" ? "Een cadeaubon voor één persoonlijk Idea Book." : "A voucher for one personal Idea Book.",
          },
        },
        quantity: 1,
      },
    ],
    success_url: `${siteUrl}/cadeaubon/klaar?checkout_session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/cadeaubon?payment=cancelled`,
    metadata: { kind: "gift_voucher", voucher_id: voucher.id, session_id: session.id, price_variant: price.variant ?? "" },
  });
  if (!checkout.url) throw new Error(copy.errorGeneric);

  const orderNumber = await nextOrderNumber(supabase);
  const orderRow = {
    session_id: session.id,
    stripe_payment_id: checkout.id,
    amount: price.cents,
    currency: "eur",
    status: "pending" as const,
    order_number: orderNumber,
    product_id: "windowinto-gift-voucher",
    // The buyer asked for immediate delivery of the digital voucher here (the consent below); recorded like every other order.
    withdrawal_waiver_confirmed_at: new Date().toISOString(),
  };
  let { data: order, error: paymentError } = await supabase.from("payments").insert({ ...orderRow, ...(price.variant ? { price_variant: price.variant } : {}) }).select("id").single();
  if (paymentError && price.variant && isMissingColumnError(paymentError)) {
    ({ data: order, error: paymentError } = await supabase.from("payments").insert(orderRow).select("id").single());
  }
  if (paymentError || !order) {
    console.error("WINDOW: could not create the order of a gift voucher", paymentError?.message);
    throw new Error(copy.errorGeneric);
  }

  const hdrs = await headers();
  await recordTermsAcceptance(supabase, {
    orderId: order.id,
    termsVersion: LEGAL_VERSIONS.terms,
    consentText: `${checkoutDict.termsAcceptanceLabelPrefix} ${checkoutDict.termsAcceptanceLinkText} ${checkoutDict.termsAcceptanceLabelSuffix}`.trim(),
  });
  await recordDigitalDeliveryConsent(supabase, {
    orderId: order.id,
    consentVersion: LEGAL_VERSIONS.digital_delivery_consent,
    withdrawalAcknowledgedVersion: LEGAL_VERSIONS.withdrawal_information,
    // The voucher's own wording (src/lib/i18n/gift.ts); the stored hash is of this text, so what was agreed to stays provable.
    consentText: copy.consentLabel,
    ipAddress: hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
    userAgent: hdrs.get("user-agent") || null,
  });
  await attachPayment(supabase, voucher.id, checkout.id, order.id);

  redirect(checkout.url);
}
