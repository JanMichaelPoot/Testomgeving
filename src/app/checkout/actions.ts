"use server";

import { siteUrl as getSiteUrl } from "@/lib/siteUrl";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { prewarmBookResearch } from "@/lib/claude/prewarmResearch";
import { getSessionId } from "@/lib/session";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import type Stripe from "stripe";
import { WINDOW_PLAN_PRICE, formatPrice } from "@/lib/pricing";
import { CHECKOUT_MINUTES, checkCode, createAttemptLimiter, priceAfterDiscount, releaseCode, reserveCode, supabaseStore } from "@/lib/discountCode";
import { getVisitorPrice } from "@/lib/visitorPrice";
import { isMissingColumnError } from "@/lib/supabase/errors";
import { getOrdererGeo } from "@/lib/geo";
import { nextOrderNumber } from "@/lib/orderNumber";
import { recordTermsAcceptance, recordDigitalDeliveryConsent } from "@/lib/consent";
import { LEGAL_VERSIONS } from "@/lib/legal/versions";
import { getLocale } from "@/lib/language";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { disableDeviceMemory, enableDeviceMemory } from "@/lib/discovery/historyStore";
import { checkTestQuota } from "@/lib/testQuota";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { isRedirectError } from "@/lib/isRedirectError";
import { scrub } from "@/lib/requestError";
import { freeTestOrdersEnabled, newFreeOrderId } from "@/lib/freeTest";
import { loadCapacity, type ClosedReason } from "@/lib/capacity";

// Model C digital sale compliance: two separate, independently required
// checkboxes on /checkout (see CheckoutPanel.tsx) — termsAccepted (the
// Algemene Voorwaarden) and digitalDeliveryConsent (immediate digital
// delivery + the resulting loss of the statutory 14-day right of
// withdrawal, combined in one checkbox because that pairing is explicitly
// allowed; see the project's compliance brief section 6). Both are
// re-validated here, server-side — the disabled button on the client is a
// UX nicety, not the actual gate, per "vertrouw nooit uitsluitend op
// frontend-validatie".
// A brake on trying codes: a few tries per visitor in a few minutes (the code space is about 10^12; this only stops someone from running through it).
const allowCodeAttempt = createAttemptLimiter();

/**
 * What the book would cost with this code, for the order block: the code is checked and nothing is held yet. The price and the amount are decided here, from the
 * same functions the order uses; the page only shows them.
 */
export async function previewDiscount(
  rawCode: string,
): Promise<{ ok: true; code: string; amountLabel: string; priceLabel: string } | { ok: false; error: string }> {
  const locale = await getLocale();
  const dict = getDictionary(locale).checkout.discount;
  const sessionId = (await getSessionId()) ?? "anonymous";
  if (!allowCodeAttempt(sessionId)) return { ok: false, error: dict.errors.limit };
  const supabase = createServiceRoleClient();
  const checked = await checkCode(supabaseStore(supabase), rawCode);
  if (!checked.ok) return { ok: false, error: dict.errors[checked.reason] };
  const price = await getVisitorPrice("self");
  const final = priceAfterDiscount(price.cents, checked.amountCents);
  return { ok: true, code: checked.code, amountLabel: formatPrice(locale, price.cents - final), priceLabel: formatPrice(locale, final) };
}

// A failure the visitor can be told about (a box not ticked, a wrong code, the test limit): its message is for them, in their language.
class CheckoutFailure extends Error {}

/** The sentence for a closed pay button (src/lib/capacity.ts): the daily maximum has its own, everything else is "not taking orders for a moment". */
function capacityMessage(dict: ReturnType<typeof getDictionary>["checkout"], reason: ClosedReason | null): string {
  return reason === "daily" ? dict.capacity.daily : dict.capacity.paused;
}

/**
 * Whether an order can be started right now, for the order block to ask when it opens: a closed button with the reason is kinder than a filled-in form that is refused at the
 * end. The order itself asks again (startCheckout), this is only the early warning. The owner is never held back.
 */
