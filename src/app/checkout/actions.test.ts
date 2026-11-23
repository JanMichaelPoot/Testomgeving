import { describe, expect, it, vi, beforeEach } from "vitest";

// Fixed dictionary strings for the two validation errors under test — kept
// separate from the real src/lib/i18n/dictionaries.ts content so this test
// doesn't silently drift if that copy changes; it asserts against exactly
// what it injects.
const CHECKOUT_DICT = {
  errorTermsRequired: "Je moet akkoord gaan met de Algemene Voorwaarden.",
  errorConsentRequired: "Je moet instemmen met directe digitale levering.",
  errorEmailRequired: "Vul een geldig e-mailadres in.",
  discount: {
    errors: { invalid: "Code onbekend.", used: "Code al gebruikt.", expired: "Code verlopen.", busy: "Code in gebruik.", unavailable: "Codes niet beschikbaar.", limit: "Te veel pogingen." },
    stripeName: "Kortingscode",
  },
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
const stripeParams: { customer_email?: string; line_items: { price_data: { unit_amount: number } }[]; metadata: Record<string, string>; discounts?: { coupon: string }[]; expires_at?: number }[] = [];
const couponParams: Record<string, unknown>[] = [];
let couponFails = false;
const orderRows: Record<string, unknown>[] = [];
const userUpserts: Record<string, unknown>[] = [];
let priceVariantCookie: string | null = null;

vi.mock("@/lib/session", () => ({
  getSessionId: vi.fn(async () => "session-1"),
}));

vi.mock("@/lib/stripe", () => ({
  getStripe: vi.fn(() => ({
    coupons: {
      create: vi.fn(async (params: Record<string, unknown>) => {
        if (couponFails) throw new Error("stripe is down");
        couponParams.push(params);
        return { id: "coupon_1" };
      }),
    },
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

// The headers the host adds to the request (country and city of the connection); empty on a local run.
let requestHeaders: Record<string, string> = {};
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers(requestHeaders)),
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
        if (table === "users") {
          return {
            upsert: (row: Record<string, unknown>) => {
              userUpserts.push(row);
              callLog.push("users.upsert");
              return { select: () => ({ single: () => Promise.resolve({ data: { id: "user-1" } }) }) };
            },
          };
        }
        throw new Error(`Unexpected table in test: ${table}`);
      },
    };
  }),
}));

// The one-time discount codes (src/lib/discountCode.ts): the rules are the real ones, the storage is a small in-memory table with one code in it.
interface CodeRow { id: string; code: string; amountCents: number; expiresAt: Date; reservedUntil: Date | null; redeemedAt: Date | null }
const codeRows: CodeRow[] = [];
const redeemed: string[] = [];
vi.mock("@/lib/discountCode", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/discountCode")>();
  return {
    ...real,
    supabaseStore: () => ({
      async findByPayment() {
        return null;
      },
      async insert() {
        return "taken" as const;
      },
      async findByCode(code: string) {
        const r = codeRows.find((x) => x.code === code);
        return r ? { ...r } : null;
      },
      async hold(code: string, now: Date, until: Date) {
        const r = codeRows.find((x) => x.code === code);
        if (!r || r.redeemedAt || r.expiresAt <= now || (r.reservedUntil && r.reservedUntil > now)) return null;
        r.reservedUntil = until;
        return { id: r.id, amountCents: r.amountCents };
      },
      async releaseForOrder() {},
      async releaseById(id: string) {
        const r = codeRows.find((x) => x.id === id);
        if (r && !r.redeemedAt) r.reservedUntil = null;
      },
      async redeemForOrder(session: string) {
        redeemed.push(session);
        return true;
      },
    }),
  };
});

// Imported after the mocks above so createCheckoutSession picks them up —
// vi.mock calls are hoisted above imports by vitest, but importing the
// module under test last keeps the intent readable regardless.
import { createCheckoutSession } from "./actions";

