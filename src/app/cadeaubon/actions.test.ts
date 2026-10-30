import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "@/lib/voucher/fakeSupabase";

// Buying a gift voucher (src/app/cadeaubon/actions.ts): what is validated, what is stored before the giver is sent to Stripe, and that the price
// charged is the one the server decided (including a price-test variant), never anything the page sent.

type FakeClient = ReturnType<typeof fakeSupabase>;
let db: FakeClient;
let price: { cents: number; variant: string | null };
let stripeFails = false;
const stripeCalls: { line_items: { price_data: { unit_amount: number } }[]; metadata: Record<string, string>; success_url: string; cancel_url: string }[] = [];
const consent: { kind: string; text?: string }[] = [];

vi.mock("@/lib/supabase/server", () => ({ createServiceRoleClient: () => db }));
vi.mock("@/lib/language", () => ({ getLocale: async () => "nl" }));
vi.mock("@/lib/visitorPrice", () => ({ getVisitorPrice: async () => price }));
vi.mock("@/lib/orderNumber", () => ({ nextOrderNumber: async () => "WI-2026-000042" }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1", "user-agent": "vitest" }) }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    checkout: {
      sessions: {
        create: async (params: (typeof stripeCalls)[number]) => {
          if (stripeFails) throw new Error("stripe down");
          stripeCalls.push(params);
          return { id: "cs_test_voucher_1", url: "https://checkout.stripe.test/pay/cs_test_voucher_1" };
        },
      },
    },
  }),
}));
vi.mock("@/lib/consent", () => ({
  recordTermsAcceptance: async (_db: unknown, p: { consentText: string }) => {
    consent.push({ kind: "terms", text: p.consentText });
  },
  recordDigitalDeliveryConsent: async (_db: unknown, p: { consentText: string }) => {
    consent.push({ kind: "delivery", text: p.consentText });
  },
}));

import { createVoucherCheckout } from "./actions";
import { getGiftCopy } from "@/lib/i18n/gift";

const FORM = { recipientName: "Judith", giverName: "Jan", message: "Veel plezier!", email: "", termsAccepted: true, deliveryConsent: true };
const copy = getGiftCopy("nl").buy;

beforeEach(() => {
  db = fakeSupabase({}, { unique: { gift_vouchers: ["code", "stripe_checkout_id"], payments: ["stripe_payment_id"] } });
  price = { cents: 1495, variant: null };
  stripeFails = false;
  stripeCalls.length = 0;
  consent.length = 0;
});

describe("buying a voucher", () => {
  it("stores a pending voucher, the order and both consents, then sends the giver to Stripe", async () => {
    await expect(createVoucherCheckout(FORM)).rejects.toThrow("REDIRECT:https://checkout.stripe.test/pay/cs_test_voucher_1");
    const voucher = db.rows("gift_vouchers")[0];
    expect(voucher).toMatchObject({ status: "pending", amount_cents: 1495, recipient_name: "Judith", giver_name: "Jan", message: "Veel plezier!", stripe_checkout_id: "cs_test_voucher_1", locale: "nl" });
    expect(voucher.code).toMatch(/^WIN-/);
    expect(db.rows("payments")[0]).toMatchObject({ amount: 1495, status: "pending", product_id: "windowinto-gift-voucher", order_number: "WI-2026-000042", stripe_payment_id: "cs_test_voucher_1" });
    expect(voucher.payment_id).toBe(db.rows("payments")[0].id);
    // Both consents are on record, and the delivery one carries the voucher's own wording.
    expect(consent.map((c) => c.kind)).toEqual(["terms", "delivery"]);
    expect(consent[1].text).toBe(copy.consentLabel);
    // Back to the page that activates the voucher, or to the form when the giver abandons.
    expect(stripeCalls[0].success_url).toContain("/cadeaubon/klaar?checkout_session_id={CHECKOUT_SESSION_ID}");
    expect(stripeCalls[0].cancel_url).toContain("/cadeaubon?payment=cancelled");
    expect(stripeCalls[0].metadata).toMatchObject({ kind: "gift_voucher", voucher_id: voucher.id });
  });

  it("charges the price the server decided, and records the variant on the order", async () => {
    price = { cents: 1295, variant: "B" };
    await expect(createVoucherCheckout(FORM)).rejects.toThrow("REDIRECT:");
    expect(stripeCalls[0].line_items[0].price_data.unit_amount).toBe(1295);
    expect(db.rows("payments")[0]).toMatchObject({ amount: 1295, price_variant: "B" });
    expect(db.rows("gift_vouchers")[0]).toMatchObject({ amount_cents: 1295, price_variant: "B" });
  });

  it("does not write the variant column when there is no test, so a database without migration 0022 still takes orders", async () => {
    await expect(createVoucherCheckout(FORM)).rejects.toThrow("REDIRECT:");
    expect("price_variant" in db.rows("payments")[0]).toBe(false);
  });

  it("refuses without the terms or without the delivery consent, and then writes and charges nothing", async () => {
    await expect(createVoucherCheckout({ ...FORM, termsAccepted: false })).rejects.toThrow(copy.errorTerms);
    await expect(createVoucherCheckout({ ...FORM, deliveryConsent: false })).rejects.toThrow(copy.errorConsent);
    await expect(createVoucherCheckout({ ...FORM, email: "nope" })).rejects.toThrow(copy.errorEmail);
    expect(db.rows("gift_vouchers")).toHaveLength(0);
    expect(stripeCalls).toHaveLength(0);
  });

  it("cleans what the giver typed before it is stored and printed", async () => {
    await expect(createVoucherCheckout({ ...FORM, recipientName: "  Judith ​  ", giverName: "x".repeat(100), message: "a".repeat(400) })).rejects.toThrow("REDIRECT:");
    const v = db.rows("gift_vouchers")[0];
    expect(v.recipient_name).toBe("Judith");
    expect((v.giver_name as string).length).toBe(40);
    expect((v.message as string).length).toBe(280);
  });

  it("keeps the address the giver typed for the card and the code", async () => {
    await expect(createVoucherCheckout({ ...FORM, email: " jan@example.com " })).rejects.toThrow("REDIRECT:");
    expect(db.rows("gift_vouchers")[0].buyer_email).toBe("jan@example.com");
  });

  it("fails with a plain message, before Stripe, when the voucher cannot be stored (migration 0022 not run)", async () => {
    db = fakeSupabase({}, { beforeInsert: (table) => (table === "gift_vouchers" ? { code: "PGRST205", message: "Could not find the table 'public.gift_vouchers'" } : null) });
    await expect(createVoucherCheckout(FORM)).rejects.toThrow(copy.errorGeneric);
    expect(stripeCalls).toHaveLength(0);
  });
});
