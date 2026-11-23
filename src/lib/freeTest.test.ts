import { describe, expect, it } from "vitest";
import { FREE_ORDER_PREFIX, freeTestOrdersEnabled, isFreeOrderId, newFreeOrderId } from "./freeTest";

describe("free test orders", () => {
  it("are off by default, also in test mode: a site that is still in test mode by mistake must not give books away", () => {
    expect(freeTestOrdersEnabled({ STRIPE_SECRET_KEY: "sk_test_abc", STRIPE_MODE: "test" })).toBe(false);
    expect(freeTestOrdersEnabled({ STRIPE_SECRET_KEY: "sk_test_abc" })).toBe(false);
    expect(freeTestOrdersEnabled({})).toBe(false);
  });

  it("are switched on in test mode only by FREE_TEST_ORDERS=1 (or true, on, yes)", () => {
    for (const v of ["1", "true", "on", "yes", '"1"', " TRUE "]) {
      expect(freeTestOrdersEnabled({ STRIPE_SECRET_KEY: "sk_test_abc", FREE_TEST_ORDERS: v })).toBe(true);
    }
    for (const v of ["", "0", "false", "off", "no", "maybe"]) {
      expect(freeTestOrdersEnabled({ STRIPE_SECRET_KEY: "sk_test_abc", FREE_TEST_ORDERS: v })).toBe(false);
    }
  });

  it("are never on in live mode, whatever else is set", () => {
    expect(freeTestOrdersEnabled({ STRIPE_SECRET_KEY: "sk_live_abc", STRIPE_MODE: "live" })).toBe(false);
    expect(freeTestOrdersEnabled({ STRIPE_SECRET_KEY: "sk_live_abc", FREE_TEST_ORDERS: "1" })).toBe(false);
    expect(freeTestOrdersEnabled({ STRIPE_SECRET_KEY: "sk_live_abc", STRIPE_MODE: "test", FREE_TEST_ORDERS: "1" })).toBe(false);
  });

  it("gives every free order a unique id that counts as a test order (cs_test_ prefix)", () => {
    const a = newFreeOrderId();
    const b = newFreeOrderId();
    expect(a).not.toBe(b);
    expect(a.startsWith("cs_test_")).toBe(true);
    expect(isFreeOrderId(a)).toBe(true);
  });

  it("does not take a Stripe session id, a bare prefix or nothing for a free order", () => {
    expect(isFreeOrderId("cs_test_a1jYCZBW4Ru2lfJnZxYPLs6")).toBe(false);
    expect(isFreeOrderId("cs_live_abc")).toBe(false);
    expect(isFreeOrderId(FREE_ORDER_PREFIX)).toBe(false);
    expect(isFreeOrderId(null)).toBe(false);
    expect(isFreeOrderId(undefined)).toBe(false);
  });
});