beforeEach(() => {
  callLog.length = 0;
  stripeParams.length = 0;
  orderRows.length = 0;
  userUpserts.length = 0;
  afterCallbacks.length = 0;
  prewarmCalls.length = 0;
  couponParams.length = 0;
  couponFails = false;
  redeemed.length = 0;
  codeRows.length = 0;
  codeRows.push({ id: "code-1", code: "WI-ABCD-EFGH", amountCents: 250, expiresAt: new Date(Date.now() + 30 * 86_400_000), reservedUntil: null, redeemedAt: null });
  priceVariantCookie = null;
  requestHeaders = {};
  delete process.env.PRICE_TEST;
  process.env.NEXT_PUBLIC_SITE_URL = "https://windowinto.test";
  // The Stripe flow is what most tests below are about: the free test-phase route (src/lib/freeTest.ts) is switched off, and has its own tests.
  process.env.FREE_TEST_ORDERS = "0";
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

describe("createCheckoutSession — where the order was placed from", () => {
  it("stores the country and place the host derives from the connection on the order, never the IP address", async () => {
    requestHeaders = { "x-vercel-ip-country": "nl", "x-vercel-ip-city": "Den%20Haag", "x-forwarded-for": "203.0.113.9" };
    await expect(createCheckoutSession(true, true, undefined, EMAIL)).rejects.toThrow("NEXT_REDIRECT");
    expect(orderRows[0]).toMatchObject({ ip_country: "NL", ip_city: "Den Haag" });
    expect(JSON.stringify(orderRows[0])).not.toContain("203.0.113.9");
  });

  it("stores no geo columns without a hint (a local run), and the order is still made", async () => {
    await expect(createCheckoutSession(true, true, undefined, EMAIL)).rejects.toThrow("NEXT_REDIRECT");
    expect("ip_country" in orderRows[0]).toBe(false);
    expect(callLog).toContain("payments.insert");
  });
});

describe("createCheckoutSession — free test orders (no Stripe)", () => {
  const saved = { key: process.env.STRIPE_SECRET_KEY, mode: process.env.STRIPE_MODE };
  const restore = () => {
    for (const [name, value] of [["STRIPE_SECRET_KEY", saved.key], ["STRIPE_MODE", saved.mode]] as const) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  };

  it("starts the book straight away in test mode: no Stripe session, an order of 0 with a test id, the consents stored, no prewarm", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_abc";
    delete process.env.STRIPE_MODE;
    delete process.env.FREE_TEST_ORDERS;
    try {
      await expect(createCheckoutSession(true, true, undefined, EMAIL)).rejects.toThrow("NEXT_REDIRECT");
    } finally {
      restore();
    }
    expect(stripeParams).toHaveLength(0);
    expect(orderRows[0]).toMatchObject({ amount: 0, status: "succeeded", order_number: "WI-2026-000001" });
    const id = String(orderRows[0].stripe_payment_id);
    expect(id.startsWith("cs_test_free_")).toBe(true);
    // The consents are stored before the redirect, exactly like for a paid order, and the address is kept with the account.
    expect(callLog.indexOf("recordTermsAcceptance")).toBeLessThan(callLog.findIndex((c) => c.startsWith("redirect:")));
    expect(callLog.indexOf("recordDigitalDeliveryConsent")).toBeLessThan(callLog.findIndex((c) => c.startsWith("redirect:")));
    expect(userUpserts).toEqual([{ email: EMAIL }]);
    expect(callLog).toContain(`redirect:/plan?checkout_session_id=${id}`);
    // Nobody pays meanwhile, so the real generation starts at once: searching the same places twice would only cost double.
    expect(afterCallbacks).toHaveLength(0);
    expect(prewarmCalls).toHaveLength(0);
  });

  it("is never free with a live Stripe key, whatever else is set", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_live_abc";
    process.env.STRIPE_MODE = "test";
    delete process.env.FREE_TEST_ORDERS;
    try {
      await expect(createCheckoutSession(true, true, undefined, EMAIL)).rejects.toThrow("NEXT_REDIRECT");
    } finally {
      restore();
    }
    expect(stripeParams).toHaveLength(1);
    expect(orderRows[0]).toMatchObject({ stripe_payment_id: "cs_test_123", status: "pending" });
    expect(orderRows[0].amount).toBeGreaterThan(0);
  });

  it("uses Stripe in test mode too when FREE_TEST_ORDERS=0", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_abc";
    await expect(createCheckoutSession(true, true, undefined, EMAIL)).rejects.toThrow("NEXT_REDIRECT");
    restore();
    expect(stripeParams).toHaveLength(1);
    expect(callLog).toContain("redirect:https://checkout.stripe.test/pay/cs_test_123");
  });
});

