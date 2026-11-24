import { describe, expect, it, vi, beforeEach } from "vitest";

const updateCalls: Array<{ table: string; patch: unknown; eqColumn: string; eqValue: string }> = [];

// A tiny in-memory "payments" row so idempotency can actually be checked —
// applying the same webhook event twice must leave the row in the same
// state, not create a second row or double-apply anything. Stripe
// explicitly documents at-least-once, possibly-duplicate delivery, and the
// compliance brief requires webhook handling to be idempotent (no
// duplicate orders/payments/PDFs/e-mails on a replay).
function makeSupabaseMock() {
  const paymentsRow = { stripe_payment_id: "cs_test_1", status: "pending" };

  return {
    from(table: string) {
      if (table === "payments") {
        return {
          update: (patch: Record<string, unknown>) => ({
            eq: (column: string, value: string) => {
              updateCalls.push({ table, patch, eqColumn: column, eqValue: value });
              if (column === "stripe_payment_id" && value === paymentsRow.stripe_payment_id) {
                Object.assign(paymentsRow, patch);
              }
              return Promise.resolve({ error: null });
            },
          }),
        };
      }
      if (table === "sessions") {
        return { update: () => ({ eq: () => Promise.resolve({ error: null }) }) };
      }
      throw new Error(`Unexpected table in test: ${table}`);
    },
    __row: paymentsRow,
  };
}

let supabaseMock = makeSupabaseMock();

vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: vi.fn(() => supabaseMock),
}));

const fakeEvent = {
  type: "checkout.session.completed",
  data: {
    object: {
      id: "cs_test_1",
      metadata: { session_id: "session-1" },
    },
  },
};

// The signature-verification step (getStripe().webhooks.constructEvent) is
// Stripe's own SDK code, not ours — this test is about *our* handler's
// idempotency, so it's mocked to always hand back the same parsed event
// rather than re-verifying a real HMAC signature.
vi.mock("@/lib/stripe", () => ({
  getStripe: vi.fn(() => ({
    webhooks: {
      constructEvent: vi.fn(() => fakeEvent),
    },
  })),
}));

// The one-time discount code of an order (src/lib/discountCode.ts): used up when the payment is confirmed, let go when it fails or runs out.
const discountCalls: string[] = [];
// Every step in the order it happened (the code used up, then the reward asked for), for the reward tests below.
const callOrder: string[] = [];
let discountThrows = false;
vi.mock("@/lib/discountCode", () => ({
  supabaseStore: () => ({
    async redeemForOrder(session: string) {
      discountCalls.push(`redeem:${session}`);
      callOrder.push(`redeem:${session}`);
      if (discountThrows) throw new Error("table missing");
      return true;
    },
    async releaseForOrder(session: string) {
      discountCalls.push(`release:${session}`);
      if (discountThrows) throw new Error("table missing");
    },
  }),
}));

// The reward for the buyer who passed a friend code on (Step 239) has its own tests (src/lib/referralReward.test.ts): here only that the webhook asks for it, when, and that it never fails.
const rewardCalls: unknown[][] = [];
let rewardThrows = false;
vi.mock("@/lib/referralRewardLive", () => ({
  rewardReferrerForOrder: vi.fn(async (_db: unknown, ...args: unknown[]) => {
    rewardCalls.push(args);
    callOrder.push(`reward:${args[0]}`);
    if (rewardThrows) throw new Error("mail service down");
    return { status: "none", reason: "no_code" };
  }),
}));

import { POST } from "./route";

function fakeRequest(withSignature = true) {
  return new Request("https://windowinto.test/api/stripe/webhook", {
    method: "POST",
    headers: withSignature ? { "stripe-signature": "test-signature" } : {},
    body: JSON.stringify(fakeEvent),
  });
}

beforeEach(() => {
  updateCalls.length = 0;
  supabaseMock = makeSupabaseMock();
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
});

