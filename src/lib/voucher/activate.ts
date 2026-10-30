import { siteUrl as getSiteUrl } from "@/lib/siteUrl";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import { renderGiftCardPdf } from "@/lib/pdf/giftCard";
import { sendVoucherEmail } from "@/lib/email/voucher";
import { trackServerEvent } from "@/lib/posthog/server";
import { activateVoucher, claimVoucherEmail, releaseVoucherEmail, setBuyerEmailIfEmpty, type VoucherRow } from "@/lib/voucher/store";

// What happens when a voucher has been paid for. Reached from two places that can fire at the same moment, and both are safe: the page the
// giver lands on after Stripe, and the Stripe webhook (which also covers a giver who closes the tab before coming back).

export type ActivationResult = { state: "unpaid" } | { state: "unknown" } | { state: "ready"; voucher: VoucherRow };

export function siteHost(): string {
  try {
    return new URL(getSiteUrl()).host.replace(/^www\./, "");
  } catch {
    return "windowinto.nl";
  }
}

export function redeemUrlFor(code: string): string {
  return `${getSiteUrl()}/cadeau/${code}`;
}

/** The card as PDF bytes for a stored voucher. */
export async function cardPdfFor(voucher: VoucherRow, format: "a5" | "a6" = "a5"): Promise<Uint8Array> {
  return renderGiftCardPdf({
    code: voucher.code,
    locale: voucher.locale,
    recipientName: voucher.recipient_name,
    giverName: voucher.giver_name,
    message: voucher.message,
    expiresAt: new Date(voucher.expires_at ?? Date.now()),
    host: siteHost(),
    format,
  });
}

/** Sends the voucher e-mail once; a failure empties the claim again, so the next visit tries again. Never throws. */
export async function ensureVoucherEmail(voucher: VoucherRow, fallbackEmail: string | null): Promise<boolean> {
  if (voucher.email_sent_at || voucher.status === "void" || !voucher.expires_at) return !!voucher.email_sent_at;
  const supabase = createServiceRoleClient();
  const to = voucher.buyer_email || fallbackEmail;
  if (!to) return false;
  if (!voucher.buyer_email && fallbackEmail) await setBuyerEmailIfEmpty(supabase, voucher.id, fallbackEmail);
  if (!(await claimVoucherEmail(supabase, voucher.id))) return true;
  try {
    const { data: payment } = voucher.payment_id
      ? await supabase.from("payments").select("order_number, amount, currency, created_at").eq("id", voucher.payment_id).maybeSingle()
      : { data: null };
    await sendVoucherEmail({
      to,
      locale: voucher.locale,
      code: voucher.code,
      recipientName: voucher.recipient_name,
      expiresAt: new Date(voucher.expires_at),
      redeemUrl: redeemUrlFor(voucher.code),
      readyUrl: `${getSiteUrl()}/cadeaubon/klaar?checkout_session_id=${voucher.stripe_checkout_id ?? ""}`,
      order: {
        orderNumber: payment?.order_number ?? "—",
        amountCents: payment?.amount ?? voucher.amount_cents,
        currency: payment?.currency ?? voucher.currency,
        orderDate: new Date(payment?.created_at ?? voucher.created_at),
      },
      cardPdf: await cardPdfFor(voucher),
    });
    return true;
  } catch (err) {
    console.error("WINDOW: could not send the gift voucher e-mail:", err);
    await releaseVoucherEmail(supabase, voucher.id);
    return false;
  }
}

/**
 * Called with a Stripe Checkout session id: if Stripe says it is paid, the pending voucher becomes active (once) and its e-mail goes out
 * (once). Asking again, from any place, is harmless.
 */
export async function activateAfterPayment(checkoutSessionId: string): Promise<ActivationResult> {
  const checkout = await getStripe().checkout.sessions.retrieve(checkoutSessionId);
  if (checkout.payment_status !== "paid") return { state: "unpaid" };
  const supabase = createServiceRoleClient();
  const result = await activateVoucher(supabase, checkoutSessionId);
  if (!result) return { state: "unknown" };
  let voucher = result.voucher;
  if (result.justActivated) {
    // One count per voucher: the server event of the purchase (its own, because the redeeming of it is not a payment).
    void trackServerEvent("gift_voucher_purchased", { amount_cents: voucher.amount_cents, price_variant: voucher.price_variant ?? "none" }, voucher.id);
  }
  const email = checkout.customer_details?.email ?? null;
  const sent = await ensureVoucherEmail(voucher, email);
  if (sent && !voucher.email_sent_at) voucher = { ...voucher, email_sent_at: new Date().toISOString() };
  return { state: "ready", voucher };
}