describe("createCheckoutSession — a one-time discount code (Step 230)", () => {
  it("takes EUR 2.50 off through a Stripe coupon, holds the code for this order, and records what was charged", async () => {
    await expect(createCheckoutSession(true, true, undefined, EMAIL, false, "wi abcd efgh")).rejects.toThrow("NEXT_REDIRECT");
    // Stripe shows the full price, the discount and what is paid: the line item keeps its price and the coupon takes the amount off, once.
    expect(stripeParams[0].line_items[0].price_data.unit_amount).toBe(750);
    expect(couponParams[0]).toMatchObject({ amount_off: 250, currency: "eur", duration: "once", max_redemptions: 1, name: "Kortingscode" });
    expect(stripeParams[0].discounts).toEqual([{ coupon: "coupon_1" }]);
    // The Checkout Session runs out well before the hold on the code does.
    const minutes = (stripeParams[0].expires_at! * 1000 - Date.now()) / 60_000;
    expect(minutes).toBeGreaterThan(55);
    expect(minutes).toBeLessThanOrEqual(60);
    expect(codeRows[0].reservedUntil!.getTime()).toBeGreaterThan(Date.now() + 80 * 60_000);
    expect(codeRows[0].redeemedAt).toBeNull(); // used up only when Stripe confirms the payment (the webhook)
    expect(orderRows[0]).toMatchObject({ amount: 500, status: "pending", discount_code_id: "code-1", discount_cents: 250 });
    expect(stripeParams[0].metadata.discount_code_id).toBe("code-1");
  });

  it("charges the normal price, with no coupon, when no code was given", async () => {
    await expect(createCheckoutSession(true, true, undefined, EMAIL)).rejects.toThrow("NEXT_REDIRECT");
    expect(couponParams).toHaveLength(0);
    expect(stripeParams[0].discounts).toBeUndefined();
    expect(stripeParams[0].expires_at).toBeUndefined();
    expect(orderRows[0]).toMatchObject({ amount: 750 });
    expect(orderRows[0]).not.toHaveProperty("discount_code_id");
  });

  it("refuses a code that is wrong, used up, expired or held, before any order, consent or Stripe step", async () => {
    for (const [typed, expected, mutate] of [
      ["hello", "Code onbekend.", () => {}],
      ["WI-ZZZZ-ZZZZ", "Code onbekend.", () => {}],
      ["WI-ABCD-EFGH", "Code al gebruikt.", () => { codeRows[0].redeemedAt = new Date(); }],
      ["WI-ABCD-EFGH", "Code verlopen.", () => { codeRows[0].redeemedAt = null; codeRows[0].expiresAt = new Date(Date.now() - 1000); }],
      ["WI-ABCD-EFGH", "Code in gebruik.", () => { codeRows[0].expiresAt = new Date(Date.now() + 86_400_000); codeRows[0].reservedUntil = new Date(Date.now() + 600_000); }],
    ] as const) {
      mutate();
      await expect(createCheckoutSession(true, true, undefined, EMAIL, false, typed)).rejects.toThrow(expected);
    }
    expect(stripeParams).toHaveLength(0);
    expect(orderRows).toHaveLength(0);
    expect(callLog).not.toContain("recordTermsAcceptance");
  });

  it("lets the code go again when the order cannot be started at Stripe", async () => {
    couponFails = true;
    await expect(createCheckoutSession(true, true, undefined, EMAIL, false, "WI-ABCD-EFGH")).rejects.toThrow("stripe is down");
    expect(codeRows[0].reservedUntil).toBeNull();
    expect(orderRows).toHaveLength(0);
  });

  it("uses the code up at once for a free test order, which has no Stripe payment to confirm", async () => {
    const saved = { key: process.env.STRIPE_SECRET_KEY, mode: process.env.STRIPE_MODE };
    process.env.STRIPE_SECRET_KEY = "sk_test_abc";
    delete process.env.STRIPE_MODE;
    delete process.env.FREE_TEST_ORDERS;
    try {
      await expect(createCheckoutSession(true, true, undefined, EMAIL, false, "WI-ABCD-EFGH")).rejects.toThrow("NEXT_REDIRECT");
    } finally {
      if (saved.key === undefined) delete process.env.STRIPE_SECRET_KEY;
      else process.env.STRIPE_SECRET_KEY = saved.key;
      if (saved.mode === undefined) delete process.env.STRIPE_MODE;
      else process.env.STRIPE_MODE = saved.mode;
    }
    expect(stripeParams).toHaveLength(0);
    expect(couponParams).toHaveLength(0);
    expect(redeemed).toEqual([String(orderRows[0].stripe_payment_id)]);
  });
});