export async function checkoutCapacity(): Promise<{ open: true } | { open: false; message: string }> {
  if (await isAdminAuthenticated().catch(() => false)) return { open: true };
  const status = await loadCapacity(createServiceRoleClient(), { maxAgeMs: 15_000 });
  if (status.open) return { open: true };
  return { open: false, message: capacityMessage(getDictionary(await getLocale()).checkout, status.reason) };
}

/**
 * Starts the payment, and only ever comes back with a message: success is a redirect (to Stripe, or to the book in the test phase). Every failure is an answer, not an
 * exception: in production Next.js hides the text of a thrown server-action error and reloads the page, so a visitor whose payment could not be started (live Stripe set up
 * wrongly, Stripe down) saw "something went wrong" and was back on the profile screen with nothing explained (23 Nov 2026). Now the screen stays, says nothing was charged,
 * and the real cause goes to the log as one line ("event":"checkout_start_failed") and, for the owner (logged in at /admin in this browser), is shown on the screen too.
 */
export async function createCheckoutSession(
  termsAccepted: boolean,
  digitalDeliveryConsent: boolean,
  rememberDevice?: boolean,
  deliveryEmail?: string,
  followUpConsent?: boolean,
  discountCode?: string,
): Promise<{ ok: false; error: string }> {
  try {
    return await startCheckout(termsAccepted, digitalDeliveryConsent, rememberDevice, deliveryEmail, followUpConsent, discountCode);
  } catch (err) {
    // The redirect (to Stripe, or to the book) is how a good start ends: it must reach Next.js.
    if (isRedirectError(err) || (err instanceof Error && err.message === "NEXT_REDIRECT")) throw err;
    if (err instanceof CheckoutFailure) return { ok: false, error: err.message };
    const dict = getDictionary(await getLocale()).checkout;
    const e = err as { name?: string; message?: string; type?: string; code?: string; statusCode?: number };
    console.error(
      JSON.stringify({
        level: "error",
        event: "checkout_start_failed",
        at: new Date().toISOString(),
        name: e?.name ?? "Error",
        stripeType: e?.type ?? null,
        stripeCode: e?.code ?? null,
        status: e?.statusCode ?? null,
        message: scrub(String(e?.message ?? err)).slice(0, 300),
      }),
    );
    const owner = await isAdminAuthenticated().catch(() => false);
    return { ok: false, error: owner ? `${dict.errorStartFailed} [${e?.type ?? e?.name ?? "Error"}: ${scrub(String(e?.message ?? err)).slice(0, 200)}]` : dict.errorStartFailed };
  }
}

