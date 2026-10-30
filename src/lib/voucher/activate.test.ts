import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "./fakeSupabase";

// Paying for a voucher: the success page and the webhook both call activateAfterPayment, possibly at the same moment. One activation, one e-mail,
// a failed e-mail is tried again on the next visit, and an unpaid session activates nothing.

type FakeClient = ReturnType<typeof fakeSupabase>;
let db: FakeClient;
let paymentStatus: "paid" | "unpaid";
let sendFails: boolean;
const sent: { to: string; code: string }[] = [];
const events: string[] = [];

vi.mock("@/lib/supabase/server", () => ({ createServiceRoleClient: () => db }));
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({ checkout: { sessions: { retrieve: async () => ({ payment_status: paymentStatus, customer_details: { email: "giver@stripe.test" } }) } } }),
}));
vi.mock("@/lib/pdf/giftCard", () => ({ renderGiftCardPdf: async () => new Uint8Array([37, 80, 68, 70]), formatCardDate: () => "1 november 2027" }));
vi.mock("@/lib/email/voucher", () => ({
  sendVoucherEmail: async (p: { to: string; code: string }) => {
    if (sendFails) throw new Error("resend down");
    sent.push({ to: p.to, code: p.code });
  },
}));
vi.mock("@/lib/posthog/server", () => ({
  trackServerEvent: async (name: string) => {
    events.push(name);
  },
}));

import { activateAfterPayment, ensureVoucherEmail } from "./activate";

const PENDING = {
  id: "v1",
  code: "WIN-K7QM-4XRT-9PDH",
  status: "pending",
  amount_cents: 1495,
  currency: "eur",
  locale: "nl",
  recipient_name: "Judith",
  buyer_email: null,
  stripe_checkout_id: "cs_test_1",
  payment_id: null,
  email_sent_at: null,
  expires_at: null,
  created_at: "2026-11-01T09:00:00.000Z",
};

beforeEach(() => {
  db = fakeSupabase({ gift_vouchers: [{ ...PENDING }], payments: [] }, { unique: { gift_vouchers: ["code", "stripe_checkout_id"] } });
  paymentStatus = "paid";
  sendFails = false;
  sent.length = 0;
  events.length = 0;
});

describe("activating after payment", () => {
  it("activates and mails the code once, to the address Stripe knows when the giver typed none", async () => {
    const result = await activateAfterPayment("cs_test_1");
    expect(result.state).toBe("ready");
    expect(db.rows("gift_vouchers")[0]).toMatchObject({ status: "active", buyer_email: "giver@stripe.test" });
    expect(db.rows("gift_vouchers")[0].expires_at).toEqual(expect.any(String));
    expect(sent).toEqual([{ to: "giver@stripe.test", code: PENDING.code }]);
    expect(events).toEqual(["gift_voucher_purchased"]);
  });

  it("does nothing twice: the success page and the webhook together send one mail and count one purchase", async () => {
    await Promise.all([activateAfterPayment("cs_test_1"), activateAfterPayment("cs_test_1")]);
    await activateAfterPayment("cs_test_1");
    expect(sent).toHaveLength(1);
    expect(events).toEqual(["gift_voucher_purchased"]);
  });

  it("mails the address the giver typed on our page, not Stripe's", async () => {
    db = fakeSupabase({ gift_vouchers: [{ ...PENDING, buyer_email: "typed@example.com" }] }, { unique: { gift_vouchers: ["code", "stripe_checkout_id"] } });
    await activateAfterPayment("cs_test_1");
    expect(sent[0].to).toBe("typed@example.com");
  });

  it("activates nothing while Stripe says it is not paid", async () => {
    paymentStatus = "unpaid";
    expect(await activateAfterPayment("cs_test_1")).toEqual({ state: "unpaid" });
    expect(db.rows("gift_vouchers")[0].status).toBe("pending");
    expect(sent).toHaveLength(0);
  });

  it("knows nothing about a payment that is not a voucher", async () => {
    expect(await activateAfterPayment("cs_test_unknown")).toEqual({ state: "unknown" });
  });

  it("tries the e-mail again on the next visit when it failed, and the voucher is active meanwhile", async () => {
    sendFails = true;
    const first = await activateAfterPayment("cs_test_1");
    expect(first.state).toBe("ready");
    expect(db.rows("gift_vouchers")[0]).toMatchObject({ status: "active", email_sent_at: null });
    sendFails = false;
    await activateAfterPayment("cs_test_1");
    expect(sent).toHaveLength(1);
    expect(db.rows("gift_vouchers")[0].email_sent_at).toEqual(expect.any(String));
    // The purchase is counted once, on the first activation, even though the mail needed two tries.
    expect(events).toEqual(["gift_voucher_purchased"]);
  });
});

describe("the voucher e-mail", () => {
  it("is never sent for a refunded voucher or one without an expiry", async () => {
    const base = { ...PENDING, status: "active", expires_at: "2027-11-01T00:00:00.000Z", buyer_email: "a@b.nl" };
    db = fakeSupabase({ gift_vouchers: [{ ...base, status: "void" }] });
    expect(await ensureVoucherEmail({ ...base, status: "void" } as never, null)).toBe(false);
    expect(await ensureVoucherEmail({ ...base, expires_at: null } as never, null)).toBe(false);
    expect(sent).toHaveLength(0);
  });
});