describe("Stripe webhook — idempotency", () => {
  it("applies the same status update whether the event is delivered once or twice", async () => {
    const first = await POST(fakeRequest());
    expect(first.status).toBe(200);
    expect(supabaseMock.__row.status).toBe("succeeded");

    const second = await POST(fakeRequest());
    expect(second.status).toBe(200);
    expect(supabaseMock.__row.status).toBe("succeeded");

    expect(updateCalls).toHaveLength(2);
    expect(updateCalls[0].patch).toEqual(updateCalls[1].patch);
    expect(updateCalls[0].eqValue).toBe(updateCalls[1].eqValue);
  });

  it("rejects a request with no Stripe signature header before touching the database", async () => {
    const response = await POST(fakeRequest(false));
    expect(response.status).toBe(400);
    expect(updateCalls).toHaveLength(0);
  });
});

describe("Stripe webhook — the one-time discount code of an order (Step 230)", () => {
  const original = fakeEvent.type;
  beforeEach(() => {
    discountCalls.length = 0;
    discountThrows = false;
  });
  const deliver = async (type: string) => {
    fakeEvent.type = type;
    try {
      return await POST(fakeRequest());
    } finally {
      fakeEvent.type = original;
    }
  };

  it("uses the code up when the payment is confirmed, also when it is confirmed later (iDEAL and the like)", async () => {
    expect((await deliver("checkout.session.completed")).status).toBe(200);
    expect((await deliver("checkout.session.async_payment_succeeded")).status).toBe(200);
    expect(discountCalls).toEqual(["redeem:cs_test_1", "redeem:cs_test_1"]);
  });

  it("lets the code go when the payment fails or the Checkout Session runs out, and never uses it up", async () => {
    expect((await deliver("checkout.session.expired")).status).toBe(200);
    expect((await deliver("checkout.session.async_payment_failed")).status).toBe(200);
    expect(discountCalls).toEqual(["release:cs_test_1", "release:cs_test_1"]);
  });

  it("never fails the webhook because of the code (a database without the table, an error): the payment is still recorded", async () => {
    discountThrows = true;
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await deliver("checkout.session.completed")).status).toBe(200);
    expect(supabaseMock.__row.status).toBe("succeeded");
    expect((await deliver("checkout.session.expired")).status).toBe(200);
    err.mockRestore();
  });
});

describe("Stripe webhook — the reward for the buyer who passed a friend code on (Step 239)", () => {
  const original = fakeEvent.type;
  const object = fakeEvent.data.object as Record<string, unknown>;
  beforeEach(() => {
    discountCalls.length = 0;
    callOrder.length = 0;
    rewardCalls.length = 0;
    rewardThrows = false;
    discountThrows = false;
    object.metadata = { session_id: "session-1", delivery_email: "friend@example.org" };
    object.customer_details = { email: "friend@stripe.example" };
    object.customer_email = "friend@example.org";
  });
  const deliver = async (type: string) => {
    fakeEvent.type = type;
    try {
      return await POST(fakeRequest());
    } finally {
      fakeEvent.type = original;
    }
  };

  it("asks for it after the code is used up, with every address the friend ordered with, when a payment is confirmed (also a later one, iDEAL and the like)", async () => {
    expect((await deliver("checkout.session.completed")).status).toBe(200);
    expect((await deliver("checkout.session.async_payment_succeeded")).status).toBe(200);
    expect(callOrder).toEqual(["redeem:cs_test_1", "reward:cs_test_1", "redeem:cs_test_1", "reward:cs_test_1"]);
    expect(rewardCalls[0]).toEqual(["cs_test_1", ["friend@example.org", "friend@stripe.example", "friend@example.org"]]);
  });

  it("does not ask when the payment fails or the Checkout Session runs out", async () => {
    await deliver("checkout.session.expired");
    await deliver("checkout.session.async_payment_failed");
    expect(rewardCalls).toHaveLength(0);
  });

  it("never fails the webhook because of the reward: the payment is still recorded", async () => {
    rewardThrows = true;
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await deliver("checkout.session.completed")).status).toBe(200);
    expect(supabaseMock.__row.status).toBe("succeeded");
    expect(err.mock.calls.some((c) => String(c[0]).includes("reward"))).toBe(true);
    err.mockRestore();
  });

  it("still asks when using the code up failed, since the claim itself checks that the code is used", async () => {
    discountThrows = true;
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await deliver("checkout.session.completed")).status).toBe(200);
    err.mockRestore();
    expect(rewardCalls).toHaveLength(1);
  });
});