async function startCheckout(
  termsAccepted: boolean,
  digitalDeliveryConsent: boolean,
  // The optional "remember what I was shown on this device" choice (fase 5): true = opt in,
  // false = opt out (and delete what was stored), undefined = leave as it is.
  rememberDevice?: boolean,
  // Where the book is sent: required (since the improvement brief of 11 Nov 2026), checked again here. It is also the address Stripe is given.
  deliveryEmail?: string,
  // The optional consent to one follow-up e-mail after six weeks (improvement brief B5). Never assumed.
  followUpConsent?: boolean,
  // A one-time discount code from an earlier order (src/lib/discountCode.ts): checked and held here, for this order only.
  discountCode?: string,
): Promise<never> {
  const locale = await getLocale();
  const dict = getDictionary(locale).checkout;

  if (!termsAccepted) {
    throw new CheckoutFailure(dict.errorTermsRequired);
  }
  if (!digitalDeliveryConsent) {
    throw new CheckoutFailure(dict.errorConsentRequired);
  }
  const email = (deliveryEmail ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new CheckoutFailure(dict.errorEmailRequired);
  }

  const sessionId = await getSessionId();
  if (!sessionId) {
    throw new CheckoutFailure(dict.errorGeneric);
  }

  const supabase = createServiceRoleClient();

  // The capacity brake (src/lib/capacity.ts): no money is taken for a book that cannot be made. Asked fresh, never from the page's cache; the owner is never held back.
  if (!(await isAdminAuthenticated().catch(() => false))) {
    const capacity = await loadCapacity(supabase);
    if (!capacity.open) {
      console.warn(JSON.stringify({ level: "warn", event: "checkout_blocked_capacity", at: new Date().toISOString(), reason: capacity.reason, startedToday: capacity.startedToday, limit: capacity.limit }));
      throw new CheckoutFailure(capacityMessage(dict, capacity.reason));
    }
  }

  // Test phase limit (src/lib/testQuota.ts): checked again here, the page is not the gate.
  if (!(await checkTestQuota(supabase, sessionId)).allowed) {
    throw new CheckoutFailure(getDictionary(locale).venster.testLimit.title);
  }

  const { data: intake } = await supabase
    .from("intake_answers")
    .select("id")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!intake) {
    throw new CheckoutFailure(dict.errorGeneric);
  }

  const siteUrl = getSiteUrl();

  // The price is decided here, from the visitor's own cookie (src/lib/priceTest.ts), never taken from the page: what is charged is what
  // the same function showed. While the price test is off this is the normal price and the variant is null.
  const price = await getVisitorPrice("self");

  // A discount code is held for this order before anything is made at Stripe (two orders cannot spend one code), and let go again when the order cannot be started.
  const store = supabaseStore(supabase);
  let discount: { id: string; amountCents: number } | null = null;
  if ((discountCode ?? "").trim()) {
    const held = await reserveCode(store, discountCode!);
    if (!held.ok) throw new CheckoutFailure(dict.discount.errors[held.reason]);
    discount = { id: held.id, amountCents: held.amountCents };
  }
  const finalCents = discount ? priceAfterDiscount(price.cents, discount.amountCents) : price.cents;
  const discountedCents = price.cents - finalCents;

  // Test phase (src/lib/freeTest.ts): no Stripe at all, the order gets an id of its own and the book starts straight away.
  const freeId = freeTestOrdersEnabled() ? newFreeOrderId() : null;

  let checkoutSession: Stripe.Checkout.Session | null = null;
  try {
  if (!freeId) {
  // The discount is a Stripe coupon of its own (once, for this order): Stripe's page and the receipt then show the full price, the discount and what is paid.
  const coupon = discountedCents > 0 ? await getStripe().coupons.create({ amount_off: discountedCents, currency: WINDOW_PLAN_PRICE.currency, duration: "once", max_redemptions: 1, name: dict.discount.stripeName }) : null;
  checkoutSession = await getStripe().checkout.sessions.create({
    mode: "payment",
    // Stripe's own page in the visitor's language. No payment_method_types on purpose: Checkout then offers every method that is
    // switched on in the Stripe dashboard for EUR (iDEAL and cards; see docs/live-gaan.md), so the code never needs to change for that.
    locale: locale === "nl" ? "nl" : "en",
    line_items: [
      {
        price_data: {
          currency: WINDOW_PLAN_PRICE.currency,
          unit_amount: price.cents,
          product_data: {
            name: "Your WindowInto Idea Book",
            description: "A personalized set of possibilities, made real.",
          },
        },
        quantity: 1,
      },
    ],
    // The address the buyer gave us is the one Stripe uses for the receipt too (and it is not editable there: one address for everything).
    customer_email: email,
    ...(coupon ? { discounts: [{ coupon: coupon.id }], expires_at: Math.floor(Date.now() / 1000) + CHECKOUT_MINUTES * 60 } : {}),
    success_url: `${siteUrl}/plan?checkout_session_id={CHECKOUT_SESSION_ID}`,
    // A `payment=cancelled` marker so /checkout can show
    // dict.checkout.errorPaymentFailed when Stripe sends the buyer back
    // here — a declined card or an abandoned Checkout page both land here
    // (see src/app/checkout/page.tsx). A genuinely paid order never
    // reaches this URL at all.
    cancel_url: `${siteUrl}/checkout?payment=cancelled`,
    metadata: {
      session_id: sessionId,
      // For a buyer who wants the book in another inbox than the one typed at Stripe (the Stripe receipt stays at Stripe's address).
      // Empty string, not omitted, so a later read never has to distinguish "no metadata" from "not set".
      delivery_email: email,
      // "1" only when the buyer switched the follow-up e-mail on; the address is chosen later, from where the book is sent.
      followup_consent: followUpConsent === true ? "1" : "",
      price_variant: price.variant ?? "",
      discount_code_id: discount?.id ?? "",
    },
  });
  }
  } catch (err) {
    if (discount) await releaseCode(store, discount.id);
    throw err;
  }

  const stripeUrl = checkoutSession?.url ?? null;
  if (!freeId && !stripeUrl) {
    if (discount) await releaseCode(store, discount.id);
    throw new Error("Could not start checkout.");
  }

  const orderNumber = await nextOrderNumber(supabase);

  const orderRow = {
    session_id: sessionId,
    stripe_payment_id: freeId ?? checkoutSession!.id,
    amount: freeId ? 0 : finalCents,
    currency: WINDOW_PLAN_PRICE.currency,
    status: freeId ? ("succeeded" as const) : ("pending" as const),
    order_number: orderNumber,
    product_id: "windowinto-pdf",
    withdrawal_waiver_confirmed_at: new Date().toISOString(),
  };
  // The two columns of migration 0022 are only written when there is something to record, and an order is never lost because that
  // migration has not been run: without the columns it is stored without them (the follow-up then also stays off, see plan/data.ts).
  // Migration 0023: where the order was placed from (country and place the host derives from the connection; never the IP address).
  const geo = await getOrdererGeo();
  const extras = {
    ...(price.variant ? { price_variant: price.variant } : {}),
    ...(discount ? { discount_code_id: discount.id, discount_cents: discountedCents } : {}),
    ...(geo ? { ip_country: geo.country, ip_city: geo.city || null } : {}),
    ...(followUpConsent === true ? { followup_consent_at: new Date().toISOString() } : {}),
  };
  let { data: order, error: paymentError } = await supabase.from("payments").insert({ ...orderRow, ...extras }).select("id").single();
  if (paymentError && Object.keys(extras).length > 0 && isMissingColumnError(paymentError)) {
    console.error("WINDOW: payments.price_variant / followup_consent_at / ip_country missing; have migrations 0022 and 0023 been run? Storing the order without them.");
    ({ data: order, error: paymentError } = await supabase.from("payments").insert(orderRow).select("id").single());
  }

  if (paymentError || !order) {
    if (discount) await releaseCode(store, discount.id);
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

  // A free test order has no Stripe payment to confirm, so its code is used up now; at Stripe the webhook does it when the payment is confirmed.
  if (freeId && discount) await store.redeemForOrder(freeId, new Date());

  if (freeId) {
    // The address the book is sent to is kept with the account, as it is after a Stripe payment (plan/data.ts reads it back from there).
    const { data: user } = await supabase.from("users").upsert({ email }, { onConflict: "email" }).select("id").single();
    if (user) await supabase.from("sessions").update({ user_id: user.id }).eq("id", sessionId);
    // No prewarm: nobody is paying meanwhile, so the real generation starts at once and would only search the same places twice.
    redirect(`/plan?checkout_session_id=${freeId}`);
  }

  // While the buyer pays at Stripe, the search for real places already runs (src/lib/claude/prewarmResearch.ts): after the order, the
  // consents and the device memory are stored, so the real generation later reads every answer from the cache.
  after(() => prewarmBookResearch(supabase, sessionId));

  redirect(stripeUrl!);
}
