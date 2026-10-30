// Checks migration 0022 and the voucher state machine against the REAL database, with nothing left behind.
//
//   npx tsx --env-file=.env.local scripts/voucher-smoke.ts
//
// What it does: creates a throw-away session, voucher and order (every id starts with "smoke"), walks the voucher through
// pending -> active -> redeemed -> released -> redeemed -> (a second claim must lose) and voids another one, checks that the new columns exist,
// and deletes everything it made. No Stripe, no e-mail, no cost. Run it once after running migration 0022 in the Supabase SQL editor.

import { createClient } from "@supabase/supabase-js";
import { createPendingVoucher, activateVoucher, attachPayment, claimVoucher, releaseClaim, voidVoucherForCheckout, findVoucherByCode } from "../src/lib/voucher/store";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (run with --env-file=.env.local).");
  process.exit(2);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });

let failures = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) {
    failures++;
    process.exitCode = 1;
  }
};

async function columnExists(table: string, column: string): Promise<boolean> {
  const { error } = await supabase.from(table).select(column).limit(1);
  return !error;
}

async function main() {
  const stamp = Date.now();
  const sessionIds: string[] = [];
  const voucherIds: string[] = [];
  const paymentIds: string[] = [];

  try {
    check("table gift_vouchers exists", await columnExists("gift_vouchers", "code"));
    check("payments.price_variant exists", await columnExists("payments", "price_variant"));
    check("payments.followup_consent_at exists", await columnExists("payments", "followup_consent_at"));
    check("window_plans.followup_email exists", await columnExists("window_plans", "followup_email"));
    check("window_plans.followup_sent_at exists", await columnExists("window_plans", "followup_sent_at"));
    check("gift_vouchers.redeemer_email exists", await columnExists("gift_vouchers", "redeemer_email"));
    const { data: product } = await supabase.from("products").select("id, price_cents").eq("id", "windowinto-gift-voucher").maybeSingle();
    check("product windowinto-gift-voucher exists", !!product, product ? `${product.price_cents} cents` : "");
    if (failures > 0) {
      console.log("\nThe database is not ready: run supabase/migrations/0022_gift_vouchers_followup_pricing.sql in the Supabase SQL editor first.");
      return;
    }

    const session = async () => {
      const { data, error } = await supabase.from("sessions").insert({ status: "started" }).select("id").single();
      if (error || !data) throw new Error(`session: ${error?.message}`);
      sessionIds.push(data.id);
      return data.id;
    };
    const buyer = await session();
    const recipient = await session();

    const v = await createPendingVoucher(supabase, { amountCents: 1495, currency: "eur", locale: "nl", giverName: "Smoke", recipientName: "Test", message: "smoke test", buyerSessionId: buyer, buyerEmail: null, priceVariant: "smoke" });
    voucherIds.push(v.id);
    check("a new voucher is pending", v.status === "pending" && /^WIN-/.test(v.code), v.code);

    const checkoutId = `cs_test_smoke_${stamp}`;
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert({ session_id: buyer, stripe_payment_id: checkoutId, amount: 1495, currency: "eur", status: "succeeded", product_id: "windowinto-gift-voucher", price_variant: "smoke", followup_consent_at: new Date().toISOString() })
      .select("id")
      .single();
    check("an order for the voucher product can be written (with the new columns)", !paymentError && !!payment, paymentError?.message ?? "");
    if (!payment) return;
    paymentIds.push(payment.id);
    await attachPayment(supabase, v.id, checkoutId, payment.id);

    const early = await claimVoucher(supabase, v.id, recipient);
    check("an unpaid voucher cannot be redeemed", early === null);

    const activated = await activateVoucher(supabase, checkoutId);
    check("paying activates it, once", activated?.justActivated === true && activated.voucher.status === "active" && !!activated.voucher.expires_at);
    const again = await activateVoucher(supabase, checkoutId);
    check("asking again does not activate twice", again?.justActivated === false);

    const claims = await Promise.all([claimVoucher(supabase, v.id, recipient), claimVoucher(supabase, v.id, buyer)]);
    check("of two simultaneous claims exactly one wins", claims.filter(Boolean).length === 1);
    const won = claims.find(Boolean);
    check("the winner got a plan token and the session is recorded", !!won?.plan_token && won?.redeemed_session_id === recipient);

    await releaseClaim(supabase, v.id);
    const released = await findVoucherByCode(supabase, v.code);
    check("a released claim puts it back to active", released?.status === "active" && released.plan_token === null);

    const second = await claimVoucher(supabase, v.id, recipient);
    check("and it can be redeemed again afterwards", second?.status === "redeemed");

    const second2 = await createPendingVoucher(supabase, { amountCents: 1495, currency: "eur", locale: "en", giverName: "", recipientName: "", message: "", buyerSessionId: buyer, buyerEmail: null, priceVariant: null });
    voucherIds.push(second2.id);
    await supabase.from("gift_vouchers").update({ stripe_checkout_id: `${checkoutId}_b`, status: "active", expires_at: "2099-01-01T00:00:00Z" }).eq("id", second2.id);
    check("a refunded active voucher is voided", (await voidVoucherForCheckout(supabase, `${checkoutId}_b`)) === true);
    check("and cannot be redeemed", (await claimVoucher(supabase, second2.id, recipient)) === null);
  } finally {
    if (voucherIds.length) await supabase.from("gift_vouchers").delete().in("id", voucherIds);
    if (paymentIds.length) await supabase.from("payments").delete().in("id", paymentIds);
    if (sessionIds.length) await supabase.from("sessions").delete().in("id", sessionIds);
    console.log("cleaned up the smoke test rows");
  }
  console.log(failures === 0 ? "\nAll good." : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
