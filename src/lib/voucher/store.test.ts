import { describe, expect, it } from "vitest";
import { fakeSupabase } from "./fakeSupabase";
import { activateVoucher, attachPayment, claimVoucher, claimVoucherEmail, createPendingVoucher, findVoucherByCode, findVoucherByPlanToken, releaseClaim, releaseVoucherEmail, voidVoucherForCheckout, type NewVoucher } from "./store";
import { voucherState } from "./code";

// The state machine of a voucher against an in-memory database that, like the real one, applies a conditional UPDATE to the rows that exist at that
// moment: so "claim" can only ever win once.

const NEW: NewVoucher = { amountCents: 1495, currency: "eur", locale: "nl", giverName: "Jan", recipientName: "Judith", message: "Veel plezier", buyerSessionId: "s-buyer", buyerEmail: null, priceVariant: null };
const db = () => fakeSupabase({}, { unique: { gift_vouchers: ["code", "stripe_checkout_id", "plan_token"] } });
type Client = Parameters<typeof createPendingVoucher>[0];

async function paidVoucher(client: ReturnType<typeof db>, now = new Date("2026-11-01T10:00:00Z")) {
  const v = await createPendingVoucher(client as unknown as Client, NEW);
  await attachPayment(client as unknown as Client, v.id, "cs_test_1", "pay-1");
  const activated = await activateVoucher(client as unknown as Client, "cs_test_1", now);
  return { v, activated: activated! };
}

describe("creating a voucher", () => {
  it("is pending, with a code, and stores what the giver typed", async () => {
    const client = db();
    const v = await createPendingVoucher(client as unknown as Client, NEW);
    expect(v.status).toBe("pending");
    expect(v.code).toMatch(/^WIN-/);
    expect([v.giver_name, v.recipient_name, v.message]).toEqual(["Jan", "Judith", "Veel plezier"]);
    expect(voucherState(v)).toBe("pending");
  });

  it("tries another code when two collide", async () => {
    const client = db();
    const codes = ["WIN-AAAA-AAAA-AAAA", "WIN-AAAA-AAAA-AAAA", "WIN-BBBB-BBBB-BBBB"];
    const a = await createPendingVoucher(client as unknown as Client, NEW, () => codes.shift()!);
    const b = await createPendingVoucher(client as unknown as Client, NEW, () => codes.shift()!);
    expect([a.code, b.code]).toEqual(["WIN-AAAA-AAAA-AAAA", "WIN-BBBB-BBBB-BBBB"]);
  });

  it("gives up with a clear error if it can never find a free code", async () => {
    const client = db();
    await createPendingVoucher(client as unknown as Client, NEW, () => "WIN-AAAA-AAAA-AAAA");
    await expect(createPendingVoucher(client as unknown as Client, NEW, () => "WIN-AAAA-AAAA-AAAA")).rejects.toThrow(/unique voucher code/);
  });
});

describe("paying for a voucher", () => {
  it("activates once: valid for twelve months, and only the first call says it was the one", async () => {
    const client = db();
    const { activated } = await paidVoucher(client);
    expect(activated.justActivated).toBe(true);
    expect(activated.voucher.status).toBe("active");
    expect(activated.voucher.expires_at).toBe("2027-11-01T10:00:00.000Z");
    const again = await activateVoucher(client as unknown as Client, "cs_test_1");
    expect(again?.justActivated).toBe(false);
    expect(again?.voucher.activated_at).toBe(activated.voucher.activated_at);
  });

  it("knows nothing about a payment that is not a voucher", async () => {
    expect(await activateVoucher(db() as unknown as Client, "cs_test_other")).toBeNull();
  });

  it("sends its e-mail only once even when two places ask at the same moment", async () => {
    const client = db();
    const { v } = await paidVoucher(client);
    const results = await Promise.all([claimVoucherEmail(client as unknown as Client, v.id), claimVoucherEmail(client as unknown as Client, v.id)]);
    expect(results.filter(Boolean)).toHaveLength(1);
    await releaseVoucherEmail(client as unknown as Client, v.id);
    expect(await claimVoucherEmail(client as unknown as Client, v.id)).toBe(true);
  });
});

describe("redeeming a voucher", () => {
  it("is single use: the second claim loses, whoever asks", async () => {
    const client = db();
    const { v } = await paidVoucher(client);
    const now = new Date("2026-11-02T10:00:00Z");
    const first = await claimVoucher(client as unknown as Client, v.id, "s-recipient", now);
    const second = await claimVoucher(client as unknown as Client, v.id, "s-someone-else", now);
    expect(first?.status).toBe("redeemed");
    expect(first?.redeemed_session_id).toBe("s-recipient");
    expect(first?.plan_token).toMatch(/^[0-9a-f]{48}$/);
    expect(second).toBeNull();
  });

  it("cannot be claimed before it is paid", async () => {
    const client = db();
    const v = await createPendingVoucher(client as unknown as Client, NEW);
    expect(await claimVoucher(client as unknown as Client, v.id, "s")).toBeNull();
  });

  it("cannot be claimed after it expired, but can the moment before", async () => {
    const client = db();
    const { v } = await paidVoucher(client);
    expect(await claimVoucher(client as unknown as Client, v.id, "s", new Date("2027-11-01T10:00:00Z"))).toBeNull();
    expect((await claimVoucher(client as unknown as Client, v.id, "s", new Date("2027-11-01T09:59:59Z")))?.status).toBe("redeemed");
  });

  it("can be released again when what followed the claim failed, so the code is not burnt", async () => {
    const client = db();
    const { v } = await paidVoucher(client);
    await claimVoucher(client as unknown as Client, v.id, "s");
    await releaseClaim(client as unknown as Client, v.id);
    const after = await findVoucherByCode(client as unknown as Client, v.code);
    expect(after?.status).toBe("active");
    expect(after?.plan_token).toBeNull();
    expect((await claimVoucher(client as unknown as Client, v.id, "s2"))?.status).toBe("redeemed");
  });

  it("opens the book only with the plan token", async () => {
    const client = db();
    const { v } = await paidVoucher(client);
    const claimed = await claimVoucher(client as unknown as Client, v.id, "s");
    expect((await findVoucherByPlanToken(client as unknown as Client, claimed!.plan_token!))?.id).toBe(v.id);
    expect(await findVoucherByPlanToken(client as unknown as Client, v.code)).toBeNull();
    expect(await findVoucherByPlanToken(client as unknown as Client, "0".repeat(48))).toBeNull();
  });
});

describe("a refunded voucher", () => {
  it("stops working while it is unredeemed, and a redeemed one is left alone", async () => {
    const client = db();
    const { v } = await paidVoucher(client);
    expect(await voidVoucherForCheckout(client as unknown as Client, "cs_test_1")).toBe(true);
    expect(await claimVoucher(client as unknown as Client, v.id, "s")).toBeNull();

    const other = db();
    const { v: v2 } = await paidVoucher(other);
    await claimVoucher(other as unknown as Client, v2.id, "s");
    expect(await voidVoucherForCheckout(other as unknown as Client, "cs_test_1")).toBe(false);
  });
});

describe("finding a voucher by the code people type", () => {
  it("accepts any reasonable spelling and nothing else", async () => {
    const client = db();
    const { v } = await paidVoucher(client);
    expect((await findVoucherByCode(client as unknown as Client, v.code.toLowerCase().replace(/-/g, " ")))?.id).toBe(v.id);
    expect(await findVoucherByCode(client as unknown as Client, "nonsense")).toBeNull();
    expect(await findVoucherByCode(client as unknown as Client, null)).toBeNull();
  });
});
