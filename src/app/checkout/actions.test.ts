import { describe, expect, it, vi, beforeEach } from "vitest";

// Fixed dictionary strings for the two validation errors under test — kept
// separate from the real src/lib/i18n/dictionaries.ts content so this test
// doesn't silently drift if that copy changes; it asserts against exactly
// what it injects.
const CHECKOUT_DICT = {
  errorTermsRequired: "Je moet akkoord gaan met de Algemene Voorwaarden.",
  errorConsentRequired: "Je moet instemmen met directe digitale levering.",
  errorEmailRequired: "Vul een geldig e-mailadres in.",
};
// The delivery e-mail is required (improvement brief of 11 Nov 2026); every happy-path call passes one.
const EMAIL = "reader@example.com";

vi.mock("@/lib/language", () => ({
  getLocale: vi.fn(async () => "nl"),
}));

vi.mock("@/lib/i18n/dictionaries", () => ({
  getDictionary: vi.fn(() => ({ checkout: CHECKOUT_DICT })),
}));

const callLog: string[] = [];
// What the code under test handed to Stripe and to the payments table, for the price-test and follow-up cases.
const stripeParams: { customer_email?: string; line_items: { price_data: { unit_amount: number } }[]; metadata: Record<string, string> }[] = [];
const orderRows: Record<string, unknown>[] = [];
let priceVariantCookie: string | null = null;

vi.mock("@/lib/session", () => ({
  getSessionId: vi.fn(async () => "session-1"),
}));

vi.mock("@/lib/stripe", () => ({
  getStripe: vi.fn(() => ({
    checkout: {
      sessions: {
        create: vi.fn(async (params: (typeof stripeParams)[number]) => {
          stripeParams.push(params);
          callLog.push("stripe.checkout.sessions.create");
          return { id: "cs_test_123", url: "https://checkout.stripe.test/pay/cs_test_123" };
        }),
      },
    },
  })),
}));

vi.mock("@/lib/orderNumber", () => ({
  nextOrderNumber: vi.fn(async () => "WI-2026-000001"),
}));

vi.mock("@/lib/consent", () => ({
  recordTermsAcceptance: vi.fn(async () => {
    callLog.push("recordTermsAcceptance");
  }),
  recordDigitalDeliveryConsent: vi.fn(async () => {
    callLog.push("recordDigitalDeliveryConsent");
  }),
}));

vi.mock("@/lib/legal/versions", () => ({
  LEGAL_VERSIONS: {
    terms: "v1.0",
    digital_delivery_consent: "v1.0",
    withdrawal_information: "v1.0",
    privacy: "v1.0",
  },
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
  cookies: vi.fn(async () => ({ get: (name: string) => (name === "window_price_variant" && priceVariantCookie ? { value: priceVariantCookie } : undefined) })),
}));

// after() only works inside a request: here the callbacks are collected instead, so a test can see what was scheduled for after the response.
const afterCallbacks: (() => unknown)[] = [];
vi.mock("next/server", () => ({
  after: vi.fn((cb: () => unknown) => {
    afterCallbacks.push(cb);
  }),
}));
const prewarmCalls: unknown[][] = [];
vi.mock("@/lib/claude/prewarmResearch", () => ({
  prewarmBookResearch: vi.fn(async (...args: unknown[]) => {
    prewarmCalls.push(args);
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    callLog.push(`redirect:${url}`);
    // next/navigation's real redirect() throws internally to unwind the
    // server action — mimic that so code after the call never runs, same
    // as in production.
    throw new Error("NEXT_REDIRECT");
  }),
}));

function intakeChain() {
  const chain = {
    select: () => chain,
    eq: () => chain,
    order: () => chain,
    limit: () => chain,
    maybeSingle: () => Promise.resolve({ data: { id: "intake-1" } }),
  };
  return chain;
}

vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: vi.fn(() => {
    const paymentsInsertChain = {
      select: () => paymentsInsertChain,
      single: () => {
        callLog.push("payments.insert");
        return Promise.resolve({ data: { id: "order-1" }, error: null });
      },
    };
    const sessionsUpdateChain = { eq: () => Promise.resolve({ error: null }) };

    return {
      from(table: string) {
        if (table === "intake_answers") return intakeChain();
        if (table === "payments") return { insert: (row: Record<string, unknown>) => (orderRows.push(row), paymentsInsertChain) };
        if (table === "sessions") return { update: () => sessionsUpdateChain };
        throw new Error(`Unexpected table in test: ${table}`);
      },
    };
  }),
}));

// Imported after the mocks above so createCheckoutSession picks them up —
// vi.mock calls are hoisted above imports by vitest, but importing the
// module under test last keeps the intent readable regardless.
import { createCheckoutSession } from "./actions";

beforeEach(() => {
  callLog.length = 0;
  stripeParams.length = 0;
  orderRows.length = 0;
  afterCallbacks.length = 0;
  prewarmCalls.length = 0;
  priceVariantCookie = null;
  delete process.env.PRICE_TEST;
  process.env.NEXT_PUBLIC_SITE_URL = "https://windowinto.test";
});

describe("createCheckoutSession — server-side compliance validation", () => {
  // "vertrouw nooit uitsluitend op frontend-validatie" (compliance brief):
  // CheckoutPanel.tsx already disables its submit button until both boxes
  // are checked, but that's a UX nicety a client can trivially bypass
  // (disabled DOM attributes, a direct fetch to the action). These tests
  // are the actual gate.
  it("rejects when the terms checkbox was not accepted", async () => {
    await expect(createCheckoutSession(false, true)).rejects.toThrow(
      CHECKOUT_DICT.errorTermsRequired
    );
    expect(callLog).toEqual([]);
  });

  it("rejects when the digital-delivery/withdrawal consent checkbox was not accepted", async () => {
    await expect(createCheckoutSession(true, false)).rejects.toThrow(
      CHECKOUT_DICT.errorConsentRequired
    );
    expect(callLog).toEqual([]);
  });

  it("rejects when neither checkbox was accepted, with the terms error taking priority", async () => {
    await expect(createCheckoutSession(false, false)).rejects.toThrow(
      CHECKOUT_DICT.errorTermsRequired
    );
  });

  it("rejects a missing or malformed delivery e-mail before any order, consent or Stripe step", async () => {
    for (const email of [undefined, "", "   ", "no-at-sign", "a@b", "two words@example.com"]) {
      await expect(createCheckoutSession(true, true, undefined, email)).rejects.toThrow(CHECKOUT_DICT.errorEmailRequired);
    }
    expect(callLog).toEqual([]);
  });

  it("never reaches Stripe or writes any order/consent row when validation fails", async () => {
    await expect(createCheckoutSession(false, false)).rejects.toThrow();
    expect(callLog).not.toContain("stripe.checkout.sessions.create");
    expect(callLog).not.toContain("payments.insert");
    expect(callLog).not.toContain("recordTermsAcceptance");
    expect(callLog).not.toContain("recordDigitalDeliveryConsent");
  });
});

describe("createCheckoutSession — consent-before-redirect ordering", () => {
  it("writes the order and both consent records before ever redirecting to Stripe", async () => {
    // The compliance brief's hard requirement: no PDF may be generated or
    // delivered before consent is recorded, and PDF generation only ever
    // happens later on /plan once Stripe confirms payment — so it's
    // enough to prove consent is written before the buyer is even sent to
    // Stripe's payment page.
    await expect(createCheckoutSession(true, true, undefined, EMAIL)).rejects.toThrow("NEXT_REDIRECT");

    const orderIndex = callLog.indexOf("payments.insert");
    const termsIndex = callLog.indexOf("recordTermsAcceptance");
    const consentIndex = callLog.indexOf("recordDigitalDeliveryConsent");
    const redirectIndex = callLog.findIndex((entry) => entry.startsWith("redirect:"));

    expect(orderIndex).toBeGreaterThanOrEqual(0);
    expect(termsIndex).toBeGreaterThan(orderIndex);
    expect(consentIndex).toBeGreaterThan(termsIndex);
    expect(redirectIndex).toBeGreaterThan(consentIndex);
  });
});

