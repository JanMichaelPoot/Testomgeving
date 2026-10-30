"use server";

import { redirect } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getSessionId } from "@/lib/session";
import { nextOrderNumber } from "@/lib/orderNumber";
import { recordTermsAcceptance } from "@/lib/consent";
import { LEGAL_VERSIONS } from "@/lib/legal/versions";
import { getLocale } from "@/lib/language";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getGiftCopy } from "@/lib/i18n/gift";
import { checkTestQuota } from "@/lib/testQuota";
import { trackServerEvent } from "@/lib/posthog/server";
import { isMissingColumnError } from "@/lib/supabase/errors";
import { normalizeCode, voucherState } from "@/lib/voucher/code";
import { clearVoucherCookie, getVoucherCookie, setVoucherCookie } from "@/lib/voucher/cookie";
import { claimVoucher, findVoucherByCode, releaseClaim } from "@/lib/voucher/store";
import { isValidEmail } from "@/lib/voucher/text";

// The recipient's side of a gift voucher (improvement brief B3). Three steps: type or open a code (lookupCode), press "Open je venster" on the
// page of a valid code (startRedeem: remembers the code in a cookie and starts the intake), and on the last screen of the intake redeem it
// (redeemVoucher: single use, atomic, makes the zero-amount order the book is generated for).

/** The form on /cadeau: a code typed or pasted goes to its own page, or comes back with a message when it cannot be a code. */
export async function lookupCode(formData: FormData) {
  const code = normalizeCode(String(formData.get("code") ?? ""));
  redirect(code ? `/cadeau/${code}` : "/cadeau?error=invalid");
}

/** "Open je venster" on the page of a code that can be redeemed: keep the code and go to the intake. Nothing is used up yet. */
export async function startRedeem(formData: FormData) {
  const supabase = createServiceRoleClient();
  const voucher = await findVoucherByCode(supabase, String(formData.get("code") ?? ""));
  if (!voucher || voucherState(voucher) !== "ok") redirect("/cadeau");
  await setVoucherCookie(voucher.code);
  redirect("/intake");
}

export type RedeemResult = { ok: true; token: string } | { ok: false; reason: "invalid" | "redeemed" | "expired" | "void" | "pending" | "terms" | "email" | "limit" | "generic" };

/**
 * Redeems the voucher in the cookie for the session that has just been created from the intake (the wizard stores the answers first).
 * The claim is one conditional UPDATE, so two people (or two tabs) with the same code cannot both win. If anything fails after the claim,
 * the claim is undone: a code is never burnt without a book.
 */
export async function redeemVoucher(input: { termsAccepted: boolean; email: string; followUp: boolean }): Promise<RedeemResult> {
  if (!input.termsAccepted) return { ok: false, reason: "terms" };
  const email = (input.email ?? "").trim();
  if (email && !isValidEmail(email)) return { ok: false, reason: "email" };

  const code = await getVoucherCookie();
  const sessionId = await getSessionId();
  if (!code || !sessionId) return { ok: false, reason: "invalid" };

  const supabase = createServiceRoleClient();
  const voucher = await findVoucherByCode(supabase, code);
  if (!voucher) return { ok: false, reason: "invalid" };
  const state = voucherState(voucher);
  if (state !== "ok") return { ok: false, reason: state };

  // The test phase limit counts books, and this starts one: the same check as everywhere a book can start.
  if (!(await checkTestQuota(supabase, sessionId)).allowed) return { ok: false, reason: "limit" };

  const claimed = await claimVoucher(supabase, voucher.id, sessionId);
  if (!claimed || !claimed.plan_token) return { ok: false, reason: "redeemed" };

  try {
    if (email) await supabase.from("gift_vouchers").update({ redeemer_email: email }).eq("id", claimed.id);

    // The order of the redemption: zero amount, keyed by the voucher so it is unique. The giver's consent lives on the purchase order.
    const orderRow = {
      session_id: sessionId,
      stripe_payment_id: `voucher:${claimed.stripe_checkout_id ?? claimed.id}`,
      amount: 0,
      currency: claimed.currency,
      status: "succeeded" as const,
      order_number: await nextOrderNumber(supabase),
      product_id: "windowinto-pdf",
    };
    const consentedFollowUp = input.followUp && !!email;
    let { data: order, error } = await supabase
      .from("payments")
      .insert({ ...orderRow, ...(consentedFollowUp ? { followup_consent_at: new Date().toISOString() } : {}) })
      .select("id")
      .single();
    if (error && consentedFollowUp && isMissingColumnError(error)) {
      ({ data: order, error } = await supabase.from("payments").insert(orderRow).select("id").single());
    }
    if (error || !order) throw new Error(error?.message ?? "Could not create the order.");

    const dict = getDictionary(await getLocale()).checkout;
    const panel = getGiftCopy(await getLocale()).panel;
    await recordTermsAcceptance(supabase, {
      orderId: order.id,
      termsVersion: LEGAL_VERSIONS.terms,
      consentText: `${panel.termsLabelPrefix} ${panel.termsLinkText} ${panel.termsLabelSuffix}`.trim() || dict.termsAcceptanceLinkText,
    });
    await supabase.from("sessions").update({ status: "paid" }).eq("id", sessionId);
  } catch (err) {
    console.error("WINDOW: redeeming a gift voucher failed after the claim; undoing the claim:", err);
    await releaseClaim(supabase, claimed.id);
    return { ok: false, reason: "generic" };
  }

  await clearVoucherCookie();
  const days = claimed.activated_at ? Math.max(0, Math.round((Date.now() - new Date(claimed.activated_at).getTime()) / 86_400_000)) : 0;
  void trackServerEvent("gift_voucher_redeemed", { days_to_redeem: days }, claimed.id);
  return { ok: true, token: claimed.plan_token };
}
