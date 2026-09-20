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
