import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "@/lib/voucher/fakeSupabase";

// Redeeming a gift voucher (src/app/cadeau/actions.ts) against an in-memory database. What matters: single use even when two requests race, the
// code is not burnt when something fails after the claim, and nothing is claimed without the terms, with a bad e-mail address or a used-up test quota.

type FakeClient = ReturnType<typeof fakeSupabase>;
let db: FakeClient;
let cookieCode: string | null;
let sessionId: string | null;
let quotaAllowed: boolean;
let failPaymentInsert: boolean;
const consentCalls: unknown[] = [];
const events: string[] = [];

vi.mock("@/lib/supabase/server", () => ({ createServiceRoleClient: () => db }));
vi.mock("@/lib/voucher/cookie", () => ({
  getVoucherCookie: async () => cookieCode,
  setVoucherCookie: async (code: string) => {
    cookieCode = code;
  },
  clearVoucherCookie: async () => {
    cookieCode = null;
  },
}));
vi.mock("@/lib/session", () => ({ getSessionId: async () => sessionId }));
vi.mock("@/lib/orderNumber", () => ({ nextOrderNumber: async () => "WI-2026-000099" }));
vi.mock("@/lib/consent", () => ({
  recordTermsAcceptance: async (_db: unknown, params: unknown) => {
    consentCalls.push(params);
  },
}));
vi.mock("@/lib/language", () => ({ getLocale: async () => "nl" }));
vi.mock("@/lib/testQuota", () => ({ checkTestQuota: async () => ({ allowed: quotaAllowed }) }));
vi.mock("@/lib/posthog/server", () => ({
  trackServerEvent: async (name: string) => {
    events.push(name);
  },
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));

import { redeemVoucher, startRedeem, lookupCode } from "./actions";

const CODE = "WIN-K7QM-4XRT-9PDH";
const ACTIVE = {
  id: "v1",
  code: CODE,
  status: "active",
  amount_cents: 1495,
  currency: "eur",
  locale: "nl",
  stripe_checkout_id: "cs_test_1",
  activated_at: "2026-10-01T00:00:00.000Z",
  expires_at: "2099-01-01T00:00:00.000Z",
  plan_token: null,
  redeemed_session_id: null,
  redeemer_email: null,
};

beforeEach(() => {
  db = fakeSupabase({ gift_vouchers: [{ ...ACTIVE }], payments: [], sessions: [{ id: "s-recipient", status: "started" }] }, {
    unique: { gift_vouchers: ["code", "plan_token"], payments: ["stripe_payment_id"] },
    beforeInsert: (table) => (table === "payments" && failPaymentInsert ? { message: "boom" } : null),
  });
  cookieCode = CODE;
  sessionId = "s-recipient";
  quotaAllowed = true;
  failPaymentInsert = false;
  consentCalls.length = 0;
  events.length = 0;
});

const input = { termsAccepted: true, email: "", followUp: false };

describe("redeeming", () => {
  it("makes the recipient's order from the voucher, and hands back the secret that opens the book", async () => {
    const result = await redeemVoucher(input);
    expect(result.ok).toBe(true);
    const voucher = db.rows("gift_vouchers")[0];
    expect(voucher).toMatchObject({ status: "redeemed", redeemed_session_id: "s-recipient" });
    expect(result.ok && result.token).toBe(voucher.plan_token);
    // A zero-amount order keyed by the purchase, so a test voucher's redemption is a test order too.
    expect(db.rows("payments")).toEqual([expect.objectContaining({ session_id: "s-recipient", amount: 0, status: "succeeded", stripe_payment_id: "voucher:cs_test_1", product_id: "windowinto-pdf" })]);
    expect(consentCalls).toHaveLength(1);
    expect(db.rows("sessions")[0].status).toBe("paid");
    expect(cookieCode).toBeNull();
    expect(events).toEqual(["gift_voucher_redeemed"]);
  });

  it("is single use: a second try with the same code is refused", async () => {
    await redeemVoucher(input);
    cookieCode = CODE;
    sessionId = "s-other";
    expect(await redeemVoucher(input)).toEqual({ ok: false, reason: "redeemed" });
    expect(db.rows("payments")).toHaveLength(1);
  });

  it("lets exactly one of two simultaneous requests win", async () => {
    const results = await Promise.all([redeemVoucher(input), redeemVoucher(input)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(db.rows("payments")).toHaveLength(1);
    expect(db.rows("gift_vouchers")[0].status).toBe("redeemed");
  });

  it("needs the terms, a valid e-mail address, a code and a session", async () => {
    expect(await redeemVoucher({ ...input, termsAccepted: false })).toEqual({ ok: false, reason: "terms" });
    expect(await redeemVoucher({ ...input, email: "not-an-address" })).toEqual({ ok: false, reason: "email" });
    cookieCode = null;
    expect(await redeemVoucher(input)).toEqual({ ok: false, reason: "invalid" });
    cookieCode = CODE;
    sessionId = null;
    expect(await redeemVoucher(input)).toEqual({ ok: false, reason: "invalid" });
    expect(db.rows("gift_vouchers")[0].status).toBe("active");
  });

  it("refuses an expired, unpaid or voided voucher without touching it", async () => {
    for (const [patch, reason] of [
      [{ expires_at: "2020-01-01T00:00:00.000Z" }, "expired"],
      [{ status: "pending" }, "pending"],
      [{ status: "void" }, "void"],
    ] as const) {
      db = fakeSupabase({ gift_vouchers: [{ ...ACTIVE, ...patch }], payments: [], sessions: [] }, { unique: { payments: ["stripe_payment_id"] } });
      expect(await redeemVoucher(input)).toEqual({ ok: false, reason });
      expect(db.rows("payments")).toHaveLength(0);
    }
  });

  it("does not start a book for a connection that used up its test limit", async () => {
    quotaAllowed = false;
    expect(await redeemVoucher(input)).toEqual({ ok: false, reason: "limit" });
    expect(db.rows("gift_vouchers")[0].status).toBe("active");
  });

  it("gives the code back when the order cannot be written: a code is never burnt without a book", async () => {
    failPaymentInsert = true;
    expect(await redeemVoucher(input)).toEqual({ ok: false, reason: "generic" });
    expect(db.rows("gift_vouchers")[0]).toMatchObject({ status: "active", plan_token: null, redeemed_session_id: null });
    failPaymentInsert = false;
    expect((await redeemVoucher(input)).ok).toBe(true);
  });

  it("keeps the recipient's address, and records the follow-up consent only when there is an address to send it to", async () => {
    await redeemVoucher({ termsAccepted: true, email: "judith@example.com", followUp: true });
    expect(db.rows("gift_vouchers")[0].redeemer_email).toBe("judith@example.com");
    expect(db.rows("payments")[0].followup_consent_at).toEqual(expect.any(String));

    db = fakeSupabase({ gift_vouchers: [{ ...ACTIVE }], payments: [], sessions: [] }, { unique: { payments: ["stripe_payment_id"] } });
    cookieCode = CODE;
    await redeemVoucher({ termsAccepted: true, email: "", followUp: true });
    expect(db.rows("payments")[0].followup_consent_at).toBeUndefined();
  });

  it("still redeems on a database without the follow-up column (migration not run)", async () => {
    db = fakeSupabase({ gift_vouchers: [{ ...ACTIVE }], payments: [], sessions: [] }, {
      unique: { payments: ["stripe_payment_id"] },
      beforeInsert: (table, row) => (table === "payments" && "followup_consent_at" in row ? { code: "PGRST204", message: "Could not find the 'followup_consent_at' column of 'payments' in the schema cache" } : null),
    });
    cookieCode = CODE;
    expect((await redeemVoucher({ termsAccepted: true, email: "judith@example.com", followUp: true })).ok).toBe(true);
    expect(db.rows("payments")).toHaveLength(1);
  });
});

describe("starting and looking up", () => {
  it("remembers the code of a valid voucher and goes to the intake", async () => {
    cookieCode = null;
    const form = new FormData();
    form.set("code", CODE.toLowerCase());
    await expect(startRedeem(form)).rejects.toThrow("REDIRECT:/intake");
    expect(cookieCode).toBe(CODE);
  });

  it("does not remember the code of a voucher that cannot be redeemed", async () => {
    db = fakeSupabase({ gift_vouchers: [{ ...ACTIVE, status: "redeemed" }] });
    cookieCode = null;
    const form = new FormData();
    form.set("code", CODE);
    await expect(startRedeem(form)).rejects.toThrow("REDIRECT:/cadeau");
    expect(cookieCode).toBeNull();
  });

  it("sends a typed code to its own page, and an impossible one back with a message", async () => {
    const good = new FormData();
    good.set("code", "win k7qm 4xrt 9pdh");
    await expect(lookupCode(good)).rejects.toThrow(`REDIRECT:/cadeau/${CODE}`);
    const bad = new FormData();
    bad.set("code", "hello");
    await expect(lookupCode(bad)).rejects.toThrow("REDIRECT:/cadeau?error=invalid");
  });
});
