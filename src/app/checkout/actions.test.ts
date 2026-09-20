import { describe, expect, it, vi, beforeEach } from "vitest";

// Fixed dictionary strings for the two validation errors under test — kept
// separate from the real src/lib/i18n/dictionaries.ts content so this test
// doesn't silently drift if that copy changes; it asserts against exactly
// what it injects.
const CHECKOUT_DICT = {
  errorTermsRequired: "Je moet akkoord gaan met de Algemene Voorwaarden.",
  errorConsentRequired: "Je moet instemmen met directe digitale levering.",
};

vi.mock("@/lib/language", () => ({
  getLocale: vi.fn(async () => "nl"),
}));

vi.mock("@/lib/i18n/dictionaries", () => ({
  getDictionary: vi.fn(() => ({ checkout: CHECKOUT_DICT })),
}));

const callLog: string[] = [];

vi.mock("@/lib/session", () => ({
  getSessionId: vi.fn(async () => "session-1"),
}));

vi.mock("@/lib/stripe", () => ({
  getStripe: vi.fn(() => ({
    checkout: {
      sessions: {
        create: vi.fn(async () => {
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
        if (table === "payments") return { insert: () => paymentsInsertChain };
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
    await expect(createCheckoutSession(true, true)).rejects.toThrow("NEXT_REDIRECT");

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
