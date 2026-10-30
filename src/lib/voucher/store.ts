import { randomBytes } from "node:crypto";
import type { createServiceRoleClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import { expiryFrom, generateCode, normalizeCode } from "@/lib/voucher/code";

type ServiceRoleClient = ReturnType<typeof createServiceRoleClient>;
export type VoucherRow = Database["public"]["Tables"]["gift_vouchers"]["Row"];

// Database side of the gift voucher (migration 0022). Every state change is a single conditional UPDATE, so two requests at the same
// moment (the success page and the Stripe webhook; two people redeeming the same code) cannot both win.

const UNIQUE_VIOLATION = "23505";

/** A secret that opens the finished book of a redeemed voucher; separate from the code, which the giver also knows. */
export function newPlanToken(): string {
  return randomBytes(24).toString("hex");
}

export interface NewVoucher {
  amountCents: number;
  currency: string;
  locale: "nl" | "en";
  giverName: string;
  recipientName: string;
  message: string;
  buyerSessionId: string;
  buyerEmail: string | null;
  priceVariant: string | null;
}

/** A pending voucher with a fresh unique code. Retries on the (very unlikely) collision of two codes. */
export async function createPendingVoucher(supabase: ServiceRoleClient, input: NewVoucher, makeCode: () => string = generateCode): Promise<VoucherRow> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await supabase
      .from("gift_vouchers")
      .insert({
        code: makeCode(),
        status: "pending",
        amount_cents: input.amountCents,
        currency: input.currency,
        locale: input.locale,
        giver_name: input.giverName || null,
        recipient_name: input.recipientName || null,
        message: input.message || null,
        buyer_session_id: input.buyerSessionId,
        buyer_email: input.buyerEmail,
        price_variant: input.priceVariant,
      })
      .select("*")
      .single();
    if (!error && data) return data;
    if (error?.code !== UNIQUE_VIOLATION) throw new Error(error?.message ?? "Could not create the voucher.");
  }
  throw new Error("Could not create a unique voucher code.");
}

export async function findVoucherByCode(supabase: ServiceRoleClient, input: string | null | undefined): Promise<VoucherRow | null> {
  const code = normalizeCode(input);
  if (!code) return null;
  const { data } = await supabase.from("gift_vouchers").select("*").eq("code", code).maybeSingle();
  return data ?? null;
}

export async function findVoucherByCheckoutId(supabase: ServiceRoleClient, checkoutSessionId: string): Promise<VoucherRow | null> {
  const { data } = await supabase.from("gift_vouchers").select("*").eq("stripe_checkout_id", checkoutSessionId).maybeSingle();
  return data ?? null;
}

export async function findVoucherByPlanToken(supabase: ServiceRoleClient, token: string): Promise<VoucherRow | null> {
  if (!/^[0-9a-f]{48}$/.test(token)) return null;
  const { data } = await supabase.from("gift_vouchers").select("*").eq("plan_token", token).maybeSingle();
  return data ?? null;
}

/** Ties the voucher to its Stripe Checkout session and order, right after those exist. */
export async function attachPayment(supabase: ServiceRoleClient, voucherId: string, stripeCheckoutId: string, paymentId: string): Promise<void> {
  const { error } = await supabase.from("gift_vouchers").update({ stripe_checkout_id: stripeCheckoutId, payment_id: paymentId }).eq("id", voucherId);
  if (error) throw new Error(`Could not attach the payment to the voucher: ${error.message}`);
}

/**
 * Paid: pending becomes active and the twelve months start. Returns the voucher and whether *this* call activated it, so only that
 * call sends the e-mail (the success page and the webhook both get here; one of them loses the race and gets `false`).
 */
export async function activateVoucher(supabase: ServiceRoleClient, stripeCheckoutId: string, now: Date = new Date()): Promise<{ voucher: VoucherRow; justActivated: boolean } | null> {
  const { data: won } = await supabase
    .from("gift_vouchers")
    .update({ status: "active", activated_at: now.toISOString(), expires_at: expiryFrom(now).toISOString() })
    .eq("stripe_checkout_id", stripeCheckoutId)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();
  if (won) return { voucher: won, justActivated: true };
  const existing = await findVoucherByCheckoutId(supabase, stripeCheckoutId);
  return existing ? { voucher: existing, justActivated: false } : null;
}

/**
 * Redeems a voucher for a session: single use, atomic. Returns the updated voucher, or null when it was not redeemable at this
 * moment (already used, expired, not paid, void).
 */
export async function claimVoucher(supabase: ServiceRoleClient, voucherId: string, sessionId: string, now: Date = new Date()): Promise<VoucherRow | null> {
  const { data } = await supabase
    .from("gift_vouchers")
    .update({ status: "redeemed", redeemed_at: now.toISOString(), redeemed_session_id: sessionId, plan_token: newPlanToken() })
    .eq("id", voucherId)
    .eq("status", "active")
    .gt("expires_at", now.toISOString())
    .select("*")
    .maybeSingle();
  return data ?? null;
}

/** Undoes a claim whose follow-up failed (the order row could not be written), so the code is not burnt for nothing. */
export async function releaseClaim(supabase: ServiceRoleClient, voucherId: string): Promise<void> {
  await supabase
    .from("gift_vouchers")
    .update({ status: "active", redeemed_at: null, redeemed_session_id: null, plan_token: null })
    .eq("id", voucherId)
    .eq("status", "redeemed");
}

/**
 * Takes the right to send the voucher e-mail: sets email_sent_at only if it is still empty, so the success page and the webhook cannot
 * both send it. If the send then fails, `releaseVoucherEmail` empties it again so a later visit can retry.
 */
export async function claimVoucherEmail(supabase: ServiceRoleClient, voucherId: string): Promise<boolean> {
  const { data } = await supabase
    .from("gift_vouchers")
    .update({ email_sent_at: new Date().toISOString() })
    .eq("id", voucherId)
    .is("email_sent_at", null)
    .select("id")
    .maybeSingle();
  return !!data;
}

export async function releaseVoucherEmail(supabase: ServiceRoleClient, voucherId: string): Promise<void> {
  await supabase.from("gift_vouchers").update({ email_sent_at: null }).eq("id", voucherId);
}

/** Remembers the address Stripe gave when the giver typed none on our page (an address typed here always wins). */
export async function setBuyerEmailIfEmpty(supabase: ServiceRoleClient, voucherId: string, email: string): Promise<void> {
  await supabase.from("gift_vouchers").update({ buyer_email: email }).eq("id", voucherId).is("buyer_email", null);
}

/** A refunded purchase: a voucher that is still pending or active stops working. A redeemed one is left alone. Returns whether one was voided. */
export async function voidVoucherForCheckout(supabase: ServiceRoleClient, stripeCheckoutId: string): Promise<boolean> {
  const { data } = await supabase
    .from("gift_vouchers")
    .update({ status: "void" })
    .eq("stripe_checkout_id", stripeCheckoutId)
    .in("status", ["pending", "active"])
    .select("id")
    .maybeSingle();
  return !!data;
}