describe("createCheckoutSession — the search for places starts while the buyer pays", () => {
  it("schedules the research prewarm for after the response, for this session", async () => {
    await expect(createCheckoutSession(true, true, undefined, EMAIL)).rejects.toThrow("NEXT_REDIRECT");
    // Nothing runs before the response (the buyer is not made to wait for it)…
    expect(prewarmCalls).toHaveLength(0);
    expect(afterCallbacks).toHaveLength(1);
    // …and what was scheduled is the prewarm for the session that ordered.
    await afterCallbacks[0]();
    expect(prewarmCalls).toHaveLength(1);
    expect(prewarmCalls[0][1]).toBe("session-1");
  });

  it("schedules nothing when validation fails", async () => {
    await expect(createCheckoutSession(true, true, undefined, "nope")).rejects.toThrow();
    expect(afterCallbacks).toHaveLength(0);
  });
});

describe("createCheckoutSession — the price test and the follow-up consent", () => {
  it("charges the normal price and records no variant while the price test is off", async () => {
    priceVariantCookie = "B"; // a leftover cookie means nothing without the setting
    await expect(createCheckoutSession(true, true, undefined, EMAIL)).rejects.toThrow("NEXT_REDIRECT");
    expect(stripeParams[0].line_items[0].price_data.unit_amount).toBe(750);
    expect(orderRows[0]).toMatchObject({ amount: 750 });
    expect("price_variant" in orderRows[0]).toBe(false);
    expect(stripeParams[0].metadata.price_variant).toBe("");
  });

  it("charges the price of the variant in the visitor's cookie, and records which variant on the order and at Stripe", async () => {
    process.env.PRICE_TEST = '{"B":{"self":650}}';
    priceVariantCookie = "B";
    await expect(createCheckoutSession(true, true, undefined, EMAIL)).rejects.toThrow("NEXT_REDIRECT");
    expect(stripeParams[0].line_items[0].price_data.unit_amount).toBe(650);
    expect(orderRows[0]).toMatchObject({ amount: 650, price_variant: "B" });
    expect(stripeParams[0].metadata.price_variant).toBe("B");
  });

  it("charges the normal price, as control, to a visitor without a (valid) variant while the test is on", async () => {
    process.env.PRICE_TEST = '{"B":{"self":650}}';
    for (const cookie of [null, "control", "Z"]) {
      stripeParams.length = 0;
      orderRows.length = 0;
      priceVariantCookie = cookie;
      await expect(createCheckoutSession(true, true, undefined, EMAIL)).rejects.toThrow("NEXT_REDIRECT");
      expect(stripeParams[0].line_items[0].price_data.unit_amount).toBe(750);
      expect(orderRows[0]).toMatchObject({ price_variant: "control" });
    }
  });

  it("records the follow-up consent only when it was given, on the order and in the Stripe metadata", async () => {
    await expect(createCheckoutSession(true, true, undefined, EMAIL, true)).rejects.toThrow("NEXT_REDIRECT");
    expect(stripeParams[0].metadata.followup_consent).toBe("1");
    expect(orderRows[0].followup_consent_at).toEqual(expect.any(String));
    // The address is the one Stripe is given and the one stored on the order.
    expect(stripeParams[0]).toMatchObject({ customer_email: EMAIL });

    stripeParams.length = 0;
    orderRows.length = 0;
    await expect(createCheckoutSession(true, true, undefined, EMAIL)).rejects.toThrow("NEXT_REDIRECT");
    expect(stripeParams[0].metadata.followup_consent).toBe("");
    expect("followup_consent_at" in orderRows[0]).toBe(false);
  });
});
